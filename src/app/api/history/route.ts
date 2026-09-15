import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ─── L1 : cache mémoire avec TTL (6h) ───────────────────────────────────────
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
    console.warn(`[history] sbSet error for ${key}:`, e)
  }
}

// ─── Yahoo Finance ────────────────────────────────────────────────────────────
const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://finance.yahoo.com/',
}

async function fetchFromYahoo(ticker: string, fromDate?: string): Promise<HistEntry | null> {
  const now = Math.floor(Date.now() / 1000)
  const FIVE_YEARS = 5 * 365 * 24 * 3600
  const period1 = fromDate
    ? Math.floor(new Date(fromDate).getTime() / 1000)
    : now - FIVE_YEARS
  const period2 = now

  const bases = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com']
  for (const base of bases) {
    try {
      const url = `${base}/v8/finance/chart/${encodeURIComponent(ticker)}` +
        `?period1=${period1}&period2=${period2}&interval=1d&includePrePost=false&events=div`
      console.log(`[history] Yahoo ${ticker} [${fromDate ?? '5y'} → now] from ${base}`)
      const res = await fetch(url, { headers: YF_HEADERS, cache: 'no-store', signal: AbortSignal.timeout(15000) })
      if (!res.ok) {
        console.warn(`[history] Yahoo ${ticker} → HTTP ${res.status} from ${base}`)
        continue
      }
      const json = await res.json()
      const result = json?.chart?.result?.[0]
      if (!result) continue

      const timestamps: number[] = result.timestamp ?? []
      const adjCloses: (number | null)[] =
        result.indicators?.adjclose?.[0]?.adjclose ??
        result.indicators?.quote?.[0]?.close ?? []

      const dates: string[] = []
      const closes: number[] = []
      for (let i = 0; i < timestamps.length; i++) {
        const c = adjCloses[i]
        if (c == null || c <= 0) continue
        dates.push(new Date(timestamps[i] * 1000).toISOString().slice(0, 10))
        closes.push(c)
      }
      if (dates.length === 0) continue

      console.log(`[history] Yahoo ${ticker} → ${dates.length} points (${dates[0]} → ${dates[dates.length - 1]})`)

      const cutoff = now - 365 * 24 * 3600
      const divRaw = result.events?.dividends ?? {}
      let dividendTTM = 0
      const dividends: { ts: number; amount: number }[] = []
      for (const entry of Object.values(divRaw) as { amount: number; date: number }[]) {
        const amt = entry.amount ?? 0
        if (amt <= 0) continue
        dividends.push({ ts: entry.date, amount: amt })
        if (entry.date >= cutoff) dividendTTM += amt
      }
      dividends.sort((a, b) => a.ts - b.ts)
      return { dates, closes, dividendTTM, dividends }
    } catch (e) {
      console.warn(`[history] Yahoo ${ticker} exception:`, e instanceof Error ? e.message : e)
    }
  }
  console.error(`[history] Yahoo ${ticker} → FAILED`)
  return null
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
  const allDivs = [...stored.dividends, ...fresh.dividends.filter(d => !stored.dividends.some(x => x.ts === d.ts))]
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
      console.log(`[history] ${ticker} → Supabase fresh (${stored.lastDate})`)
      memCacheSet(ticker, stored.entry)
      return stored.entry
    }
    console.log(`[history] ${ticker} → Supabase stale (${stored.lastDate}), delta fetch…`)
    const fresh = await fetchFromYahoo(ticker, stored.lastDate)
    if (fresh && fresh.dates.length > 0) {
      const merged = mergeEntries(stored.entry, fresh)
      memCacheSet(ticker, merged)
      sbSet(ticker, merged)
      return merged
    }
    console.warn(`[history] ${ticker} → delta failed, returning stale data`)
    memCacheSet(ticker, stored.entry)
    return stored.entry
  }

  console.log(`[history] ${ticker} → no cache, full fetch from Yahoo`)
  const full = await fetchFromYahoo(ticker)
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

const HIST_TICKER_MAP: Record<string, string> = {
  'XAUUSD=X': 'GC=F', 'XAGUSD=X': 'SI=F',
  'XPTUSD=X': 'PL=F', 'XPDUSD=X': 'PA=F',
}

export async function GET(req: NextRequest) {
  const tickers = (req.nextUrl.searchParams.get('tickers') ?? '')
    .split(',')
    .map(t => t.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 40)

  const bust = req.nextUrl.searchParams.get('bust') === '1'

  if (tickers.length === 0) return NextResponse.json({})

  console.log(`[history] GET ${tickers.join(', ')}${bust ? ' [BUST]' : ''}`)

  const entries = await Promise.all(
    tickers.map(async t => {
      const fetchTicker = HIST_TICKER_MAP[t] ?? t
      const result = await fetchHistoryEntry(fetchTicker, bust)
      if (!result) console.warn(`[history] ${t} → null`)
      return [t, result] as const
    })
  )

  const results = Object.fromEntries(entries.filter(([, v]) => v !== null))
  console.log(`[history] returning ${Object.keys(results).length}/${tickers.length} tickers`)
  return NextResponse.json(results, { headers: { 'Cache-Control': 'no-store' } })
}
