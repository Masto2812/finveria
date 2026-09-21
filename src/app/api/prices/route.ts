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
const TTL_CURRENT   = 15 * 60 * 1000  // 15 min
const TTL_FOREVER   = Infinity

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
// TWELVE DATA — source principale pour tous les actifs
// Env requis : TWELVE_DATA_KEY
//
// Formats de ticker utilisés dans cette API :
//   • Actions/ETF US   : "AAPL", "SPY"
//   • Actions intl     : "NESN" (SIX), "MC" (EPA) — plan payant requis
//   • Forex            : "USD/CHF", "EUR/CHF"
//   • Crypto           : "BTC/USD", "ETH/EUR"
//   • Métaux précieux  : "XAU/USD", "XAG/USD" (spot, disponible plan gratuit)
//   • Futures          : "CL1!", "GC1!" — plan payant requis
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
    // Prendre la valeur de clôture la plus proche de la date demandée
    const price = parseFloat(data.values[0].close)
    return isNaN(price) ? null : price
  } catch { return null }
}

// ─── Taux de change vers CHF via Twelve Data ─────────────────────────────────
// Convertit n'importe quelle devise → CHF
async function fetchFxToChf(devise: string, date?: string): Promise<number> {
  if (devise === 'CHF') return 1
  const symbol = `${devise}/CHF`
  const rate = date
    ? await fetchTwelveDataHistorical(symbol, date)
    : await fetchTwelveDataPrice(symbol)
  return rate ?? 1
}

// ─── CoinGecko — fallback pour les cryptos non couvertes ─────────────────────
// API publique, sans clé, 30 req/min. Aucune limite de plan.
const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', BNB: 'binancecoin', SOL: 'solana',
  XRP: 'ripple', ADA: 'cardano', AVAX: 'avalanche-2', DOT: 'polkadot',
  MATIC: 'matic-network', LINK: 'chainlink', UNI: 'uniswap', LTC: 'litecoin',
  BCH: 'bitcoin-cash', ALGO: 'algorand', XLM: 'stellar', ATOM: 'cosmos',
  FIL: 'filecoin', TRX: 'tron', DOGE: 'dogecoin', SHIB: 'shiba-inu',
  NEAR: 'near', APT: 'aptos', ARB: 'arbitrum', OP: 'optimism',
  SUI: 'sui', TON: 'the-open-network', PEPE: 'pepe', WLD: 'worldcoin-wld',
}

async function fetchCoinGeckoPrice(cgId: string, currency: string): Promise<number | null> {
  try {
    const curr = currency.toLowerCase()
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=${curr}`,
      { headers: { Accept: 'application/json' }, next: { revalidate: 0 } }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data[cgId]?.[curr] ?? null
  } catch { return null }
}

async function fetchCoinGeckoHistorical(cgId: string, currency: string, date: string): Promise<number | null> {
  try {
    const [year, month, day] = date.split('-')
    const cgDate = `${day}-${month}-${year}`
    const curr = currency.toLowerCase()
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${cgId}/history?date=${cgDate}&localization=false`,
      { headers: { Accept: 'application/json' }, next: { revalidate: 0 } }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data?.market_data?.current_price?.[curr] ?? null
  } catch { return null }
}

// ─── GoldAPI — fallback pour les métaux précieux spot ────────────────────────
// Utilisé si XAU/USD etc. n'est pas disponible sur le plan Twelve Data actuel.
async function fetchGoldAPIPrice(metal: string, currency: string): Promise<number | null> {
  const key = process.env.GOLDAPI_KEY
  if (!key) return null
  try {
    const res = await fetch(`https://www.goldapi.io/api/${metal}/${currency}`, {
      headers: { 'x-access-token': key, 'Content-Type': 'application/json' },
      next: { revalidate: 0 },
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.price ?? null
  } catch { return null }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DÉTECTION DU TYPE D'ACTIF à partir du ticker
// ─ Le ticker reçu ici est dans le format Twelve Data (ex. "BTC/USD", "XAU/USD")
// ═══════════════════════════════════════════════════════════════════════════════

const PRECIOUS_METALS = new Set(['XAU', 'XAG', 'XPT', 'XPD'])

function detectAssetType(ticker: string): 'crypto' | 'metal' | 'forex' | 'stock' {
  const parts = ticker.split('/')
  if (parts.length === 2) {
    const base = parts[0]
    if (PRECIOUS_METALS.has(base)) return 'metal'
    // Si la base ressemble à une crypto (2-10 lettres, pas une devise standard)
    const FIAT_CURRENCIES = new Set(['USD','EUR','GBP','JPY','CHF','AUD','CAD','CNY',
      'HKD','SGD','NZD','NOK','SEK','DKK','PLN','CZK','KRW','INR','MXN','BRL','ZAR','TRY'])
    if (!FIAT_CURRENCIES.has(base)) return 'crypto'
    return 'forex'
  }
  return 'stock'
}


// ─── Normalisation : convertit les anciens tickers Yahoo → format Twelve Data ─
// Permet la rétrocompatibilité avec les positions existantes en base de données.
// Exemples :
//   "BTC-USD"   → "BTC/USD"
//   "XAUUSD=X"  → "XAU/USD"
//   "EURUSD=X"  → "EUR/USD"
//   "AAPL.SW"   → "AAPL" (le suffixe de bourse est ignoré sur plan gratuit)
//   "GC=F"      → null (futures non supportés sur plan gratuit)
function normalizeTicker(raw: string): string | null {
  // Crypto Yahoo : "BTC-USD" → "BTC/USD"
  const cryptoYahoo = raw.match(/^([A-Z]{2,10})-([A-Z]{3,4})$/)
  if (cryptoYahoo) return `${cryptoYahoo[1]}/${cryptoYahoo[2]}`

  // Forex/Métaux Yahoo : "XAUUSD=X", "EURUSD=X" → "XAU/USD", "EUR/USD"
  const fxYahoo = raw.match(/^([A-Z]{3,4})([A-Z]{3})=X$/)
  if (fxYahoo) return `${fxYahoo[1]}/${fxYahoo[2]}`

  // Actions suisses Yahoo : "NESN.SW", "AAPL.VX" → "NESN", "AAPL"
  // (l'exchange sera ignoré sur le plan gratuit ; à améliorer sur plan payant)
  const swissYahoo = raw.match(/^([A-Z0-9]+)\.(SW|VX|BX)$/i)
  if (swissYahoo) return swissYahoo[1].toUpperCase()

  // Futures Yahoo : "GC=F", "CL=F" — non supportés sur le plan gratuit Twelve Data
  // Retourne null pour signaler l'incompatibilité.
  if (raw.endsWith('=F')) return null

  // Format déjà correct (ex. "AAPL", "BTC/USD", "XAU/USD")
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

  // Normaliser le ticker (rétrocompatibilité Yahoo Finance → Twelve Data)
  const normalizedTicker = normalizeTicker(ticker)
  if (normalizedTicker === null) {
    // Futures non supportés sur le plan actuel
    return NextResponse.json({ ticker, devise, price: null, fxRate: 1, date, source: 'unsupported', error: 'Futures non supportés sur le plan Twelve Data actuel' })
  }
  const effectiveTicker = normalizedTicker

  const cacheKey     = `td|${ticker}|${devise}|${date ?? 'now'}`
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

  // ── Fetch depuis la source ────────────────────────────────────────────────
  const assetType = detectAssetType(effectiveTicker)
  let price: number | null = null
  let fxRate = 1
  let source = 'twelvedata'

  if (assetType === 'crypto') {
    // Crypto : Twelve Data en priorité, CoinGecko en fallback
    const parts = effectiveTicker.split('/')
    const coinSymbol = parts[0]
    const quoteCurrency = parts[1] ?? 'USD'

    price = date
      ? await fetchTwelveDataHistorical(effectiveTicker, date)
      : await fetchTwelveDataPrice(effectiveTicker)

    if (price === null) {
      // Fallback CoinGecko
      const cgId = COINGECKO_IDS[coinSymbol]
      if (cgId) {
        price = date
          ? await fetchCoinGeckoHistorical(cgId, quoteCurrency, date)
          : await fetchCoinGeckoPrice(cgId, quoteCurrency)
        if (price !== null) source = 'coingecko'
      }
    }

    // Taux de change quote → CHF
    fxRate = await fetchFxToChf(quoteCurrency, date)

  } else if (assetType === 'metal') {
    // Métaux précieux : Twelve Data en priorité, GoldAPI en fallback
    const parts  = effectiveTicker.split('/')
    const metal  = parts[0]          // ex. "XAU"
    const quoteCurrency = parts[1] ?? 'USD'  // ex. "USD"

    price = date
      ? await fetchTwelveDataHistorical(effectiveTicker, date)
      : await fetchTwelveDataPrice(effectiveTicker)

    if (price === null && !date) {
      // Fallback GoldAPI pour prix spot
      price = await fetchGoldAPIPrice(metal, quoteCurrency)
      if (price !== null) source = 'goldapi'
    }

    fxRate = await fetchFxToChf(quoteCurrency, date)

  } else if (assetType === 'forex') {
    // Forex : Twelve Data (ex. "USD/CHF")
    price = date
      ? await fetchTwelveDataHistorical(effectiveTicker, date)
      : await fetchTwelveDataPrice(effectiveTicker)

    // Pour le forex, fxRate = 1 car le prix EST déjà le taux de change
    fxRate = 1

  } else {
    // Actions & ETF (ex. "AAPL", "NESN", "SPY")
    price = date
      ? await fetchTwelveDataHistorical(effectiveTicker, date)
      : await fetchTwelveDataPrice(effectiveTicker)

    // Taux de change de la devise de l'action → CHF
    fxRate = await fetchFxToChf(devise, date)
  }

  const payload = { ticker, devise, price, fxRate, date, source }
  return respond(payload, cacheKey, isHistorical)
}

// ─── Respond : cache L1 + L2 + réponse HTTP ──────────────────────────────────
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
