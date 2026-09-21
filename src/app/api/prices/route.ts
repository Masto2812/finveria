import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ─── Client Supabase ──────────────────────────────────────────────────────────
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

// ─── Cache L1 : mémoire serveur (par instance) ────────────────────────────────
const _memCache = new Map<string, { data: object; expiresAt: number }>()
const TTL_CURRENT = 15 * 60 * 1000
const TTL_FOREVER = Infinity

function memGet(key: string): object | null {
  const e = _memCache.get(key)
  if (!e) return null
  if (Date.now() > e.expiresAt) { _memCache.delete(key); return null }
  return e.data
}
function memSet(key: string, data: object, ttl: number) {
  _memCache.set(key, { data, expiresAt: ttl === Infinity ? Infinity : Date.now() + ttl })
}

// ─── Cache L2 : Supabase (partagé entre instances) ───────────────────────────
async function sbGet(key: string): Promise<object | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('price_cache')
      .select('data, expires_at')
      .eq('cache_key', key)
      .single()
    if (error || !data) return null
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      supabaseAdmin.from('price_cache').delete().eq('cache_key', key).then(() => {})
      return null
    }
    return data.data as object
  } catch { return null }
}

function sbSet(key: string, payload: object, isHistorical: boolean) {
  const expiresAt = isHistorical
    ? null
    : new Date(Date.now() + TTL_CURRENT).toISOString()
  supabaseAdmin.from('price_cache').upsert({
    cache_key: key,
    data: payload,
    expires_at: expiresAt,
  }, { onConflict: 'cache_key' }).then(() => {})
}

// ═══════════════════════════════════════════════════════════════════════════════
// TWELVE DATA — source unique pour tous les actifs
// Env requis : TWELVE_DATA_KEY
//
// Formats de ticker :
//   Stocks/ETF US  : "AAPL", "SPY"
//   Forex          : "USD/CHF", "EUR/CHF"
//   Crypto         : "BTC/USD", "ETH/EUR"
//   Métaux spot    : "XAU/USD", "XAG/USD"
//   Stocks intl    : "NESN:SIX" (plan payant)
//   Futures        : "CL1!", "GC1!" (plan payant)
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchTwelveDataPrice(symbol: string): Promise<number | null> {
  const key = process.env.TWELVE_DATA_KEY
  if (!key) return null
  try {
    const res = await fetch(
      `https://api.twelvedata.com/price?symbol=${encodeURIComponent(symbol)}&apikey=${key}`,
      { next: { revalidate: 0 } }
    )
    if (!res.ok) return null
    const data = await res.json()
    if (data.status === 'error' || !data.price) return null
    const price = parseFloat(data.price)
    return isNaN(price) ? null : price
  } catch { return null }
}

async function fetchTwelveDataHistorical(symbol: string, date: string): Promise<number | null> {
  const key = process.env.TWELVE_DATA_KEY
  if (!key) return null
  try {
    const endDate = new Date(date)
    endDate.setDate(endDate.getDate() + 7)
    const endStr = endDate.toISOString().slice(0, 10)
    const res = await fetch(
      `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&start_date=${date}&end_date=${endStr}&outputsize=5&apikey=${key}`,
      { next: { revalidate: 0 } }
    )
    if (!res.ok) return null
    const data = await res.json()
    if (data.status === 'error' || !data.values?.length) return null
    const price = parseFloat(data.values[0].close)
    return isNaN(price) ? null : price
  } catch { return null }
}

// ─── Taux de change vers CHF via Twelve Data ─────────────────────────────────
async function fetchFxToChf(devise: string, date?: string): Promise<number> {
  if (devise === 'CHF') return 1
  const symbol = `${devise}/CHF`
  const rate = date
    ? await fetchTwelveDataHistorical(symbol, date)
    : await fetchTwelveDataPrice(symbol)
  return rate ?? 1
}

// ─── Normalisation : anciens tickers Yahoo → format Twelve Data ───────────────
// Rétrocompatibilité pour les positions déjà stockées en base de données.
//   "BTC-USD"   → "BTC/USD"
//   "XAUUSD=X"  → "XAU/USD"
//   "EURUSD=X"  → "EUR/USD"
//   "AAPL.SW"   → "AAPL"
//   "GC=F"      → null (futures non supportés sur plan gratuit)
function normalizeTicker(raw: string): string | null {
  // Crypto Yahoo : "BTC-USD" → "BTC/USD"
  const cryptoYahoo = raw.match(/^([A-Z]{2,10})-([A-Z]{3,4})$/)
  if (cryptoYahoo) return `${cryptoYahoo[1]}/${cryptoYahoo[2]}`

  // Forex/Métaux Yahoo : "XAUUSD=X", "EURUSD=X" → "XAU/USD", "EUR/USD"
  const fxYahoo = raw.match(/^([A-Z]{3,4})([A-Z]{3})=X$/)
  if (fxYahoo) return `${fxYahoo[1]}/${fxYahoo[2]}`

  // Actions suisses Yahoo : "NESN.SW" → "NESN"
  const swissYahoo = raw.match(/^([A-Z0-9]+)\.(SW|VX|BX)$/i)
  if (swissYahoo) return swissYahoo[1].toUpperCase()

  // Futures Yahoo : "GC=F" — non supportés sur le plan actuel
  if (raw.endsWith('=F')) return null

  // Déjà au bon format : "AAPL", "BTC/USD", "XAU/USD"
  return raw
}

// ─── Handler principal ────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const ticker = searchParams.get('ticker')?.trim().toUpperCase()
  const devise  = searchParams.get('devise')?.trim().toUpperCase() ?? 'USD'
  const date    = searchParams.get('date')?.trim()

  if (!ticker) {
    return NextResponse.json({ error: 'Paramètre manquant : ticker requis' }, { status: 400 })
  }

  const normalizedTicker = normalizeTicker(ticker)
  if (normalizedTicker === null) {
    return NextResponse.json({
      ticker, devise, price: null, fxRate: 1, date,
      source: 'unsupported',
      error: 'Cet actif nécessite un plan Twelve Data supérieur',
    })
  }

  const cacheKey     = `td|${normalizedTicker}|${devise}|${date ?? 'now'}`
  const isHistorical = !!date

  // ── Cache L1 mémoire ──────────────────────────────────────────────────────
  const memHit = memGet(cacheKey)
  if (memHit) return NextResponse.json(memHit, { headers: { 'X-Cache': 'MEM-HIT' } })

  // ── Cache L2 Supabase ─────────────────────────────────────────────────────
  const sbHit = await sbGet(cacheKey)
  if (sbHit) {
    memSet(cacheKey, sbHit, isHistorical ? TTL_FOREVER : TTL_CURRENT)
    return NextResponse.json(sbHit, { headers: { 'X-Cache': 'SB-HIT' } })
  }

  // ── Fetch Twelve Data ─────────────────────────────────────────────────────
  const price = date
    ? await fetchTwelveDataHistorical(normalizedTicker, date)
    : await fetchTwelveDataPrice(normalizedTicker)

  // Taux de change devise → CHF (pour calculer la valeur en CHF côté portfolio)
  // Pour le forex (ex. "USD/CHF"), le prix EST déjà le taux → fxRate = 1
  const isForexPair = normalizedTicker.includes('/')
    && (() => {
      const parts = normalizedTicker.split('/')
      const FIAT = new Set(['USD','EUR','GBP','JPY','CHF','AUD','CAD','CNY','HKD',
        'SGD','NZD','NOK','SEK','DKK','PLN','CZK','KRW','INR','MXN','BRL','ZAR','TRY'])
      return FIAT.has(parts[0]) && FIAT.has(parts[1])
    })()

  const fxRate = isForexPair ? 1 : await fetchFxToChf(devise, date)

  const payload = { ticker, devise, price, fxRate, date, source: 'twelvedata' }
  return respond(payload, cacheKey, isHistorical)
}

// ─── Respond : cache + réponse HTTP ──────────────────────────────────────────
function respond(data: object, cacheKey: string, isHistorical: boolean) {
  memSet(cacheKey, data, isHistorical ? TTL_FOREVER : TTL_CURRENT)
  sbSet(cacheKey, data, isHistorical)
  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=60',
      'X-Cache': 'MISS',
    },
  })
}
