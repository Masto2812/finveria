import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ─── Client Supabase (service role, server uniquement) ────────────────────────
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

// ─── Cache L1 : mémoire serveur ───────────────────────────────────────────────
const _histCache = new Map<string, { data: HistEntry; expiresAt: number }>()
const TTL_HIST = 20 * 60 * 1000  // 20 min

interface HistEntry {
  dates: string[]
  closes: number[]
  dividendTTM: number
  dividends: { ts: number; amount: number }[]
}

function memGet(key: string): HistEntry | null {
  const e = _histCache.get(key)
  if (!e) return null
  if (Date.now() > e.expiresAt) { _histCache.delete(key); return null }
  return e.data
}
function memSet(key: string, data: HistEntry) {
  _histCache.set(key, { data, expiresAt: Date.now() + TTL_HIST })
}

// ─── Cache L2 : Supabase (partagé entre toutes les instances) ─────────────────
async function sbGet(key: string): Promise<HistEntry | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('hist_cache')
      .select('data, expires_at')
      .eq('cache_key', key)
      .single()
    if (error || !data) return null
    if (new Date(data.expires_at) < new Date()) {
      supabaseAdmin.from('hist_cache').delete().eq('cache_key', key).then(() => {})
      return null
    }
    return data.data as HistEntry
  } catch { return null }
}

function sbSet(key: string, payload: HistEntry) {
  const expiresAt = new Date(Date.now() + TTL_HIST).toISOString()
  supabaseAdmin.from('hist_cache').upsert({
    cache_key: key,
    data: payload,
    expires_at: expiresAt,
  }, { onConflict: 'cache_key' }).then(() => {})
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

async function fetchHistory(ticker: string): Promise<HistEntry | null> {
  // L1 : mémoire
  const memHit = memGet(ticker)
  if (memHit) return memHit

  // L2 : Supabase
  const sbHit = await sbGet(ticker)
  if (sbHit) { memSet(ticker, sbHit); return sbHit }

  // L3 : Yahoo Finance
  try {
    const now   = Math.floor(Date.now() / 1000)
    const start = now - 25 * 365 * 24 * 3600

    const url1d = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}` +
      `?period1=${start}&period2=${now}&interval=1d&includePrePost=false&events=div`

    const res = await fetch(url1d, { headers: YF_HEADERS, signal: AbortSignal.timeout(15000) })
    if (!res.ok) return null

    const json = await res.json()
    const result = json?.chart?.result?.[0]
    if (!result) return null

    const timestamps: number[] = result.timestamp ?? []
    const adjCloses: (number | null)[] =
      result.indicators?.adjclose?.[0]?.adjclose ??
      result.indicators?.quote?.[0]?.close ?? []

    const dates: string[] = [], closes: number[] = []
    for (let i = 0; i < timestamps.length; i++) {
      const c = adjCloses[i]
      if (c == null || c <= 0) continue
      dates.push(new Date(timestamps[i] * 1000).toISOString().slice(0, 10))
      closes.push(c)
    }
    if (dates.length === 0) return null

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

    const data: HistEntry = { dates, closes, dividendTTM, dividends }

    // Sauvegarder L1 + L2
    memSet(ticker, data)
    sbSet(ticker, data)

    return data
  } catch { return null }
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
    headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=300' },
  })
}
