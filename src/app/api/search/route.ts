import { NextRequest, NextResponse } from 'next/server'

// ─── Configuration Twelve Data ────────────────────────────────────────────────
// Variable d'environnement : TWELVE_DATA_KEY=votre_clé
//
// Plan gratuit : 800 crédits/jour, 8 req/min
// Instruments disponibles sur le plan gratuit :
//   ✅ Actions US (NYSE, NASDAQ, NYSE American)
//   ✅ ETF US
//   ✅ Forex (toutes les paires majeures)
//   ✅ Crypto (toutes les paires majeures)
//   ✅ Indices US
//
// Plan payant (à activer dans TWELVE_DATA_ENABLED_EXCHANGES ci-dessous) :
//   → Actions internationales : SIX, XETRA, LSE, EPA, TSX, ASX…
//   → Matières premières / futures : COMEX, CME, CBOT…
//   → ETF internationaux

// ─── Exchanges autorisés selon votre plan ────────────────────────────────────
// IMPORTANT : symbol_search ne supporte pas le filtre exchange en paramètre URL.
// Le filtre est appliqué côté serveur sur les résultats retournés par Twelve Data.
// null = aucun filtre (tout accepter — utile une fois sur plan payant)
//
// Plan gratuit : exchanges US uniquement
const ENABLED_EXCHANGES: Set<string> | null = new Set([
  'NYSE',           // New York Stock Exchange
  'NASDAQ',         // Nasdaq
  'NYSE American',  // AMEX (petites caps US)
  'NYSE Arca',      // NYSE Arca (SPY, QQQ, EFA, VWO…)
  'OTC',            // OTC Markets US
  'OTC Bulletin Board', // OTC BB
  // ── Activer lors du passage au plan payant ────────────────────────────────
  // 'SIX',         // Bourse suisse (NESN.SW, ROG.SW, NOVN.SW...)
  // 'XETRA',       // Deutsche Boerse (SAP.DE, SIE.DE, BAS.DE...)
  // 'LSE',         // London Stock Exchange (SHEL.L, AZN.L...)
  // 'EURONEXT',    // Euronext Paris/Amsterdam/Bruxelles (MC.PA, ASML.AS...)
  // 'TSX',         // Toronto (SHOP.TO, RY.TO...)
  // 'ASX',         // Sydney (CBA.AX, BHP.AX...)
])

// Types pour lesquels on applique le filtre exchange (pas pour crypto/forex/indices)
const EXCHANGE_FILTERED_TYPES = new Set([
  'Common Stock', 'ETF', 'ETC', 'ETN', 'Mutual Fund',
])

// ─── Types d'instruments à afficher dans la recherche ────────────────────────
// Ajouter ici les types au fur et à mesure que le plan les couvre.
const ENABLED_INSTRUMENT_TYPES = new Set([
  'Common Stock',
  'ETF',
  'Cryptocurrency',
  'Forex',
  'Index',
  'Mutual Fund',
  'ETC',
  'ETN',
])

// ─── Mapping : types Twelve Data → libellés Finveria ─────────────────────────
const TYPE_LABELS: Record<string, string> = {
  'Common Stock': 'Action',
  'ETF':          'ETF',
  'Cryptocurrency': 'Crypto',
  'Forex':        'Forex',
  'Index':        'Indice',
  'Mutual Fund':  'Fonds',
  'ETC':          'ETC',
  'ETN':          'ETN',
}

// ─── Noms des devises ─────────────────────────────────────────────────────────
const CURRENCY_NAMES: Record<string, string> = {
  USD: 'Dollar américain', EUR: 'Euro', GBP: 'Livre sterling',
  JPY: 'Yen japonais', CHF: 'Franc suisse', AUD: 'Dollar australien',
  CAD: 'Dollar canadien', CNY: 'Yuan chinois', HKD: 'Dollar de Hong Kong',
  SGD: 'Dollar de Singapour', NZD: 'Dollar néo-zélandais',
  NOK: 'Couronne norvégienne', SEK: 'Couronne suédoise', DKK: 'Couronne danoise',
  PLN: 'Złoty polonais', CZK: 'Couronne tchèque', KRW: 'Won coréen',
  INR: 'Roupie indienne', MXN: 'Peso mexicain', BRL: 'Real brésilien',
  ZAR: 'Rand sud-africain', TRY: 'Livre turque',
}

// ─── Noms des cryptos connus ──────────────────────────────────────────────────
const CRYPTO_NAMES: Record<string, string> = {
  BTC: 'Bitcoin', ETH: 'Ethereum', BNB: 'BNB', SOL: 'Solana',
  XRP: 'XRP (Ripple)', ADA: 'Cardano', AVAX: 'Avalanche', DOT: 'Polkadot',
  MATIC: 'Polygon', LINK: 'Chainlink', UNI: 'Uniswap', LTC: 'Litecoin',
  BCH: 'Bitcoin Cash', ALGO: 'Algorand', XLM: 'Stellar', ATOM: 'Cosmos',
  FIL: 'Filecoin', TRX: 'TRON', DOGE: 'Dogecoin', SHIB: 'Shiba Inu',
  NEAR: 'NEAR Protocol', APT: 'Aptos', ARB: 'Arbitrum', OP: 'Optimism',
  SUI: 'Sui', TON: 'Toncoin', PEPE: 'Pepe', WLD: 'Worldcoin',
}

// ─── Actifs statiques (toujours disponibles, peu importe le plan) ─────────────
// Ces actifs sont définis localement car soit Twelve Data ne les couvre pas sur
// le plan gratuit, soit ce sont des raccourcis pratiques pour l'utilisateur.
// Pour chaque actif, le ticker est celui utilisé dans /api/prices.
interface StaticAsset {
  ticker: string
  nom: string
  type: string
  devise: string
  bourse: string
}

const STATIC_ASSETS: StaticAsset[] = [
  // ── Métaux précieux (spot via GoldAPI, fallback Twelve Data) ──────────────
  { ticker: 'XAU/USD', nom: 'Or Spot (XAU/USD)',      type: 'Futures', devise: 'USD', bourse: 'Spot' },
  { ticker: 'XAG/USD', nom: 'Argent Spot (XAG/USD)',  type: 'Futures', devise: 'USD', bourse: 'Spot' },
  { ticker: 'XPT/USD', nom: 'Platine Spot (XPT/USD)', type: 'Futures', devise: 'USD', bourse: 'Spot' },
  { ticker: 'XPD/USD', nom: 'Palladium Spot (XPD/USD)', type: 'Futures', devise: 'USD', bourse: 'Spot' },

  // ── Énergie (Futures) — à activer si plan couvre les futures ──────────────
  // { ticker: 'CL1!',  nom: 'Pétrole brut WTI — Futures', type: 'Futures', devise: 'USD', bourse: 'CME' },
  // { ticker: 'BZ1!',  nom: 'Pétrole brut Brent — Futures', type: 'Futures', devise: 'USD', bourse: 'ICE' },
  // { ticker: 'NG1!',  nom: 'Gaz naturel — Futures', type: 'Futures', devise: 'USD', bourse: 'CME' },

  // ── Agricoles (Futures) — à activer si plan couvre les futures ────────────
  // { ticker: 'ZC1!', nom: 'Maïs — Futures', type: 'Futures', devise: 'USD', bourse: 'CBOT' },
  // { ticker: 'ZW1!', nom: 'Blé — Futures', type: 'Futures', devise: 'USD', bourse: 'CBOT' },
  // { ticker: 'ZS1!', nom: 'Soja — Futures', type: 'Futures', devise: 'USD', bourse: 'CBOT' },
]

// ─── Raccourcis clavier en français ──────────────────────────────────────────
const SHORTCUTS: { keys: string[]; result: StaticAsset }[] = [
  { keys: ['or', 'gold', 'xau'],       result: STATIC_ASSETS[0] },
  { keys: ['argent', 'silver', 'xag'], result: STATIC_ASSETS[1] },
  { keys: ['platine', 'platinum', 'xpt'], result: STATIC_ASSETS[2] },
  { keys: ['palladium', 'xpd'],        result: STATIC_ASSETS[3] },
  // Décommenter quand les futures sont activés :
  // { keys: ['petrole', 'wti', 'crude'],  result: STATIC_ASSETS[4] },
  // { keys: ['brent'],                    result: STATIC_ASSETS[5] },
  // { keys: ['gaz', 'gas'],               result: STATIC_ASSETS[6] },
]

function normalize(s: string): string {
  return s.toLowerCase()
    .replace(/[éèêë]/g, 'e').replace(/[àâä]/g, 'a')
    .replace(/[îï]/g, 'i').replace(/[ôö]/g, 'o')
    .replace(/[ùûü]/g, 'u').replace(/ç/g, 'c')
}

// ─── Enrichissement des noms ──────────────────────────────────────────────────
function enrichCryptoName(symbol: string, rawName: string): string {
  // symbol Twelve Data pour crypto : "BTC/USD"
  const m = symbol.match(/^([A-Z]{2,10})\/([A-Z]{3,4})$/)
  if (m) {
    const coinName = CRYPTO_NAMES[m[1]] ?? m[1]
    return `${coinName} (${m[1]}/${m[2]})`
  }
  return rawName
}

function enrichForexName(symbol: string, rawName: string): string {
  const m = symbol.match(/^([A-Z]{3})\/([A-Z]{3})$/)
  if (!m) return rawName
  const baseName  = CURRENCY_NAMES[m[1]] ?? m[1]
  const quoteName = CURRENCY_NAMES[m[2]] ?? m[2]
  return `${baseName} / ${quoteName} (${m[1]}/${m[2]})`
}

// ─── Extraction de la devise depuis un résultat Twelve Data ──────────────────
function extractDevise(symbol: string, currency: string): string {
  // Forex : "EUR/CHF" → devise = CHF
  const fxM = symbol.match(/\/([A-Z]{3,4})$/)
  if (fxM && CURRENCY_NAMES[fxM[1]]) return fxM[1]
  if (CURRENCY_NAMES[currency]) return currency
  return currency || 'USD'
}

// ─── Recherche Twelve Data ────────────────────────────────────────────────────
async function searchTwelveData(query: string): Promise<StaticAsset[]> {
  const key = process.env.TWELVE_DATA_KEY
  if (!key) return []

  try {
    const url = new URL('https://api.twelvedata.com/symbol_search')
    url.searchParams.set('symbol', query)
    url.searchParams.set('outputsize', '10')
    url.searchParams.set('apikey', key)
    // Note : symbol_search n'accepte pas de filtre exchange en paramètre URL.
    // Le filtre est appliqué sur les résultats (voir EXCHANGE_FILTERED_TYPES ci-dessus).

    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      next: { revalidate: 0 },
    })
    if (!res.ok) return []

    const json = await res.json()
    if (json.status === 'error' || !Array.isArray(json.data)) return []

    return json.data
      .filter((r: Record<string, string>) => {
        if (!ENABLED_INSTRUMENT_TYPES.has(r.instrument_type)) return false
        // Filtrer par exchange uniquement pour les types exchange-dépendants
        if (ENABLED_EXCHANGES && EXCHANGE_FILTERED_TYPES.has(r.instrument_type)) {
          return ENABLED_EXCHANGES.has(r.exchange)
        }
        return true
      })
      .map((r: Record<string, string>) => {
        const type   = TYPE_LABELS[r.instrument_type] ?? r.instrument_type
        const devise = extractDevise(r.symbol, r.currency)

        let nom = r.instrument_name || r.symbol
        if (r.instrument_type === 'Cryptocurrency') nom = enrichCryptoName(r.symbol, nom)
        if (r.instrument_type === 'Forex')          nom = enrichForexName(r.symbol, nom)

        return {
          ticker: r.symbol,
          nom,
          type,
          devise,
          bourse: r.exchange || r.mic_code || '',
        }
      })
  } catch {
    return []
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ results: [] })

  const qNorm = normalize(q)

  // 1. Raccourcis locaux (français / matières premières)
  const shortcuts = SHORTCUTS
    .filter(s => s.keys.some(k => k.startsWith(qNorm) || qNorm.startsWith(k)))
    .map(s => s.result)
  const shortcutTickers = new Set(shortcuts.map(s => s.ticker))

  // 2. Recherche Twelve Data
  const tdResults = (await searchTwelveData(q))
    .filter(r => !shortcutTickers.has(r.ticker))

  const results = [...shortcuts, ...tdResults]
  return NextResponse.json({ results })
}
