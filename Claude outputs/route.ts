import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ─── L1 : cache mémoire (permanent tant que le process tourne) ───────────────
const _memCache = new Map<string, HistEntry>()

// ─── Déduplication : évite plusieurs appels Yahoo simultanés pour le même ticker ─
const _fetchInProgress = new Map<string, Promise<HistEntry | null>>()

interface HistEntry {
  dates: string[]
  closes: number[]
  dividendTTM: number
  dividends: { ts: number; amount: number }[]
}

// ─── Supabase client (service role pour les routes API) ──────────────────────
function sbClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// ─── L2 : lecture Supabase ────────────────────────────────────────────────────
async function sbGet(key: string): Promise<{ entry: HistEntry; lastDate: string } | null> {
  try {
    const { data, error } = await sbClient()
      .from('hist_cache')
      .select('data, last_date')
      .eq('cache_key', key)
      .maybeSingle()
    if (error || !data) return null
    return { entry: data.data as HistEntry, lastDate: data.last_date as string }
  } catch {
    return null
  }
}

// ─── L2 : écriture Supabase ───────────────────────────────────────────────────
async function sbSet(key: string, entry: HistEntry) {
  const lastDate = entry.dates[entry.dates.length - 1] ?? ''
  try {
    await sbClient()
      .from('hist_cache')
      .upsert(
        { cache_key: key, data: entry, last_date: lastDate, updated_at: new Date().toISOString() },
        { onConflict: 'cache_key' }
      )
  } catch {
    // silently ignore write errors — data will still be returned from memory
  }
}

// ─── Alias tickers ────────────────────────────────────────────────────────────
const HIST_TICKER_MAP: Record<string, string> = {
  'XAUUSD=X': 'GC=F', 'XAGUSD=X': 'SI=F',
  'XPTUSD=X': 'PL=F', 'XPDUSD=X': 'PA=F',
  'MGC=F': 'GC=F',    'MGI=F': 'SI=F',
}

const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://finance.yahoo.com/',
  'Origin': 'https://finance.yahoo.com',
}

// ─── Fetch depuis Yahoo Finance (avec fromDate optionnel pour fetch incrémental) ──
async function fetchFromYahoo(ticker: string, fromDate?: string): Promise<HistEntry | null> {
  try {
    const now = Math.floor(Date.now() / 1000)
    const start = fromDate
      ? Math.floor(new Date(fromDate).getTime() / 1000)
      : now - 25 * 365 * 24 * 3600 // 25 ans par défaut

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}` +
      `?period1=${start}&period2=${now}&interval=1d&includePrePost=false&events=div`

    const res = await fetch(url, { headers: YF_HEADERS, signal: AbortSignal.timeout(15000) })
    if (!res.ok) return null

    const json = await res.json()
    const result = json?.chart?.result?.[0]
    if (!result) return null

    const timestamps: number[] = result.timestamp ?? []
    const adjCloses: (number | null)[] =
      result.indicators?.adjclose?.[0]?.adjclose ??
      result.indicators?.quote?.[0]?.close ?? []

    const dates: string[] = []
    const closes: number[] = []

    for (let i = 0; i < timestamps.length; i++) {
      const c = adjCloses[i]
      if (c == null || c <= 0) continue
      const dateStr = new Date(timestamps[i] * 1000).toISOString().slice(0, 10)
      dates.push(dateStr)
      closes.push(c)
    }

    if (dates.length === 0) return null

    // ── Dividendes ────────────────────────────────────────────────────────────
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
  } catch {
    return null
  }
}

// ─── Logique interne : L1 → L2 → Yahoo (incrémental si possible) ─────────────
async function _doFetchHistory(ticker: string): Promise<HistEntry | null> {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)

  // L2 : Supabase
  const stored = await sbGet(ticker)

  if (stored) {
    // Si les données sont à jour (last_date >= hier), pas besoin d'appeler Yahoo
    if (stored.lastDate >= yesterdayStr) {
      _memCache.set(ticker, stored.entry)
      return stored.entry
    }

    // Fetch incrémental : seulement depuis le dernier jour connu
    const fresh = await fetchFromYahoo(ticker, stored.lastDate)

    if (fresh && fresh.dates.length > 0) {
      // Fusionner les nouvelles données avec celles stockées
      const storedDateSet = new Set(stored.entry.dates)
      const newDates: string[] = []
      const newCloses: number[] = []

      for (let i = 0; i < fresh.dates.length; i++) {
        if (!storedDateSet.has(fresh.dates[i])) {
          newDates.push(fresh.dates[i])
          newCloses.push(fresh.closes[i])
        }
      }

      const merged: HistEntry = {
        dates: [...stored.entry.dates, ...newDates],
        closes: [...stored.entry.closes, ...newCloses],
        dividendTTM: fresh.dividendTTM,
        dividends: fresh.dividends.length > 0 ? fresh.dividends : stored.entry.dividends,
      }

      _memCache.set(ticker, merged)
      sbSet(ticker, merged) // async, pas d'await
      return merged
    }

    // Si Yahoo échoue pour le delta, retourner les données stockées quand même
    _memCache.set(ticker, stored.entry)
    return stored.entry
  }

  // L3 : fetch complet depuis Yahoo Finance (aucune donnée en cache)
  const full = await fetchFromYahoo(ticker)
  if (!full) return null

  _memCache.set(ticker, full)
  sbSet(ticker, full) // async, pas d'await
  return full
}

// ─── Point d'entrée avec déduplication ───────────────────────────────────────
// Si plusieurs requêtes simultanées demandent le même ticker (3 charts qui chargent
// en même temps), une seule requête Yahoo est faite — les autres attendent la même Promise.
async function fetchHistory(ticker: string): Promise<HistEntry | null> {
  // L1 : mémoire (plus rapide que tout)
  if (_memCache.has(ticker)) return _memCache.get(ticker)!

  // Déduplication : si un fetch est déjà en cours pour ce ticker, attendre son résultat
  if (_fetchInProgress.has(ticker)) return _fetchInProgress.get(ticker)!

  const promise = _doFetchHistory(ticker)
  _fetchInProgress.set(ticker, promise)
  promise.finally(() => _fetchInProgress.delete(ticker))
  return promise
}

export async function GET(req: NextRequest) {
  const tickers = (req.nextUrl.searchParams.get('tickers') ?? '')
    .split(',')
    .map(t => t.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 40)

  if (tickers.length === 0) return NextResponse.json({})

  const entries = await Promise.all(
    tickers.map(async t => {
      const fetchTicker = HIST_TICKER_MAP[t] ?? t
      return [t, await fetchHistory(fetchTicker)] as const
    })
  )

  const results = Object.fromEntries(entries.filter(([, v]) => v !== null))

  return NextResponse.json(results, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
