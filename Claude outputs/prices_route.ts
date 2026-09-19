import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ─── Client Supabase (service role, server uniquement) ────────────────────────
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

// ─── Cache L1 : mémoire serveur (par instance) ────────────────────────────────
// Évite les round-trips Supabase sur les requêtes répétées dans la même instance
const _memCache = new Map<string, { data: object; expiresAt: number }>()
const TTL_CURRENT = 15 * 60 * 1000   // 15 min pour les prix temps réel
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

// ─── Cache L2 : Supabase (persistant, partagé entre toutes les instances) ─────
async function sbGet(key: string): Promise<object | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('price_cache')
      .select('data, expires_at')
      .eq('cache_key', key)
      .single()
    if (error || !data) return null
    // Vérifier expiration si applicable
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      // Supprimer en arrière-plan sans bloquer
      supabaseAdmin.from('price_cache').delete().eq('cache_key', key).then(() => {})
      return null
    }
    return data.data as object
  } catch { return null }
}

function sbSet(key: string, payload: object, isHistorical: boolean) {
  // Fire-and-forget : ne bloque pas la réponse
  const expiresAt = isHistorical
    ? null  // Les prix historiques n'expirent jamais
    : new Date(Date.now() + TTL_CURRENT).toISOString()

  supabaseAdmin.from('price_cache').upsert({
    cache_key: key,
    data: payload,
    expires_at: expiresAt,
  }, { onConflict: 'cache_key' }).then(() => {})
}


// ─── Configuration API ────────────────────────────────────────────────────────
// Variables d'environnement requises dans .env.local :
//   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY=eyJ...
//   GOLDAPI_KEY=votre_clé_goldapi
//   TWELVE_DATA_KEY=votre_clé_twelvedata

// ─── FX symbols Yahoo (devise → CHF) ─────────────────────────────────────────
const FX_SYMBOL: Record<string, string> = {
  USD: 'USDCHF=X', EUR: 'EURCHF=X', GBP: 'GBPCHF=X', JPY: 'JPYCHF=X',
  AUD: 'AUDCHF=X', CAD: 'CADCHF=X', CNY: 'CNYCHF=X', HKD: 'HKDCHF=X',
  SGD: 'SGDCHF=X', NZD: 'NZDCHF=X', NOK: 'NOKCHF=X', SEK: 'SEKCHF=X',
  DKK: 'DKKCHF=X', PLN: 'PLNCHF=X', CZK: 'CZKCHF=X', KRW: 'KRWCHF=X',
  INR: 'INRCHF=X', MXN: 'MXNCHF=X', BRL: 'BRLCHF=X', ZAR: 'ZARCHF=X',
  TRY: 'TRYCHF=X',
}

// ─── Alias tickers pour données historiques ──────────────────────────────────
const HIST_TICKER_MAP: Record<string, string> = {
  'XAUUSD=X': 'GC=F', 'XAGUSD=X': 'SI=F',
  'XPTUSD=X': 'PL=F', 'XPDUSD=X': 'PA=F',
  'MGC=F':    'GC=F', 'MGI=F':    'SI=F',
}

// ─── CoinGecko IDs ────────────────────────────────────────────────────────────
const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin',       ETH: 'ethereum',      BNB: 'binancecoin',
  SOL: 'solana',        XRP: 'ripple',         ADA: 'cardano',
  AVAX: 'avalanche-2',  DOT: 'polkadot',       MATIC: 'matic-network',
  LINK: 'chainlink',    UNI: 'uniswap',        LTC: 'litecoin',
  BCH: 'bitcoin-cash',  ALGO: 'algorand',      XLM: 'stellar',
  ATOM: 'cosmos',       FIL: 'filecoin',       TRX: 'tron',
  DOGE: 'dogecoin',     SHIB: 'shiba-inu',     NEAR: 'near',
  APT: 'aptos',         ARB: 'arbitrum',       OP: 'optimism',
  SUI: 'sui',           TON: 'the-open-network', PEPE: 'pepe',
  WLD: 'worldcoin-wld',
}
const CG_SUPPORTED = new Set(['usd','eur','chf','gbp','jpy','aud','cad','cny','hkd','sgd','nzd','nok','sek','dkk','pln'])

// ─── Routing : détecter le type de ticker ────────────────────────────────────
function parseCrypto(ticker: string): { symbol: string; currency: string } | null {
  const m = ticker.match(/^([A-Z]{2,10})-([A-Z]{3,4})$/)
  return m ? { symbol: m[1], currency: m[2] } : null
}

const PRECIOUS_METALS = new Set(['XAU', 'XAG', 'XPT', 'XPD'])
function parseMetal(ticker: string): { metal: string; currency: string } | null {
  const m = ticker.match(/^(XAU|XAG|XPT|XPD)([A-Z]{3})=X$/)
  return m && PRECIOUS_METALS.has(m[1]) ? { metal: m[1], currency: m[2] } : null
}

const isFuture = (ticker: string) => ticker.endsWith('=F')
const isForex  = (ticker: string) => ticker.endsWith('=X')
const isSwiss  = (ticker: string) => /\.(SW|VX|BX)$/i.test(ticker)

// ─── Yahoo Finance ────────────────────────────────────────────────────────────
async function fetchYahoo(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 0 } }
    )
    if (!res.ok) return null
    const json = await res.json()
    const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice
    return typeof price === 'number' ? price : null
  } catch { return null }
}

async function fetchYahooHistorical(symbol: string, date: string): Promise<number | null> {
  const YF_HIST_HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Referer': 'https://finance.yahoo.com/' }
  try {
    const d = new Date(date)
    const period1 = Math.floor(d.getTime() / 1000)
    const period2daily = period1 + 86400 * 30
    const resd = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2daily}&interval=1d`,
      { headers: YF_HIST_HEADERS, next: { revalidate: 0 } }
    )
    if (resd.ok) {
      const jsond = await resd.json()
      const r0d = jsond?.chart?.result?.[0]
      const cd: (number | null)[] = r0d?.indicators?.adjclose?.[0]?.adjclose ?? r0d?.indicators?.quote?.[0]?.close ?? []
      const found = cd.find(v => v != null && v > 0)
      if (found != null) return found
    }
    const period1mo = period1 - 86400 * 45
    const period2mo = period1 + 86400 * 45
    const resm = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1mo}&period2=${period2mo}&interval=1mo`,
      { headers: YF_HIST_HEADERS, next: { revalidate: 0 } }
    )
    if (!resm.ok) return null
    const jsonm = await resm.json()
    const r0m = jsonm?.chart?.result?.[0]
    const timestamps: number[] = r0m?.timestamp ?? []
    const cm: (number | null)[] = r0m?.indicators?.adjclose?.[0]?.adjclose ?? r0m?.indicators?.quote?.[0]?.close ?? []
    let best: number | null = null, bestDiff = Infinity
    for (let i = 0; i < timestamps.length; i++) {
      const v = cm[i]
      if (v == null || v <= 0) continue
      const diff = Math.abs(timestamps[i] - period1)
      if (diff < bestDiff) { bestDiff = diff; best = v }
    }
    return best
  } catch { return null }
}

// ─── CoinGecko ────────────────────────────────────────────────────────────────
async function fetchCoinGecko(cgId: string, currency: string): Promise<{ price: number; fxRate: number } | null> {
  try {
    const curr = currency.toLowerCase()
    const vsCurrencies = curr === 'chf' ? 'chf' : `${curr},chf`
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=${vsCurrencies}`,
      { headers: { Accept: 'application/json' }, next: { revalidate: 0 } }
    )
    if (!res.ok) return null
    const data = await res.json()
    const coinData = data[cgId]
    if (!coinData) return null
    const price = coinData[curr] ?? null
    if (!price) return null
    const fxRate = curr === 'chf' ? 1 : (coinData['chf'] && price ? coinData['chf'] / price : 1)
    return { price, fxRate }
  } catch { return null }
}

async function fetchCoinGeckoHistorical(cgId: string, currency: string, date: string): Promise<{ price: number; fxRate: number } | null> {
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
    const prices = data?.market_data?.current_price
    if (!prices) return null
    const price = prices[curr] ?? null
    if (!price) return null
    const fxRate = curr === 'chf' ? 1 : (prices['chf'] && price ? prices['chf'] / price : 1)
    return { price, fxRate }
  } catch { return null }
}

// ─── GoldAPI.io ───────────────────────────────────────────────────────────────
async function fetchGoldAPI(metal: string, currency: string, fxRateFn: () => Promise<number | null>): Promise<{ price: number; fxRate: number } | null> {
  const key = process.env.GOLDAPI_KEY
  if (!key) return null
  try {
    const res = await fetch(`https://www.goldapi.io/api/${metal}/${currency}`, {
      headers: { 'x-access-token': key, 'Content-Type': 'application/json' },
      next: { revalidate: 0 },
    })
    if (!res.ok) return null
    const data = await res.json()
    const price = data.price ?? null
    if (!price) return null
    const fxRate = currency === 'CHF' ? 1 : (await fxRateFn() ?? 1)
    return { price, fxRate }
  } catch { return null }
}

// ─── Twelve Data ──────────────────────────────────────────────────────────────
async function fetchTwelveData(symbol: string): Promise<number | null> {
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
      `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&start_date=${date}&end_date=${endStr}&outputsize=1&apikey=${key}`,
      { next: { revalidate: 0 } }
    )
    if (!res.ok) return null
    const data = await res.json()
    if (data.status === 'error' || !data.values?.[0]?.close) return null
    const price = parseFloat(data.values[0].close)
    return isNaN(price) ? null : price
  } catch { return null }
}

// ─── Handler principal ────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const ticker = searchParams.get('ticker')?.trim().toUpperCase()
  const devise  = searchParams.get('devise')?.trim().toUpperCase()
  const date    = searchParams.get('date')?.trim()

  if (!ticker || !devise) {
    return NextResponse.json({ error: 'Paramètres manquants : ticker et devise requis' }, { status: 400 })
  }

  const cacheKey   = `${ticker}|${devise}|${date ?? 'now'}`
  const isHistorical = !!date

  // ── L1 : Cache mémoire (instant) ─────────────────────────────────────────
  const memHit = memGet(cacheKey)
  if (memHit) return NextResponse.json(memHit, { headers: { 'X-Cache': 'MEM-HIT' } })

  // ── L2 : Cache Supabase (partagé entre instances) ────────────────────────
  const sbHit = await sbGet(cacheKey)
  if (sbHit) {
    // Réchauffer le cache mémoire
    memSet(cacheKey, sbHit, isHistorical ? TTL_FOREVER : TTL_CURRENT)
    return NextResponse.json(sbHit, { headers: { 'X-Cache': 'SB-HIT' } })
  }

  // ── L3 : Fetch depuis la source ───────────────────────────────────────────
  const fxYahooSymbol  = FX_SYMBOL[devise] ?? ''
  const fxFromYahoo    = () => devise === 'CHF' ? Promise.resolve(1) : fetchYahoo(fxYahooSymbol)
  const fxFromYahooHist = (d: string) => devise === 'CHF' ? Promise.resolve(1) : fetchYahooHistorical(fxYahooSymbol, d)

  // 1. Crypto spot → CoinGecko
  const cryptoParsed = parseCrypto(ticker)
  if (cryptoParsed) {
    const { symbol, currency } = cryptoParsed
    const cgId = COINGECKO_IDS[symbol]
    if (cgId && CG_SUPPORTED.has(currency.toLowerCase())) {
      const [cgResult, fxRate] = await Promise.all([
        date ? fetchCoinGeckoHistorical(cgId, currency, date) : fetchCoinGecko(cgId, currency),
        date ? fxFromYahooHist(date) : fxFromYahoo(),
      ])
      if (cgResult) {
        return respond({ ticker, devise: currency, price: cgResult.price, fxRate, date, source: 'coingecko' }, cacheKey, isHistorical)
      }
    }
    const [price, fxRate] = await Promise.all([
      date ? fetchYahooHistorical(ticker, date) : fetchYahoo(ticker),
      date ? fxFromYahooHist(date) : fxFromYahoo(),
    ])
    return respond({ ticker, devise, price, fxRate, date, source: 'yahoo-fallback' }, cacheKey, isHistorical)
  }

  // 2. Métaux précieux → GoldAPI / Yahoo
  const metalParsed = parseMetal(ticker)
  if (metalParsed) {
    const { metal, currency } = metalParsed
    if (!date) {
      const result = await fetchGoldAPI(metal, currency, fxFromYahoo)
      if (result) {
        return respond({ ticker, devise: currency, price: result.price, fxRate: result.fxRate, date, source: 'goldapi' }, cacheKey, isHistorical)
      }
    }
    const histTickerMetal = (date && HIST_TICKER_MAP[ticker]) ? HIST_TICKER_MAP[ticker] : ticker
    const [price, fxRate] = await Promise.all([
      date ? fetchYahooHistorical(histTickerMetal, date) : fetchYahoo(ticker),
      date ? fxFromYahooHist(date) : fxFromYahoo(),
    ])
    return respond({ ticker, devise, price, fxRate, date, source: 'yahoo' }, cacheKey, isHistorical)
  }

  // 3. Futures → Yahoo Finance
  if (isFuture(ticker)) {
    const histTickerFut = (date && HIST_TICKER_MAP[ticker]) ? HIST_TICKER_MAP[ticker] : ticker
    const [price, fxRate] = await Promise.all([
      date ? fetchYahooHistorical(histTickerFut, date) : fetchYahoo(ticker),
      date ? fxFromYahooHist(date) : fxFromYahoo(),
    ])
    return respond({ ticker, devise, price, fxRate, date, source: 'yahoo' }, cacheKey, isHistorical)
  }

  // 4. Forex → Yahoo Finance
  if (isForex(ticker)) {
    const [price, fxRate] = await Promise.all([
      date ? fetchYahooHistorical(ticker, date) : fetchYahoo(ticker),
      date ? fxFromYahooHist(date) : fxFromYahoo(),
    ])
    return respond({ ticker, devise, price, fxRate, date, source: 'yahoo' }, cacheKey, isHistorical)
  }

  // 5. Actions SIX Swiss → Yahoo Finance
  if (isSwiss(ticker)) {
    const [price, fxRate] = await Promise.all([
      date ? fetchYahooHistorical(ticker, date) : fetchYahoo(ticker),
      date ? fxFromYahooHist(date) : fxFromYahoo(),
    ])
    return respond({ ticker, devise, price, fxRate, date, source: 'yahoo' }, cacheKey, isHistorical)
  }

  // 6. Actions/ETF US & internationaux → Twelve Data (déjà actif)
  const tdPrice = date
    ? await fetchTwelveDataHistorical(ticker, date)
    : await fetchTwelveData(ticker)

  if (tdPrice !== null) {
    const fxRate = date ? await fxFromYahooHist(date) : await fxFromYahoo()
    return respond({ ticker, devise, price: tdPrice, fxRate, date, source: 'twelvedata' }, cacheKey, isHistorical)
  }

  // 7. Fallback Yahoo Finance
  const [price, fxRate] = await Promise.all([
    date ? fetchYahooHistorical(ticker, date) : fetchYahoo(ticker),
    date ? fxFromYahooHist(date) : fxFromYahoo(),
  ])
  return respond({ ticker, devise, price, fxRate, date, source: 'yahoo-fallback' }, cacheKey, isHistorical)
}

// ─── Respond : cache L1 + L2 + réponse HTTP ───────────────────────────────────
function respond(data: object, cacheKey: string, isHistorical: boolean) {
  // L1 : mémoire
  memSet(cacheKey, data, isHistorical ? TTL_FOREVER : TTL_CURRENT)
  // L2 : Supabase (fire-and-forget, ne bloque pas)
  sbSet(cacheKey, data, isHistorical)
  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=60',
      'X-Cache': 'MISS',
    },
  })
}
