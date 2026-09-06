import { NextRequest, NextResponse } from 'next/server'

// ─── Configuration API ────────────────────────────────────────────────────────
// Ajouter dans .env.local :
//   GOLDAPI_KEY=votre_clé_goldapi
//   TWELVE_DATA_KEY=votre_clé_twelvedata
//
// Inscription gratuite :
//   GoldAPI.io  → https://www.goldapi.io  (200 req/mois gratuit)
//   Twelve Data → https://twelvedata.com  (800 req/jour gratuit)

// ─── FX symbols Yahoo (devise → CHF, pour taux de conversion interne) ────────
const FX_SYMBOL: Record<string, string> = {
  USD: 'USDCHF=X', EUR: 'EURCHF=X', GBP: 'GBPCHF=X', JPY: 'JPYCHF=X',
  AUD: 'AUDCHF=X', CAD: 'CADCHF=X', CNY: 'CNYCHF=X', HKD: 'HKDCHF=X',
  SGD: 'SGDCHF=X', NZD: 'NZDCHF=X', NOK: 'NOKCHF=X', SEK: 'SEKCHF=X',
  DKK: 'DKKCHF=X', PLN: 'PLNCHF=X', CZK: 'CZKCHF=X', KRW: 'KRWCHF=X',
  INR: 'INRCHF=X', MXN: 'MXNCHF=X', BRL: 'BRLCHF=X', ZAR: 'ZARCHF=X',
  TRY: 'TRYCHF=X',
}

// ─── CoinGecko IDs ────────────────────────────────────────────────────────────
const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin',        ETH: 'ethereum',       BNB: 'binancecoin',
  SOL: 'solana',         XRP: 'ripple',          ADA: 'cardano',
  AVAX: 'avalanche-2',   DOT: 'polkadot',        MATIC: 'matic-network',
  LINK: 'chainlink',     UNI: 'uniswap',         LTC: 'litecoin',
  BCH: 'bitcoin-cash',   ALGO: 'algorand',       XLM: 'stellar',
  ATOM: 'cosmos',        FIL: 'filecoin',        TRX: 'tron',
  DOGE: 'dogecoin',      SHIB: 'shiba-inu',      NEAR: 'near',
  APT: 'aptos',          ARB: 'arbitrum',        OP: 'optimism',
  SUI: 'sui',            TON: 'the-open-network', PEPE: 'pepe',
  WLD: 'worldcoin-wld',
}
const CG_SUPPORTED = new Set(['usd','eur','chf','gbp','jpy','aud','cad','cny','hkd','sgd','nzd','nok','sek','dkk','pln'])

// ─── Routing : détecter le type de ticker ────────────────────────────────────

/** Crypto spot : BTC-EUR, ETH-USD, SOL-CHF */
function parseCrypto(ticker: string): { symbol: string; currency: string } | null {
  const m = ticker.match(/^([A-Z]{2,10})-([A-Z]{3,4})$/)
  return m ? { symbol: m[1], currency: m[2] } : null
}

/** Métaux précieux : XAUUSD=X, XAGUSD=X, XPTUSD=X, XPDUSD=X */
const PRECIOUS_METALS = new Set(['XAU', 'XAG', 'XPT', 'XPD'])
function parseMetal(ticker: string): { metal: string; currency: string } | null {
  const m = ticker.match(/^(XAU|XAG|XPT|XPD)([A-Z]{3})=X$/)
  return m && PRECIOUS_METALS.has(m[1]) ? { metal: m[1], currency: m[2] } : null
}

/** Futures (GC=F, CL=F, etc.) → Yahoo Finance */
const isFuture = (ticker: string) => ticker.endsWith('=F')

/** Forex/spot (EURUSD=X, USDCHF=X, etc.) → Yahoo Finance */
const isForex = (ticker: string) => ticker.endsWith('=X')

/** Bourse suisse SIX (NESN.SW, NOVN.SW, etc.) → Yahoo Finance */
const isSwiss = (ticker: string) => /\.(SW|VX|BX)$/i.test(ticker)

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
  try {
    const d = new Date(date)
    const period1 = Math.floor(d.getTime() / 1000)
    const period2 = period1 + 86400 * 7
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1d`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 0 } }
    )
    if (!res.ok) return null
    const json = await res.json()
    const closes: (number | null)[] = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []
    return closes.find(v => v != null && v > 0) ?? null
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
async function fetchGoldAPI(
  metal: string,
  currency: string,
  fxRateFn: () => Promise<number | null>
): Promise<{ price: number; fxRate: number } | null> {
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
    // Taux FX via Yahoo Finance (évite de doubler les appels GoldAPI)
    const fxRate = currency === 'CHF' ? 1 : (await fxRateFn() ?? 1)
    return { price, fxRate }
  } catch { return null }
}

// GoldAPI n'a pas d'endpoint historique simple — on retombe sur Yahoo
// pour les prix historiques des métaux

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
    // Cherche dans une fenêtre de 7 jours pour couvrir weekends/jours fériés
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

  const fxYahooSymbol = FX_SYMBOL[devise] ?? ''
  const fxFromYahoo   = () => devise === 'CHF' ? Promise.resolve(1) : fetchYahoo(fxYahooSymbol)
  const fxFromYahooHist = (d: string) => devise === 'CHF' ? Promise.resolve(1) : fetchYahooHistorical(fxYahooSymbol, d)

  // ── 1. Crypto spot → CoinGecko (prix) + Yahoo Finance (taux FX) ────────────
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
        return json({ ticker, devise: currency, price: cgResult.price, fxRate, date, source: 'coingecko' })
      }
    }
    // Fallback Yahoo si coin inconnu ou CoinGecko hors-ligne
    const [price, fxRate] = await Promise.all([
      date ? fetchYahooHistorical(ticker, date) : fetchYahoo(ticker),
      date ? fxFromYahooHist(date) : fxFromYahoo(),
    ])
    return json({ ticker, devise, price, fxRate, date, source: 'yahoo-fallback' })
  }

  // ── 2. Métaux précieux → GoldAPI.io ──────────────────────────────────────
  const metalParsed = parseMetal(ticker)
  if (metalParsed) {
    const { metal, currency } = metalParsed
    if (!date) {
      // Temps réel : GoldAPI en priorité
      const result = await fetchGoldAPI(metal, currency, fxFromYahoo)
      if (result) {
        return json({ ticker, devise: currency, price: result.price, fxRate: result.fxRate, date, source: 'goldapi' })
      }
    }
    // Historique ou fallback (GoldAPI sans endpoint historique) → Yahoo Finance
    const [price, fxRate] = await Promise.all([
      date ? fetchYahooHistorical(ticker, date) : fetchYahoo(ticker),
      date ? fxFromYahooHist(date) : fxFromYahoo(),
    ])
    return json({ ticker, devise, price, fxRate, date, source: 'yahoo' })
  }

  // ── 3. Futures (GC=F, CL=F…) → Yahoo Finance ─────────────────────────────
  if (isFuture(ticker)) {
    const [price, fxRate] = await Promise.all([
      date ? fetchYahooHistorical(ticker, date) : fetchYahoo(ticker),
      date ? fxFromYahooHist(date) : fxFromYahoo(),
    ])
    return json({ ticker, devise, price, fxRate, date, source: 'yahoo' })
  }

  // ── 4. Forex (EURUSD=X…) → Yahoo Finance ──────────────────────────────────
  if (isForex(ticker)) {
    const [price, fxRate] = await Promise.all([
      date ? fetchYahooHistorical(ticker, date) : fetchYahoo(ticker),
      date ? fxFromYahooHist(date) : fxFromYahoo(),
    ])
    return json({ ticker, devise, price, fxRate, date, source: 'yahoo' })
  }

  // ── 5. Actions SIX Swiss (.SW, .VX, .BX) → Yahoo Finance ─────────────────
  if (isSwiss(ticker)) {
    const [price, fxRate] = await Promise.all([
      date ? fetchYahooHistorical(ticker, date) : fetchYahoo(ticker),
      date ? fxFromYahooHist(date) : fxFromYahoo(),
    ])
    return json({ ticker, devise, price, fxRate, date, source: 'yahoo' })
  }

  // ── 6. Actions/ETF US et Europe → Twelve Data ────────────────────────────
  const tdPrice = date
    ? await fetchTwelveDataHistorical(ticker, date)
    : await fetchTwelveData(ticker)

  if (tdPrice !== null) {
    const fxRate = date ? await fxFromYahooHist(date) : await fxFromYahoo()
    return json({ ticker, devise, price: tdPrice, fxRate, date, source: 'twelvedata' })
  }

  // ── 7. Fallback Yahoo Finance ─────────────────────────────────────────────
  const [price, fxRate] = await Promise.all([
    date ? fetchYahooHistorical(ticker, date) : fetchYahoo(ticker),
    date ? fxFromYahooHist(date) : fxFromYahoo(),
  ])
  return json({ ticker, devise, price, fxRate, date, source: 'yahoo-fallback' })
}

function json(data: object) {
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=60' },
  })
}
