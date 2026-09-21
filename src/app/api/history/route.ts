import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ─── L1 : cache mémoire avec TTL (6h) ────────────────────────────────────────
const MEM_TTL = 6 * 60 * 60 * 1000
const _memCache = new Map<string, { entry: HistEntry; cachedAt: number }>()

function memCacheGet(key: string): HistEntry | null {
  const c = _memCache.get(key)
  if (!c) return null
  if (Date.now() - c.cachedAt > MEM_TTL) { _memCache.delete(key); return null }
  return c.entry
}
function memCacheSet(key: string, entry: HistEntry) {
  _memCache.set(key, { entry, cachedAt: Date.now() })
}

const _fetchInProgress = new Map<string, Promise<HistEntry | null>>()

interface HistEntry {
  dates: string[]
  closes: number[]
  dividendTTM: number
  dividends: { ts: number; amount: number }[]
}

// ─── L2 : Supabase hist_cache ─────────────────────────────────────────────────
function sbClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

async function sbGet(key: string): Promise<{ entry: HistEntry; lastDate: string } | null> {
  try {
    const { data, error } = await sbClient()
      .from('hist_cache')
      .select('data, last_date')
      .eq('cache_key', key)
      .maybeSingle()
    if (error || !data) return null
    return { entry: data.data as HistEntry, lastDate: data.last_date as string }
  } catch { return null }
}

async function sbSet(key: string, entry: HistEntry) {
  const lastDate = entry.dates[entry.dates.length - 1] ?? ''
  try {
    await sbClient().from('hist_cache').upsert(
      { cache_key: key, data: entry, last_date: lastDate, updated_at: new Date().toISOString() },
      { onConflict: 'cache_key' }
    )
  } catch (e) {
    console.warn('[history] sbSet error for ' + key + ':', e)
  }
}

// ─── Normalisation : anciens tickers Yahoo → format Twelve Data ───────────────
function normalizeTicker(raw: string): string {
  // Crypto Yahoo : "BTC-USD" → "BTC/USD"
  const cryptoYahoo = raw.match(/^([A-Z]{2,10})-([A-Z]{3,4})$/)
  if (cryptoYahoo) return cryptoYahoo[1] + '/' + cryptoYahoo[2]

  // Forex/Métaux Yahoo : "XAUUSD=X", "EURUSD=X" → "XAU/USD", "EUR/USD"
  const fxYahoo = raw.match(/^([A-Z]{3,4})([A-Z]{3})=X$/)
  if (fxYahoo) return fxYahoo[1] + '/' + fxYahoo[2]

  // Futures Yahoo → Twelve Data (plan gratuit : métaux → spot forex)
  const FUTURES_MAP: Record<string, string> = {
    'GC=F': 'XAU/USD', 'SI=F': 'XAG/USD', 'PL=F': 'XPT/USD', 'PA=F': 'XPD/USD',
  }
  if (FUTURES_MAP[raw]) return FUTURES_MAP[raw]

  // Actions suisses Yahoo : "NESN.SW" → "NESN"
  const swissYahoo = raw.match(/^([A-Z0-9]+)\.(SW|VX|BX)$/i)
  if (swissYahoo) return swissYahoo[1].toUpperCase()

  return raw
}

// ─── Twelve Data : historique journalier (time_series) ───────────────────────
// Plan gratuit : 800 crédits/jour.
// Le cache Supabase (L2) absorbe l'essentiel — Twelve Data n'est appelé
// qu'à la première requête ou quand les données sont périmées (> hier).
async function fetchFromTwelveData(symbol: string): Promise<HistEntry | null> {
  const apiKey = process.env.TWELVE_DATA_KEY
  if (!apiKey) {
    console.error('[history] TWELVE_DATA_KEY manquante')
    return null
  }

  try {
    const url = new URL('https://api.twelvedata.com/time_series')
    url.searchParams.set('symbol', symbol)
    url.searchParams.set('interval', '1day')
    url.searchParams.set('outputsize', '5000')   // ~13,7 ans de données
    url.searchParams.set('adjust', 'true')        // prix ajustés splits & dividendes
    url.searchParams.set('apikey', apiKey)

    console.log('[history] TwelveData time_series ' + symbol)
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    })

    if (!res.ok) {
      console.warn('[history] TwelveData ' + symbol + ' → HTTP ' + res.status)
      return null
    }

    const json = await res.json()

    if (json.status === 'error') {
      console.warn('[history] TwelveData ' + symbol + ' → ' + json.message)
      return null
    }

    const values: { datetime: string; close: string }[] = json.values ?? []
    if (values.length === 0) {
      console.warn('[history] TwelveData ' + symbol + ' → 0 points')
      return null
    }

    // Twelve Data : du plus récent au plus ancien → on inverse
    const reversed = [...values].reverse()
    const dates: string[] = []
    const closes: number[] = []

    for (const v of reversed) {
      const c = parseFloat(v.close)
      if (isNaN(c) || c <= 0) continue
      dates.push(v.datetime.slice(0, 10))  // "2024-01-15 00:00:00" → "2024-01-15"
      closes.push(c)
    }

    if (dates.length === 0) return null

    console.log('[history] TwelveData ' + symbol + ' → ' + dates.length + ' points (' + dates[0] + ' → ' + dates[dates.length - 1] + ')')

    // Dividendes : endpoint /dividends (plan payant uniquement)
    // Sur plan gratuit : silencieux, dividendTTM = 0
    let dividendTTM = 0
    const dividends: { ts: number; amount: number }[] = []

    try {
      const divUrl = new URL('https://api.twelvedata.com/dividends')
      divUrl.searchParams.set('symbol', symbol)
      divUrl.searchParams.set('range', '5y')
      divUrl.searchParams.set('apikey', apiKey)

      const divRes = await fetch(divUrl.toString(), {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      })

      if (divRes.ok) {
        const divJson = await divRes.json()
        if (divJson.status !== 'error' && Array.isArray(divJson.dividends)) {
          const cutoff = Date.now() / 1000 - 365 * 24 * 3600
          for (const d of divJson.dividends) {
            const ts = new Date(d.ex_date ?? d.payment_date ?? '').getTime() / 1000
            const amt = parseFloat(d.amount ?? '0')
            if (isNaN(ts) || isNaN(amt) || amt <= 0) continue
            dividends.push({ ts, amount: amt })
            if (ts >= cutoff) dividendTTM += amt
          }
          dividends.sort((a, b) => a.ts - b.ts)
        }
      }
    } catch {
      // /dividends non disponible sur plan gratuit — silencieux
    }

    return { dates, closes, dividendTTM, dividends }
  } catch (e) {
    console.error('[history] TwelveData ' + symbol + ' exception:', e instanceof Error ? e.message : e)
    return null
  }
}

function mergeEntries(stored: HistEntry, fresh: HistEntry): HistEntry {
  const seen = new Set(stored.dates)
  const newDates: string[] = []
  const newCloses: number[] = []
  for (let i = 0; i < fresh.dates.length; i++) {
    if (!seen.has(fresh.dates[i])) {
      newDates.push(fresh.dates[i])
      newCloses.push(fresh.closes[i])
    }
  }
  const allDivs = [
    ...stored.dividends,
    ...fresh.dividends.filter(d => !stored.dividends.some(x => x.ts === d.ts)),
  ]
  allDivs.sort((a, b) => a.ts - b.ts)
  return {
    dates: [...stored.dates, ...newDates],
    closes: [...stored.closes, ...newCloses],
    dividendTTM: fresh.dividendTTM > 0 ? fresh.dividendTTM : stored.dividendTTM,
    dividends: allDivs,
  }
}

async function _doFetchHistory(ticker: string, bust = false): Promise<HistEntry | null> {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)

  const stored = bust ? null : await sbGet(ticker)

  if (stored) {
    if (stored.lastDate >= yesterdayStr) {
      console.log('[history] ' + ticker + ' → Supabase fresh (' + stored.lastDate + ')')
      memCacheSet(ticker, stored.entry)
      return stored.entry
    }
    console.log('[history] ' + ticker + ' → Supabase stale (' + stored.lastDate + '), full fetch…')
    const fresh = await fetchFromTwelveData(ticker)
    if (fresh && fresh.dates.length > 0) {
      const merged = mergeEntries(stored.entry, fresh)
      memCacheSet(ticker, merged)
      sbSet(ticker, merged)
      return merged
    }
    console.warn('[history] ' + ticker + ' → full fetch failed, returning stale data')
    memCacheSet(ticker, stored.entry)
    return stored.entry
  }

  console.log('[history] ' + ticker + ' → no cache, full fetch from TwelveData')
  const full = await fetchFromTwelveData(ticker)
  if (!full) return null
  memCacheSet(ticker, full)
  sbSet(ticker, full)
  return full
}

async function fetchHistoryEntry(ticker: string, bust: boolean): Promise<HistEntry | null> {
  if (bust) {
    _memCache.delete(ticker)
    _fetchInProgress.delete(ticker)
  } else {
    const cached = memCacheGet(ticker)
    if (cached) return cached
    if (_fetchInProgress.has(ticker)) return _fetchInProgress.get(ticker)!
  }
  const promise = _doFetchHistory(ticker, bust)
  if (!bust) {
    _fetchInProgress.set(ticker, promise)
    promise.finally(() => _fetchInProgress.delete(ticker))
  }
  return promise
}

export async function GET(req: NextRequest) {
  const tickers = (req.nextUrl.searchParams.get('tickers') ?? '')
    .split(',')
    .map(t => t.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 40)

  const bust = req.nextUrl.searchParams.get('bust') === '1'

  if (tickers.length === 0) return NextResponse.json({})

  console.log('[history] GET ' + tickers.join(', ') + (bust ? ' [BUST]' : ''))

  const entries = await Promise.all(
    tickers.map(async t => {
      const tdTicker = normalizeTicker(t)
      const result = await fetchHistoryEntry(tdTicker, bust)
      if (!result) console.warn('[history] ' + t + ' (→ ' + tdTicker + ') → null')
      return [t, result] as const
    })
  )

  const results = Object.fromEntries(entries.filter(([, v]) => v !== null))
  console.log('[history] returning ' + Object.keys(results).length + '/' + tickers.length + ' tickers')
  return NextResponse.json(results, { headers: { 'Cache-Control': 'no-store' } })
}
