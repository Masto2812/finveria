import { NextRequest, NextResponse } from 'next/server'

// ─── Devises supportées ───────────────────────────────────────────────────────
const DEVISE_MAP: Record<string, string> = {
  CHF: 'CHF', USD: 'USD', EUR: 'EUR', GBP: 'GBP', JPY: 'JPY',
  AUD: 'AUD', CAD: 'CAD', CNY: 'CNY', HKD: 'HKD', SGD: 'SGD',
  NZD: 'NZD', NOK: 'NOK', SEK: 'SEK', DKK: 'DKK', PLN: 'PLN',
  CZK: 'CZK', KRW: 'KRW', INR: 'INR', MXN: 'MXN', BRL: 'BRL',
  ZAR: 'ZAR', TRY: 'TRY',
}

const CURRENCY_NAMES: Record<string, string> = {
  USD: 'Dollar américain', EUR: 'Euro', GBP: 'Livre sterling', JPY: 'Yen japonais',
  CHF: 'Franc suisse', AUD: 'Dollar australien', CAD: 'Dollar canadien',
  CNY: 'Yuan chinois', HKD: 'Dollar de Hong Kong', SGD: 'Dollar de Singapour',
  NZD: 'Dollar néo-zélandais', NOK: 'Couronne norvégienne', SEK: 'Couronne suédoise',
  DKK: 'Couronne danoise', PLN: 'Złoty polonais', CZK: 'Couronne tchèque',
  KRW: 'Won coréen', INR: 'Roupie indienne', MXN: 'Peso mexicain',
  BRL: 'Real brésilien', ZAR: 'Rand sud-africain', TRY: 'Livre turque',
}

const COMMODITY_NAMES: Record<string, string> = {
  XAU: 'Or', XAG: 'Argent', XPT: 'Platine', XPD: 'Palladium',
  XCU: 'Cuivre', XBR: 'Pétrole Brent', XTI: 'Pétrole WTI',
}

const FUTURES_NAMES: Record<string, string> = {
  'GC=F': 'Or — Futures (COMEX)',
  'SI=F': 'Argent — Futures (COMEX)',
  'PL=F': 'Platine — Futures',
  'PA=F': 'Palladium — Futures',
  'CL=F': 'Pétrole brut WTI — Futures',
  'BZ=F': 'Pétrole brut Brent — Futures',
  'NG=F': 'Gaz naturel — Futures',
  'ZC=F': 'Maïs — Futures',
  'ZW=F': 'Blé — Futures',
  'ZS=F': 'Soja — Futures',
  'HG=F': 'Cuivre — Futures',
  'ES=F': 'S&P 500 — Futures (E-mini)',
  'NQ=F': 'Nasdaq 100 — Futures (E-mini)',
  'YM=F': 'Dow Jones — Futures (E-mini)',
  'RTY=F': 'Russell 2000 — Futures',
  'VX=F': 'VIX — Futures',
  'BTC=F': 'Bitcoin — Futures (CME)',
  'ETH=F': 'Ethereum — Futures (CME)',
}

const CRYPTO_NAMES: Record<string, string> = {
  BTC: 'Bitcoin', ETH: 'Ethereum', BNB: 'BNB', SOL: 'Solana',
  XRP: 'XRP (Ripple)', ADA: 'Cardano', AVAX: 'Avalanche', DOT: 'Polkadot',
  MATIC: 'Polygon', LINK: 'Chainlink', UNI: 'Uniswap', LTC: 'Litecoin',
  BCH: 'Bitcoin Cash', ALGO: 'Algorand', XLM: 'Stellar', ATOM: 'Cosmos',
  FIL: 'Filecoin', TRX: 'TRON', DOGE: 'Dogecoin', SHIB: 'Shiba Inu',
  NEAR: 'NEAR Protocol', APT: 'Aptos', ARB: 'Arbitrum', OP: 'Optimism',
  SUI: 'Sui', TON: 'Toncoin', PEPE: 'Pepe', WLD: 'Worldcoin',
}

// ─── Détection métaux précieux spot (XAUUSD=X, XAGUSD=X, XPTUSD=X, XPDUSD=X) ─
const PRECIOUS_METALS = new Set(['XAU', 'XAG', 'XPT', 'XPD'])
function isPreciousMetal(ticker: string): boolean {
  const m = ticker.match(/^([A-Z]{3})([A-Z]{3})=X$/)
  return !!m && PRECIOUS_METALS.has(m[1])
}

// ─── Raccourcis français/anglais pour les matières premières ──────────────────
// Apparaissent en tête quand la requête commence par un de ces mots-clés
interface ShortcutEntry {
  ticker: string; nom: string; type: string; devise: string; bourse: string
}
const SHORTCUTS: { keys: string[]; result: ShortcutEntry }[] = [
  {
    keys: ['or', 'gold', 'xau', 'xauusd'],
    result: { ticker: 'XAUUSD=X', nom: 'Or Spot / Dollar américain (XAU/USD)', type: 'Futures', devise: 'USD', bourse: 'Forex' },
  },
  {
    keys: ['argent', 'silver', 'xag', 'xagusd'],
    result: { ticker: 'XAGUSD=X', nom: 'Argent Spot / Dollar américain (XAG/USD)', type: 'Futures', devise: 'USD', bourse: 'Forex' },
  },
  {
    keys: ['platine', 'platinum', 'xpt', 'xptusd'],
    result: { ticker: 'XPTUSD=X', nom: 'Platine Spot / Dollar américain (XPT/USD)', type: 'Futures', devise: 'USD', bourse: 'Forex' },
  },
  {
    keys: ['palladium', 'xpd', 'xpdusd'],
    result: { ticker: 'XPDUSD=X', nom: 'Palladium Spot / Dollar américain (XPD/USD)', type: 'Futures', devise: 'USD', bourse: 'Forex' },
  },
  {
    keys: ['petrole', 'petrol', 'wti', 'crude', 'cl=f'],
    result: { ticker: 'CL=F', nom: 'Pétrole brut WTI — Futures', type: 'Futures', devise: 'USD', bourse: 'CME' },
  },
  {
    keys: ['brent', 'bz=f'],
    result: { ticker: 'BZ=F', nom: 'Pétrole brut Brent — Futures', type: 'Futures', devise: 'USD', bourse: 'ICE' },
  },
  {
    keys: ['gaz', 'gas', 'natural gas', 'ng=f'],
    result: { ticker: 'NG=F', nom: 'Gaz naturel — Futures', type: 'Futures', devise: 'USD', bourse: 'CME' },
  },
  {
    keys: ['cuivre', 'copper', 'hg=f'],
    result: { ticker: 'HG=F', nom: 'Cuivre — Futures', type: 'Futures', devise: 'USD', bourse: 'COMEX' },
  },
  {
    keys: ['ble', 'wheat', 'zw=f'],
    result: { ticker: 'ZW=F', nom: 'Blé — Futures', type: 'Futures', devise: 'USD', bourse: 'CBOT' },
  },
  {
    keys: ['mais', 'corn', 'zc=f'],
    result: { ticker: 'ZC=F', nom: 'Maïs — Futures', type: 'Futures', devise: 'USD', bourse: 'CBOT' },
  },
]

function normalize(s: string): string {
  return s.toLowerCase()
    .replace(/[éèêë]/g, 'e').replace(/[àâä]/g, 'a').replace(/[îï]/g, 'i')
    .replace(/[ôö]/g, 'o').replace(/[ùûü]/g, 'u').replace(/ç/g, 'c')
}

// ─── Nom enrichi ──────────────────────────────────────────────────────────────
function enrichName(ticker: string, rawName: string, quoteType: string): string {
  if (quoteType === 'FUTURE' && FUTURES_NAMES[ticker]) return FUTURES_NAMES[ticker]

  const fxMatch = ticker.match(/^([A-Z]{3,4})([A-Z]{3})=X$/)
  if (fxMatch) {
    const [, base, quote] = fxMatch
    const baseName  = COMMODITY_NAMES[base]  ?? CURRENCY_NAMES[base]  ?? base
    const quoteName = COMMODITY_NAMES[quote] ?? CURRENCY_NAMES[quote] ?? quote
    // Métal précieux spot : nommer clairement
    if (PRECIOUS_METALS.has(base)) {
      return `${baseName} Spot / ${quoteName} (${base}/${quote})`
    }
    return `${baseName} / ${quoteName} (${base}/${quote})`
  }

  const cryptoMatch = ticker.match(/^([A-Z]{2,10})-([A-Z]{3,4})$/)
  if (cryptoMatch) {
    const [, coin, currency] = cryptoMatch
    const coinName = CRYPTO_NAMES[coin] ?? coin
    return `${coinName} (${coin}/${currency})`
  }

  return rawName
}

function inferDevise(ticker: string, currency: string): string {
  const cryptoMatch = ticker.match(/-([A-Z]{3,4})$/)
  if (cryptoMatch && DEVISE_MAP[cryptoMatch[1]]) return cryptoMatch[1]
  const fxMatch = ticker.match(/([A-Z]{3})=X$/)
  if (fxMatch && DEVISE_MAP[fxMatch[1]]) return fxMatch[1]
  return DEVISE_MAP[currency] ?? 'USD'
}

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ results: [] })

  const qNorm = normalize(q)

  // ── 1. Raccourcis matières premières ────────────────────────────────────────
  const shortcuts = SHORTCUTS
    .filter(s => s.keys.some(k => k.startsWith(qNorm) || qNorm.startsWith(k)))
    .map(s => s.result)
  const shortcutTickers = new Set(shortcuts.map(s => s.ticker))

  // ── 2. Yahoo Finance search ─────────────────────────────────────────────────
  let yahooResults: ShortcutEntry[] = []
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0&enableFuzzyQuery=true&enableCb=false`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    )
    if (res.ok) {
      const json = await res.json()
      const quotes = json?.quotes ?? []
      yahooResults = quotes
        .filter((r: Record<string, string>) =>
          ['EQUITY', 'ETF', 'CRYPTOCURRENCY', 'FUTURE', 'MUTUALFUND', 'CURRENCY'].includes(r.quoteType)
        )
        .filter((r: Record<string, string>) => !shortcutTickers.has(r.symbol))
        .map((r: Record<string, string>) => {
          const metal = isPreciousMetal(r.symbol)
          return {
            ticker: r.symbol,
            nom: enrichName(r.symbol, r.longname || r.shortname || r.symbol, r.quoteType),
            bourse: r.exchDisp || '',
            // Les métaux précieux spot sont reclassés en Futures pour correspondre
            // à la catégorie "Matières premières" du filtre portfolio
            type: metal ? 'Futures' : (r.typeDisp || ''),
            devise: inferDevise(r.symbol, r.currency),
            pays: r.exchDisp || '',
          }
        })
    }
  } catch { /* silencieux */ }

  const results = [...shortcuts, ...yahooResults]
  return NextResponse.json({ results })
}
