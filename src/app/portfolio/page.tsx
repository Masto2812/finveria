'use client'

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/Header'

// ─── Swiss CPI (IPC) — source : OFS / BFS ────────────────────────────────────
// Variations annuelles officielles de l'Indice des prix à la consommation suisse
const CPI_RATES: Record<number, number> = {
  1995: 0.018, 1996: 0.008, 1997: 0.005, 1998: 0.000, 1999: 0.008,
  2000: 0.016, 2001: 0.010, 2002: 0.006, 2003: 0.006, 2004: 0.008,
  2005: 0.012, 2006: 0.011, 2007: 0.007, 2008: 0.024, 2009: -0.005,
  2010: 0.007, 2011: 0.002, 2012: -0.007, 2013: -0.002, 2014: 0.000,
  2015: -0.011, 2016: -0.004, 2017: 0.005, 2018: 0.009, 2019: 0.004,
  2020: -0.007, 2021: 0.006, 2022: 0.028, 2023: 0.021, 2024: 0.011,
  2025: 0.003, // OFS jan–jun 2025 (glissement annuel moyen)
}

// Index CPI cumulatif (base 2020 = 100), calculé une seule fois au démarrage
const _CPI_INDEX: Record<number, number> = (() => {
  const idx: Record<number, number> = { 2020: 100 }
  for (let y = 2021; y <= 2035; y++) idx[y] = idx[y - 1] * (1 + (CPI_RATES[y] ?? 0.015))
  for (let y = 2019; y >= 1990; y--) idx[y] = idx[y + 1] / (1 + (CPI_RATES[y + 1] ?? 0.015))
  return idx
})()

// Valeur interpolée de l'IPC à une date donnée (fraction linéaire dans l'année)
// ─── Date helpers (format européen) ─────────────────────────────────────────
function fmtDate(iso: string): string {
  // YYYY-MM-DD → DD/MM/YYYY
  return iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4)
}
function fmtMonth(iso: string): string {
  // YYYY-MM or YYYY-MM-DD → MM/YYYY
  return iso.slice(5, 7) + '/' + iso.slice(0, 4)
}
function fmtDay(iso: string): string {
  // YYYY-MM-DD → DD/MM
  return iso.slice(8, 10) + '/' + iso.slice(5, 7)
}

function cpiAt(dateStr: string): number {
  const d = new Date(dateStr)
  const y = d.getFullYear()
  const frac = (d.getMonth() + d.getDate() / 30) / 12
  const base = _CPI_INDEX[y] ?? 100
  const next = _CPI_INDEX[y + 1] ?? base * (1 + (CPI_RATES[y] ?? 0.015))
  return base + frac * (next - base)
}

// Inflation cumulée entre une date d'achat et aujourd'hui
function inflationCumulee(dateAchat: string): number {
  return cpiAt(new Date().toISOString().slice(0, 10)) / cpiAt(dateAchat) - 1
}

// ─── Shared price cache ──────────────────────────────────────────────────────
const priceCache = new Map<string, { price: number; fxRate: number }>()
const historyCache = new Map<string, unknown>()
async function fetchHistory(tickers: string, bust = false): Promise<Record<string, unknown>> {
  const cacheKey = tickers + (bust ? ':bust' : '')
  if (!bust && historyCache.has(tickers)) return historyCache.get(tickers) as Record<string, unknown>
  const url = `/api/history?tickers=${encodeURIComponent(tickers)}${bust ? '&bust=1' : ''}`
  const res = await fetch(url)
  const data = await res.json()
  historyCache.set(tickers, data)
  historyCache.delete(cacheKey)
  return data
}

async function fetchPriceCached(ticker: string, devise: string, date?: string): Promise<{ price: number; fxRate: number } | null> {
  const key = `${ticker}|${devise}|${date ?? 'now'}`
  if (priceCache.has(key)) return priceCache.get(key)!
  try {
    const url = date
      ? `/api/prices?ticker=${encodeURIComponent(ticker)}&devise=${devise}&date=${date}`
      : `/api/prices?ticker=${encodeURIComponent(ticker)}&devise=${devise}`
    const res = await fetch(url)
    if (!res.ok) return null
    const d = await res.json()
    if (d.price == null) return null
    const entry = { price: d.price, fxRate: d.fxRate ?? 1 }
    priceCache.set(key, entry)
    return entry
  } catch { return null }
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Position {
  id: string; nom: string; ticker: string; categorie: string; devise: string
  quantite: number; prixAchat: number; tauxAchatCHF: number; dateAchat: string
  prixActuel: number; tauxActuelCHF: number; derniereMaj?: string; courtier?: string
  dateVente?: string  // si défini, position fermée à cette date (archivée, invisible dans l'actuel)
  prixVente?: number        // prix de vente effectif lors d'une réduction/clôture
  tauxVenteCHF?: number     // taux de change CHF au moment de la vente
}
interface PositionCalc extends Position {
  coutCHF: number; valeurCHF: number; gainCHF: number; gainPctCHF: number
  gainDevise: number; gainPctDevise: number; impactFX: number; gainReel: number; gainPctReel: number
}
interface SearchResult { ticker: string; nom: string; bourse: string; type: string; devise: string; pays?: string }

function typeIcon(t: string): string {
  switch (t.toLowerCase()) {
    case 'equity': case 'equities': return '📈'
    case 'etf':                     return '🗂️'
    case 'cryptocurrency':          return '₿'
    case 'future': case 'futures':  return '⛏️'
    case 'mutualfund': case 'mutual fund': return '🏛️'
    case 'bond':                    return '🏛️'
    case 'currency':                return '💱'
    case 'index':                   return '📊'
    default:                        return '📊'
  }
}

const CATEGORY_PLACEHOLDER: Record<string, string> = {
  'Actions':           'Rechercher une action… (ex: Apple, Nestlé, AAPL)',
  'ETF':               'Rechercher un ETF… (ex: MSCI World, SPY, VT)',
  'ETF Oblig.':       'Rechercher une obligation… (ex: TLT, IBTE.L)',
  'Matières premières':'Rechercher une matière première… (ex: Or, XAU, GC=F)',
  'Crypto':            'Rechercher une crypto… (ex: Bitcoin, BTC-EUR, ETH)',
  'Monnaies':          'Rechercher une devise… (ex: EUR/USD, GBPCHF=X)',
  'Tout':              'Rechercher un actif… (ex: ticker Yahoo Finance)',
}

const DEVISES = [
  'CHF', 'USD', 'EUR', 'GBP', 'JPY',
  'AUD', 'CAD', 'CNY', 'HKD', 'SGD',
  'NZD', 'NOK', 'SEK', 'DKK', 'PLN',
  'CZK', 'KRW', 'INR', 'MXN', 'BRL',
  'ZAR', 'TRY',
]
const CATEGORIES = ['Tout', 'Actions', 'ETF', 'ETF Oblig.', 'Matières premières', 'Crypto', 'Monnaies']

// ─── Profils courtiers ────────────────────────────────────────────────────────
interface BrokerProfile {
  emoji: string
  description: string
  types: string[]        // quoteTypes autorisés
  exchKeywords: string[] // mots-clés pour exchDisp (vide = tous)
}
// Mots-clés par région (correspondent aux valeurs exchDisp de Yahoo Finance)
const EXCH_US      = ['NYSE','Nasdaq','NasdaqGS','NasdaqCM','NasdaqGM','AMEX','BATS']
const EXCH_EUROPE  = ['Euronext','XETRA','Frankfurt','London','LSE','Milan','Madrid','Stockholm','Oslo','Helsinki','Copenhagen','Warsaw','Prague','Vienna','Brussels','Amsterdam','Paris','Zurich']
const EXCH_SWISS   = ['Swiss','SIX','BX','Berne']
const EXCH_ASIA    = ['Tokyo','Hong Kong','Shanghai','Seoul','Singapore','Mumbai','Sydney']

const BROKER_PROFILES: Record<string, BrokerProfile> = {
  'Interactive Brokers': {
    emoji: '🏦',
    description: 'Complet : actions, ETF, futures, forex, crypto spot, fonds — 170+ marchés mondiaux',
    types: ['EQUITY','ETF','CRYPTOCURRENCY','FUTURE','MUTUALFUND','CURRENCY'],
    exchKeywords: [], // couverture mondiale, aucun filtre exchange
  },
  'Swissquote': {
    emoji: '🇨🇭',
    description: 'Complet : actions, ETF, futures, forex, crypto spot, fonds — centré SIX + 60 marchés',
    types: ['EQUITY','ETF','CRYPTOCURRENCY','FUTURE','MUTUALFUND','CURRENCY'],
    exchKeywords: [...EXCH_SWISS, ...EXCH_US, ...EXCH_EUROPE, ...EXCH_ASIA],
  },
  'Saxo Bank': {
    emoji: '🔵',
    // Saxo propose des crypto ETPs (type ETF), pas de crypto spot — CRYPTOCURRENCY exclu
    description: 'Actions, ETF, futures, forex, fonds — crypto via ETPs uniquement (pas spot)',
    types: ['EQUITY','ETF','FUTURE','CURRENCY','MUTUALFUND'],
    exchKeywords: [], // large couverture mondiale
  },
  'DEGIRO': {
    emoji: '🟠',
    description: 'Actions, ETF, futures, fonds — marchés US + Europe (pas de crypto ni forex)',
    types: ['EQUITY','ETF','FUTURE','MUTUALFUND'],
    exchKeywords: [...EXCH_US, ...EXCH_EUROPE, ...EXCH_SWISS],
  },
  'Trade Republic': {
    emoji: '⚫',
    description: 'Actions, ETF, obligations, crypto spot — marchés US + Europe (pas de forex ni futures)',
    types: ['EQUITY','ETF','CRYPTOCURRENCY'],
    exchKeywords: [...EXCH_US, ...EXCH_EUROPE, ...EXCH_SWISS],
  },
  'Yuh': {
    emoji: '🟡',
    description: 'Actions, ETF, crypto spot — SIX + principaux marchés (sélection limitée, pas de forex)',
    types: ['EQUITY','ETF','CRYPTOCURRENCY'],
    exchKeywords: [...EXCH_SWISS, ...EXCH_US, ...EXCH_EUROPE],
  },
  'Neon': {
    emoji: '🟢',
    description: 'Actions + ETF uniquement sur BX Swiss / SIX — pas de crypto, forex ni futures',
    types: ['EQUITY','ETF'],
    exchKeywords: [...EXCH_SWISS],
  },
}
const BROKERS = ['', ...Object.keys(BROKER_PROFILES)]

const CATEGORY_SUGGESTIONS: Record<string, { ticker: string; nom: string; bourse: string; type: string; devise: string; popular?: boolean }[]> = {
  'Actions': [
    { ticker: 'AAPL',    nom: 'Apple',           bourse: 'NASDAQ',   type: 'equity', devise: 'USD', popular: true },
    { ticker: 'MSFT',    nom: 'Microsoft',        bourse: 'NASDAQ',   type: 'equity', devise: 'USD', popular: true },
    { ticker: 'NVDA',    nom: 'NVIDIA',           bourse: 'NASDAQ',   type: 'equity', devise: 'USD', popular: true },
    { ticker: 'TSLA',    nom: 'Tesla',            bourse: 'NASDAQ',   type: 'equity', devise: 'USD', popular: true },
    { ticker: 'GOOGL',   nom: 'Alphabet',         bourse: 'NASDAQ',   type: 'equity', devise: 'USD' },
    { ticker: 'AMZN',    nom: 'Amazon',           bourse: 'NASDAQ',   type: 'equity', devise: 'USD' },
    { ticker: 'NESN.SW', nom: 'Nestlé',           bourse: 'SIX',      type: 'equity', devise: 'CHF' },
    { ticker: 'ROG.SW',  nom: 'Roche',            bourse: 'SIX',      type: 'equity', devise: 'CHF' },
    { ticker: 'NOVN.SW', nom: 'Novartis',         bourse: 'SIX',      type: 'equity', devise: 'CHF' },
    { ticker: 'ASML',    nom: 'ASML',             bourse: 'NASDAQ',   type: 'equity', devise: 'USD' },
    { ticker: 'MC.PA',   nom: 'LVMH',             bourse: 'Euronext', type: 'equity', devise: 'EUR' },
  ],
  'ETF': [
    { ticker: 'VWCE.DE', nom: 'Vanguard All-World',   bourse: 'XETRA',  type: 'etf', devise: 'EUR', popular: true },
    { ticker: 'IWDA.L',  nom: 'iShares MSCI World',   bourse: 'LSE',    type: 'etf', devise: 'USD', popular: true },
    { ticker: 'CSPX.L',  nom: 'iShares S&P 500',      bourse: 'LSE',    type: 'etf', devise: 'USD', popular: true },
    { ticker: 'SPY',     nom: 'SPDR S&P 500',          bourse: 'NYSE',   type: 'etf', devise: 'USD' },
    { ticker: 'QQQ',     nom: 'Invesco Nasdaq 100',    bourse: 'NASDAQ', type: 'etf', devise: 'USD' },
    { ticker: 'VT',      nom: 'Vanguard Total World',  bourse: 'NYSE',   type: 'etf', devise: 'USD' },
    { ticker: 'SMIM.SW', nom: 'iShares SMI Mid',       bourse: 'SIX',    type: 'etf', devise: 'CHF' },
    { ticker: 'SMMCHA.SW', nom: 'UBS SMI',             bourse: 'SIX',    type: 'etf', devise: 'CHF' },
  ],
  'ETF Oblig.': [
    { ticker: 'TLT',       nom: 'iShares 20Y US Treasury',   bourse: 'NASDAQ', type: 'bond', devise: 'USD', popular: true },
    { ticker: 'AGG',       nom: 'iShares US Aggregate Bond',  bourse: 'NYSE',   type: 'bond', devise: 'USD', popular: true },
    { ticker: 'AGGH.L',    nom: 'iShares Global Aggregate',   bourse: 'LSE',    type: 'bond', devise: 'USD' },
    { ticker: 'IBTE.L',    nom: 'iShares EUR Govt Bond',      bourse: 'LSE',    type: 'bond', devise: 'EUR' },
    { ticker: 'CSBGC7.SW', nom: 'iShares CHF Corp Bond',      bourse: 'SIX',    type: 'bond', devise: 'CHF' },
  ],
  'Matières premières': [
    { ticker: 'GC=F', nom: 'Or (Futures)',           bourse: 'COMEX', type: 'future', devise: 'USD', popular: true },
    { ticker: 'CL=F', nom: 'Pétrole WTI (Futures)',  bourse: 'NYMEX', type: 'future', devise: 'USD', popular: true },
    { ticker: 'SI=F', nom: 'Argent (Futures)',        bourse: 'COMEX', type: 'future', devise: 'USD' },
    { ticker: 'NG=F', nom: 'Gaz Naturel (Futures)',   bourse: 'NYMEX', type: 'future', devise: 'USD' },
    { ticker: 'HG=F', nom: 'Cuivre (Futures)',        bourse: 'COMEX', type: 'future', devise: 'USD' },
    { ticker: 'ZW=F', nom: 'Blé (Futures)',           bourse: 'CBOT',  type: 'future', devise: 'USD' },
  ],
  'Crypto': [
    { ticker: 'BTC-USD', nom: 'Bitcoin',  bourse: 'CoinGecko', type: 'cryptocurrency', devise: 'USD', popular: true },
    { ticker: 'ETH-USD', nom: 'Ethereum', bourse: 'CoinGecko', type: 'cryptocurrency', devise: 'USD', popular: true },
    { ticker: 'SOL-USD', nom: 'Solana',   bourse: 'CoinGecko', type: 'cryptocurrency', devise: 'USD' },
    { ticker: 'BNB-USD', nom: 'BNB',      bourse: 'CoinGecko', type: 'cryptocurrency', devise: 'USD' },
    { ticker: 'XRP-USD', nom: 'XRP',      bourse: 'CoinGecko', type: 'cryptocurrency', devise: 'USD' },
  ],
  'Monnaies': [
    { ticker: 'EURUSD=X', nom: 'EUR / USD', bourse: 'Forex', type: 'currency', devise: 'USD', popular: true },
    { ticker: 'USDCHF=X', nom: 'USD / CHF', bourse: 'Forex', type: 'currency', devise: 'CHF', popular: true },
    { ticker: 'EURCHF=X', nom: 'EUR / CHF', bourse: 'Forex', type: 'currency', devise: 'CHF' },
    { ticker: 'GBPCHF=X', nom: 'GBP / CHF', bourse: 'Forex', type: 'currency', devise: 'CHF' },
  ],
}

// ─── Noms simplifiés pour les actifs connus ──────────────────────────────────
const KNOWN_NAMES: Record<string, string> = {
  // Actions US
  'AAPL': 'Apple', 'MSFT': 'Microsoft', 'NVDA': 'NVIDIA', 'GOOGL': 'Alphabet',
  'GOOG': 'Alphabet', 'AMZN': 'Amazon', 'META': 'Meta', 'TSLA': 'Tesla',
  'BRK-B': 'Berkshire Hathaway', 'JPM': 'JPMorgan', 'V': 'Visa', 'MA': 'Mastercard',
  'UNH': 'UnitedHealth', 'JNJ': 'Johnson & Johnson', 'XOM': 'ExxonMobil',
  'WMT': 'Walmart', 'LLY': 'Eli Lilly', 'AVGO': 'Broadcom', 'ASML': 'ASML',
  // Actions CH
  'NESN.SW': 'Nestlé', 'ROG.SW': 'Roche', 'NOVN.SW': 'Novartis',
  'ABBN.SW': 'ABB', 'UBSG.SW': 'UBS', 'ZURN.SW': 'Zurich Insurance',
  'SREN.SW': 'Swiss Re', 'GEBN.SW': 'Geberit', 'LONN.SW': 'Lonza',
  'ALC.SW': 'Alcon', 'GIVN.SW': 'Givaudan', 'SIKA.SW': 'Sika',
  // Actions EU
  'MC.PA': 'LVMH', 'TTE.PA': 'TotalEnergies', 'AIR.PA': 'Airbus',
  'SAN.PA': 'Sanofi', 'BNP.PA': 'BNP Paribas', 'OR.PA': "L'Oréal",
  'SAP.DE': 'SAP', 'SIE.DE': 'Siemens', 'BAYN.DE': 'Bayer',
  'ALV.DE': 'Allianz', 'BMW.DE': 'BMW', 'VOW3.DE': 'Volkswagen',
  'ASML.AS': 'ASML', 'SHELL.AS': 'Shell', 'HEIA.AS': 'Heineken',
  // ETF monde
  'IWDA.L': 'iShares MSCI World', 'CSPX.L': 'iShares S&P 500',
  'VWCE.DE': 'Vanguard All-World', 'EUNL.DE': 'iShares MSCI World',
  'AGGH.L': 'iShares Global Agg Bond', 'IBTE.L': 'iShares EUR Govt Bond',
  'EMIM.L': 'iShares Emerging Markets', 'IUSN.DE': 'iShares MSCI Small Cap',
  'SMIM.SW': 'iShares SMI Mid', 'SMMCHA.SW': 'UBS SMI',
  // ETF US
  'SPY': 'SPDR S&P 500', 'QQQ': 'Invesco Nasdaq 100', 'VT': 'Vanguard Total World',
  'VTI': 'Vanguard US Total Market', 'VOO': 'Vanguard S&P 500',
  'IWM': 'iShares Russell 2000', 'EFA': 'iShares MSCI EAFE',
  'VEA': 'Vanguard Developed Markets', 'VWO': 'Vanguard Emerging Markets',
  // ETF Oblig. (Bond ETFs)
  'TLT': 'iShares 20Y US Treasury', 'AGG': 'iShares US Aggregate Bond',
  'BND': 'Vanguard Total Bond Market', 'LQD': 'iShares Investment Grade Corp',
  'HYG': 'iShares High Yield Corp', 'CSBGC7.SW': 'iShares CHF Corp Bond',
  // Matières premières
  'GLD': 'SPDR Gold', 'SLV': 'iShares Silver', 'SGOL': 'Aberdeen Gold',
  'GC=F': 'Or (Futures)', 'CL=F': 'Pétrole WTI (Futures)',
  'NG=F': 'Gaz naturel (Futures)', 'BZ=F': 'Brent (Futures)',
  // Crypto
  'BTC-USD': 'Bitcoin', 'ETH-USD': 'Ethereum', 'BNB-USD': 'BNB',
  'SOL-USD': 'Solana', 'XRP-USD': 'XRP', 'ADA-USD': 'Cardano',
  'DOGE-USD': 'Dogecoin', 'AVAX-USD': 'Avalanche', 'DOT-USD': 'Polkadot',
  'MATIC-USD': 'Polygon', 'LINK-USD': 'Chainlink', 'UNI-USD': 'Uniswap',
  // Monnaies
  'USDCHF=X': 'USD / CHF', 'EURCHF=X': 'EUR / CHF', 'GBPCHF=X': 'GBP / CHF',
  'EURUSD=X': 'EUR / USD', 'GBPUSD=X': 'GBP / USD', 'USDJPY=X': 'USD / JPY',
}

function simplifyName(nom: string, ticker: string): string {
  if (KNOWN_NAMES[ticker]) return KNOWN_NAMES[ticker]
  return nom
    .replace(/\s+UCITS\s+ETF\s+(USD|EUR|CHF|GBP)?\s*(Acc(umulation)?|Dist(ributing)?|Hedged|Cap)?/gi, '')
    .replace(/\s+(USD|EUR|CHF|GBP)\s+(Acc(umulation)?|Dist(ributing)?|Hedged)/gi, '')
    .replace(/\s+UCITS\s+ETF/gi, '')
    .replace(/\s+Index\s+Fund/gi, '')
    .replace(/\s+ETF\s+Trust/gi, '')
    .replace(/\s+Inc\.?$/i, '')
    .replace(/\s+Corp\.?$/i, '')
    .replace(/\s+S\.A\.$/i, '')
    .replace(/\s+N\.V\.$/i, '')
    .replace(/\s+PLC$/i, '')
    .replace(/\s+\(USD\)|\s+\(EUR\)|\s+\(CHF\)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}
const CAT_COLOR: Record<string, string> = {
  'Actions': '#4A8573', 'ETF': '#2A4D78', 'ETF Oblig.': '#C4952A',
  'Matières premières': '#8E6240', 'Crypto': '#3D8A80', 'Monnaies': '#3A7898', 'Tout': '#6A7285',
}
// Set de tickers ETF obligataires connus — utilisé pour retypifier en 'bond' dans tous les contextes
const BOND_ETF_TICKERS = new Set(
  (CATEGORY_SUGGESTIONS['ETF Oblig.'] ?? []).map(s => s.ticker)
)
const EMPTY_FORM: Omit<Position, 'id'> = {
  nom: '', ticker: '', categorie: 'Tout', devise: 'USD',
  quantite: 0, prixAchat: 0, tauxAchatCHF: 1,
  dateAchat: new Date().toISOString().slice(0, 10),
  prixActuel: 0, tauxActuelCHF: 1, courtier: '',
}

// ─── Autocomplete ticker ──────────────────────────────────────────────────────
function TickerAutocomplete({
  value, onChange, placeholder, filterTypes, filterExch, categorySuggestions
}: {
  value: { ticker: string; nom: string; devise: string }
  onChange: (r: { ticker: string; nom: string; devise: string; type: string }) => void
  placeholder?: string
  filterTypes?: string[]   // quoteTypes autorisés (undefined = tous, [] = impossible)
  filterExch?: string[]    // mots-clés exchange (vide = tous)
  categorySuggestions?: { ticker: string; nom: string; bourse: string; type: string; devise: string; popular?: boolean }[]
}) {
  const [query, setQuery] = useState(value.ticker ? `${value.nom} (${value.ticker})` : '')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(!!value.ticker)
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Ferme le dropdown si on clique ailleurs
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const search = useCallback((q: string) => {
    if (timer.current) clearTimeout(timer.current)
    if (q.length < 2) { setResults([]); setOpen(false); return }
    timer.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        let raw: SearchResult[] = data.results ?? []
        // Retypifier les ETF obligataires connus → type 'bond' pour icône 🏛️ dans tous les contextes
        raw = raw.map(r => BOND_ETF_TICKERS.has(r.ticker) ? { ...r, type: 'bond' } : r)
        // Filtrage par profil courtier
        // r.type est un label affichage Yahoo (ex: "Equity", "ETF", "Cryptocurrency")
        const TYPE_DISPLAY_MAP: Record<string, string> = {
          'equity': 'EQUITY', 'etf': 'ETF', 'cryptocurrency': 'CRYPTOCURRENCY',
          'future': 'FUTURE', 'futures': 'FUTURE', 'mutual fund': 'MUTUALFUND', 'currency': 'CURRENCY',
          'mutualfund': 'MUTUALFUND', 'bond': 'BOND',
        }
        if (filterTypes !== undefined) {
          if (filterTypes.length === 0) {
            // Combinaison impossible (ex: Saxo + Crypto) → aucun résultat
            raw = []
          } else {
            raw = raw.filter(r => {
              const mapped = TYPE_DISPLAY_MAP[r.type.toLowerCase()] ?? r.type.toUpperCase()
              return filterTypes.includes(mapped)
            })
          }
        }
        if (filterExch && filterExch.length > 0) {
          raw = raw.filter(r => {
            const mapped = TYPE_DISPLAY_MAP[r.type.toLowerCase()] ?? r.type.toUpperCase()
            // Crypto, forex et futures ne sont pas sur une bourse classique → exemptés du filtre exchange
            if (['CRYPTOCURRENCY', 'CURRENCY', 'FUTURE'].includes(mapped)) return true
            return !r.bourse || filterExch.some(kw => r.bourse.toLowerCase().includes(kw.toLowerCase()))
          })
        }
        // Injection des actifs connus qui matchent localement (ticker ou nom)
        const qLow = q.toLowerCase()
        const allSugg = categorySuggestions ?? []
        const localMatches: SearchResult[] = allSugg
          .filter(s =>
            s.ticker.toLowerCase().includes(qLow) ||
            s.nom.toLowerCase().includes(qLow)
          )
          .map(s => ({ ticker: s.ticker, nom: s.nom, devise: s.devise, type: s.type, bourse: s.bourse }))
        // Appliquer les mêmes filtres aux matches locaux
        let filteredLocal = localMatches
        if (filterTypes !== undefined && filterTypes.length > 0) {
          filteredLocal = filteredLocal.filter(r => {
            const mapped = TYPE_DISPLAY_MAP[r.type.toLowerCase()] ?? r.type.toUpperCase()
            return filterTypes.includes(mapped)
          })
        } else if (filterTypes?.length === 0) {
          filteredLocal = []
        }
        // Fusionner : locaux en premier, puis Yahoo (sans doublons)
        // En catégorie "ETF Oblig." : les suggestions sont toutes de type 'bond' (virtuel)
        // → on n'accepte de Yahoo que les tickers connus, retypés en 'bond' pour l'icône 🏛️
        const knownBondTickers = new Set(
          (categorySuggestions ?? []).filter(s => s.type === 'bond').map(s => s.ticker)
        )
        const isBondCategory =
          knownBondTickers.size > 0 &&
          (categorySuggestions ?? []).every(s => s.type === 'bond')

        const localTickers = new Set(filteredLocal.map(r => r.ticker))
        let yahooExtra = raw.filter(r => !localTickers.has(r.ticker))
        if (isBondCategory) {
          // Restreindre aux tickers obligataires connus + forcer le type 'bond'
          yahooExtra = yahooExtra
            .filter(r => knownBondTickers.has(r.ticker))
            .map(r => ({ ...r, type: 'bond' }))
        }
        const merged = [
          ...filteredLocal,
          ...yahooExtra,
        ]
        setResults(merged)
        setOpen(true)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [filterTypes, filterExch, categorySuggestions])

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    setSelected(false)
    if (!val) { setResults([]); setOpen(true) }
    else search(val)
  }

  function handleSelect(r: SearchResult) {
    const nom = simplifyName(r.nom, r.ticker)
    setQuery(`${nom} (${r.ticker})`)
    setSelected(true)
    setOpen(false)
    setResults([])
    onChange({ ticker: r.ticker, nom, devise: r.devise, type: r.type })
  }

  function handleClear() {
    setQuery('')
    setSelected(false)
    setResults([])
    onChange({ ticker: '', nom: '', devise: value.devise, type: '' })
  }

  const inputCls = `w-full bg-white dark:bg-[#1B2D3E] border rounded-lg px-3 py-2 text-sm
    text-[#1B3050] dark:text-[#E8E4DC] focus:outline-none focus:ring-2 focus:ring-[#2B6B5A]
    focus:border-transparent placeholder-[#9E9A93] pr-8
    ${selected ? 'border-[#2B6B5A]' : 'border-[#DDD9D1] dark:border-[#2a3f52]'}`

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input
          className={inputCls}
          placeholder={placeholder ?? 'Rechercher un actif… (ex: Apple, NESN, Bitcoin)'}
          value={query}
          onChange={handleInput}
          onFocus={() => { if (results.length > 0) setOpen(true); else if (!query && categorySuggestions?.length) setOpen(true) }}
        />
        {/* Indicateurs à droite */}
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {loading && (
            <span className="text-[#9E9A93] text-xs animate-spin">⟳</span>
          )}
          {selected && (
            <span className="text-[#2B6B5A] text-xs">✓</span>
          )}
          {query && (
            <button type="button" onClick={handleClear} className="text-[#9E9A93] hover:text-[#5C6880] text-sm leading-none ml-0.5">×</button>
          )}
        </div>
      </div>

      {/* Dropdown résultats */}
      {open && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[#1B2D3E] border border-[#DDD9D1] dark:border-[#2a3f52] rounded-lg shadow-lg overflow-hidden">
          {results.map((r) => (
            <button
              key={r.ticker}
              type="button"
              onClick={() => handleSelect(r)}
              className="w-full text-left px-3 py-2.5 hover:bg-[#F5F3EF] dark:hover:bg-[#162534] transition-colors flex items-center gap-3 border-b border-[#F5F3EF] dark:border-[#0F1E2C] last:border-0"
            >
              <span className="text-lg flex-shrink-0 w-6 text-center">{typeIcon(r.type)}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[#1B3050] dark:text-[#E8E4DC] truncate">{simplifyName(r.nom, r.ticker)}</div>
                <div className="text-xs text-[#9E9A93] flex items-center gap-1.5 mt-0.5">
                  <span className="font-mono font-semibold text-[#2B6B5A]">{r.ticker}</span>
                  {r.bourse && <><span>·</span><span>{r.bourse}</span></>}
                  {r.type && <><span>·</span><span>{r.type}</span></>}
                </div>
              </div>
              <span className="text-xs font-mono text-[#9E9A93] flex-shrink-0">{r.devise}</span>
            </button>
          ))}
        </div>
      )}

      {/* Suggestions par catégorie (quand champ vide) */}
      {open && !query && results.length === 0 && categorySuggestions && categorySuggestions.length > 0 && (() => {
        const popular = categorySuggestions.filter(r => r.popular)
        const others  = categorySuggestions.filter(r => !r.popular)
        const SuggRow = ({ r }: { r: typeof categorySuggestions[0] }) => (
          <button
            key={r.ticker}
            type="button"
            onClick={() => handleSelect(r)}
            className="w-full text-left px-3 py-2.5 hover:bg-[#F5F3EF] dark:hover:bg-[#162534] transition-colors flex items-center gap-3 border-b border-[#F5F3EF] dark:border-[#0F1E2C] last:border-0"
          >
            <span className="text-lg flex-shrink-0 w-6 text-center">{typeIcon(r.type)}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[#1B3050] dark:text-[#E8E4DC] truncate">{r.nom}</div>
              <div className="text-xs text-[#9E9A93] flex items-center gap-1.5 mt-0.5">
                <span className="font-mono font-semibold text-[#2B6B5A]">{r.ticker}</span>
                {r.bourse && <><span>·</span><span>{r.bourse}</span></>}
              </div>
            </div>
            <span className="text-xs font-mono text-[#9E9A93] flex-shrink-0">{r.devise}</span>
          </button>
        )
        return (
          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[#1B2D3E] border border-[#DDD9D1] dark:border-[#2a3f52] rounded-lg shadow-lg overflow-hidden">
            {popular.length > 0 && <>
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#9E9A93] border-b border-[#F5F3EF] dark:border-[#0F1E2C] flex items-center gap-1.5">
                <span>⭐</span><span>Populaires</span>
              </div>
              {popular.map(r => <SuggRow key={r.ticker} r={r} />)}
            </>}
            {others.length > 0 && <>
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#9E9A93] border-b border-[#F5F3EF] dark:border-[#0F1E2C] border-t border-t-[#EAE7E2] dark:border-t-[#1a2e3e]">
                Autres
              </div>
              {others.map(r => <SuggRow key={r.ticker} r={r} />)}
            </>}
          </div>
        )
      })()}

      {open && !loading && results.length === 0 && query.length >= 2 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[#1B2D3E] border border-[#DDD9D1] dark:border-[#2a3f52] rounded-lg shadow-lg px-4 py-3 text-sm text-[#9E9A93]">
          <div>Aucun résultat pour "{query}"</div>
          {(filterTypes !== undefined && filterTypes.length === 0) && (
            <div className="text-xs mt-1 text-amber-600 dark:text-amber-400">
              ⚠️ Cette plateforme ne propose pas ce type d'actif — changez de catégorie ou de courtier.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Colored area helper ─────────────────────────────────────────────────────
function buildColoredAreas(
  pts: { x: number; val: number; base: number }[],
  pxFn: (t: number) => number,
  pyFn: (v: number) => number
): { gainD: string; lossD: string } {
  const gain: string[] = [], loss: string[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i], p1 = pts[i + 1]
    const d0 = p0.val - p0.base, d1 = p1.val - p1.base
    const x0 = pxFn(p0.x), x1 = pxFn(p1.x)
    const yv0 = pyFn(p0.val), yv1 = pyFn(p1.val)
    const yb0 = pyFn(p0.base), yb1 = pyFn(p1.base)
    const trap = (ax0: number, av0: number, ab0: number, ax1: number, av1: number, ab1: number) =>
      `M ${ax0} ${ab0} L ${ax0} ${av0} L ${ax1} ${av1} L ${ax1} ${ab1} Z`
    if (d0 >= 0 && d1 >= 0) {
      gain.push(trap(x0, yv0, yb0, x1, yv1, yb1))
    } else if (d0 <= 0 && d1 <= 0) {
      loss.push(trap(x0, yv0, yb0, x1, yv1, yb1))
    } else {
      const t = d0 / (d0 - d1)
      const cx = x0 + t * (x1 - x0)
      const cyv = yv0 + t * (yv1 - yv0)
      const cyb = yb0 + t * (yb1 - yb0)
      if (d0 > 0) {
        gain.push(trap(x0, yv0, yb0, cx, cyv, cyb))
        loss.push(trap(cx, cyv, cyb, x1, yv1, yb1))
      } else {
        loss.push(trap(x0, yv0, yb0, cx, cyv, cyb))
        gain.push(trap(cx, cyv, cyb, x1, yv1, yb1))
      }
    }
  }
  return { gainD: gain.join(' '), lossD: loss.join(' ') }
}

// ─── Shared chart utility ─────────────────────────────────────────────────────
/** Binary-search lookup: returns closing price on or before date d.
 *  Extracted to avoid duplication across EvolChart / PnLChart / DrawdownChart. */
function makeLookupClose(histJson: Record<string, { dates: string[]; closes: number[] }>) {
  return function lookupClose(ticker: string, d: string): number | null {
    const h = histJson[ticker.toUpperCase()]
    if (!h || h.dates.length === 0) return null
    const lastDate = h.dates[h.dates.length - 1]
    if (d.slice(0, 7) > lastDate.slice(0, 7)) return null
    let lo = 0, hi = h.dates.length - 1, best = -1
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (h.dates[mid] <= d) { best = mid; lo = mid + 1 } else hi = mid - 1 }
    return best >= 0 ? h.closes[best] : null
  }
}

// ─── Chart: Evolution ─────────────────────────────────────────────────────────
function EvolChart({ data, showFX, range, bustKey = 0 }: { data: PositionCalc[]; showFX?: boolean; range?: 'all' | '60d' | 'weekly'; bustKey?: number }) {
  const W = 600, H = 180, PAD = { t: 16, r: 16, b: 36, l: 64 }
  const iW = W - PAD.l - PAD.r, iH = H - PAD.t - PAD.b

  const [monthlyPts, setMonthlyPts] = useState<{ x: number; cost: number; value: number; valueNoFX: number; label: string }[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [showInvesti, setShowInvesti] = useState(true)
  const [showValeur, setShowValeur] = useState(true)
  const [showHorsFX, setShowHorsFX] = useState(true)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const [hoverMxEvol, setHoverMxEvol] = useState<number | null>(null)
  const [zoomWEvol, setZoomWEvol] = useState<[number, number]>([0, 1])
  const zoomDragEvol = useRef<{ startX: number; startZoom: [number, number] } | null>(null)
  const _bustLastSeen = useRef(0)

  const { dates, firstDate, totalMs } = useMemo(() => {
    if (data.length === 0) return { dates: [] as string[], firstDate: new Date(), totalMs: 1 }
    const sorted = [...data].sort((a, b) => new Date(a.dateAchat).getTime() - new Date(b.dateAchat).getTime())
    const today = new Date()
    if (range === '60d') {
      const list: string[] = []
      for (let i = 59; i >= 0; i--) {
        const d = new Date(today); d.setDate(d.getDate() - i)
        list.push(d.toISOString().slice(0, 10))
      }
      const first = new Date(list[0])
      return { dates: list, firstDate: first, totalMs: today.getTime() - first.getTime() || 1 }
    }
    const first = new Date(sorted[0].dateAchat)
    const ms = today.getTime() - first.getTime()
    if (range === 'weekly') {
      const list: string[] = []
      let d = new Date(first)
      while (d <= today) {
        list.push(d.toISOString().slice(0, 10))
        d = new Date(d); d.setDate(d.getDate() + 7)
      }
      return { dates: list, firstDate: first, totalMs: ms || 1 }
    }
    const list: string[] = []
    let d = new Date(first.getFullYear(), first.getMonth(), 1)
    while (d <= today) {
      list.push(d.toISOString().slice(0, 10))
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    }
    return { dates: list, firstDate: first, totalMs: ms || 1 }
  }, [data, range])

  const dataKey = useMemo(() => data.map(p => p.ticker + p.dateAchat + p.quantite).join(',') + '|' + (range ?? 'all') + '|' + bustKey, [data, range, bustKey])

  useEffect(() => {
    if (data.length === 0 || dates.length === 0) return
    let cancelled = false
    setLoading(true); setProgress(0); setMonthlyPts(null)

    async function fetchAll() {
      const today = new Date().toISOString().slice(0, 10)
      const result: { x: number; cost: number; value: number; valueNoFX: number; label: string }[] = []

      // ─── Bulk history (évite N×M appels /api/prices) ──────────────────────
      const allTickers = [...new Set(data.map(p => p.ticker.toUpperCase()))]
      const fxPairs = [...new Set(data.filter(p => p.devise !== 'CHF').map(p => `${p.devise}CHF=X`))]
      const isBust = bustKey > _bustLastSeen.current; _bustLastSeen.current = bustKey
      const histJson = await fetchHistory([...allTickers, ...fxPairs].join(','), isBust) as Record<string, { dates: string[]; closes: number[] }>
      const lookupClose = makeLookupClose(histJson)
      // Pré-calcul unique : date la plus ancienne couverte par l'historique
      const histStart = Object.values(histJson).map(h => h.dates[0]).filter(Boolean).sort()[0] ?? ''

      for (let i = 0; i < dates.length; i++) {
        if (cancelled) return
        const dateStr = dates[i]
        const isToday = dateStr >= today
        const activePosns = data.filter(p => p.dateAchat <= dateStr)
        if (activePosns.length === 0) { setProgress(Math.round((i + 1) / dates.length * 100)); continue }

        // histStart computed once above the loop (not per iteration)
        const useOldest = !isToday && dateStr < histStart

        const prices = await Promise.all(activePosns.map(async p => {
          if (!isToday) {
            const price = lookupClose(p.ticker, dateStr)
            if (price !== null) {
              const fxPair = p.devise !== 'CHF' ? `${p.devise}CHF=X` : null
              const fxRate = fxPair ? (lookupClose(fxPair, dateStr) ?? p.tauxActuelCHF) : 1
              return { price, fxRate }
            }
            // Date is before history window: use oldest history price (avoids rate-limiting Yahoo)
            if (useOldest) {
              const h = histJson[p.ticker.toUpperCase()]
              const fxKey = p.devise !== 'CHF' ? `${p.devise}CHF=X` : null
              const hFx = fxKey ? histJson[fxKey.toUpperCase()] : null
              const price0 = h?.closes[0] ?? p.prixAchat
              const fxRate0 = hFx?.closes[0] ?? p.tauxAchatCHF
              return { price: price0, fxRate: fxRate0 }
            }
          }
          const d = await fetchPriceCached(p.ticker, p.devise, isToday ? undefined : dateStr)
          return d ?? { price: p.prixActuel, fxRate: p.tauxActuelCHF }
        }))

        // coût net : Investi diminue de qty_vendue × prixAchat × tauxAchat à la date de clôture
        const cumCost = activePosns.reduce((s, p) => s + (p.quantite > 0 ? p.coutCHF : -p.coutCHF), 0)
        // valeur : quantités signées naturelles — le lot vendu (-500) annule partie du lot long (+1000)
        // → après la clôture le graphique reflète uniquement le nouveau portefeuille restant
        const value = activePosns.reduce((s, p, j) => {
          return s + p.quantite * prices[j].price * prices[j].fxRate
        }, 0)
        const valueNoFX = activePosns.reduce((s, p, j) => {
          return s + p.quantite * prices[j].price * p.tauxAchatCHF
        }, 0)
        const t = (new Date(dateStr).getTime() - firstDate.getTime()) / totalMs
        const label = range === 'all' ? fmtMonth(dateStr) : range === 'weekly' ? fmtDate(dateStr) : fmtDay(dateStr)
        result.push({ x: isToday ? 1 : Math.min(t, 0.98), cost: cumCost, value, valueNoFX, label })
        setProgress(Math.round((i + 1) / dates.length * 100))
      }
      if (!cancelled) { setMonthlyPts(result); setLoading(false) }
    }
    fetchAll()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey])

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-36 gap-2">
      <div className="w-48 h-1.5 bg-[#DDD9D1] dark:bg-[#2a3f52] rounded-full overflow-hidden">
        <div className="h-full bg-[#2B6B5A] rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>
      <p className="text-xs text-[#9E9A93]">{range === '60d' ? 'Chargement 60 jours…' : range === 'weekly' ? 'Chargement des données hebdomadaires…' : 'Chargement des données mensuelles…'} {progress}%</p>
    </div>
  )

  const points = monthlyPts

  if (!points || points.length < 2) return (
    <div className="flex items-center justify-center h-36 text-sm text-[#9E9A93]">
      Ajoutez au moins 2 positions pour voir le graphique
    </div>
  )

  const lastVal = points[points.length - 1].value
  const zE = zoomWEvol
  const isZoomedEvol = zE[0] > 0.001 || zE[1] < 0.999
  const visPtsE = points.filter(p => p.x >= zE[0] - 0.001 && p.x <= zE[1] + 0.001)
  const firstVisE = visPtsE[0] ?? points[0]
  const lastVisE = visPtsE[visPtsE.length - 1] ?? points[points.length - 1]
  const scalePtsE = isZoomedEvol && visPtsE.length > 1 ? visPtsE : points
  const allValuesVis = scalePtsE.flatMap(p => [...(showInvesti ? [p.cost] : []), ...(showValeur ? [p.value] : []), ...(showHorsFX ? [p.valueNoFX] : [])]).filter(v => isFinite(v))
  const allValuesFallbackVis = allValuesVis.length ? allValuesVis : scalePtsE.flatMap(p => [p.value])
  const _maxVis = Math.max(...allValuesFallbackVis), _minVis = Math.min(...allValuesFallbackVis)
  const rawSpanVis = (_maxVis - _minVis) || _maxVis * 0.1 || 1
  const rawStepVis = rawSpanVis / 4
  const magVis = Math.pow(10, Math.floor(Math.log10(rawStepVis)))
  const normVis = rawStepVis / magVis
  const niceStepVis = (normVis < 1.5 ? 1 : normVis < 3 ? 2 : normVis < 7 ? 5 : 10) * magVis
  const minVVis = range !== 'all' ? Math.floor(_minVis / niceStepVis) * niceStepVis : Math.min(0, Math.floor(_minVis / niceStepVis) * niceStepVis)
  const maxVVis = Math.ceil(_maxVis / niceStepVis) * niceStepVis
  const spanVis = maxVVis - minVVis || 1
  const px = (t: number) => PAD.l + ((t - zE[0]) / (zE[1] - zE[0])) * iW
  const py = (v: number) => PAD.t + iH - ((v - minVVis) / spanVis) * iH
  const tickVals = Array.from({ length: Math.round((maxVVis - minVVis) / niceStepVis) + 1 }, (_, i) => minVVis + i * niceStepVis)
  const costPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${px(p.x)} ${py(p.cost)}`).join(' ')

  const { gainD, lossD } = buildColoredAreas(
    points.map(p => ({ x: p.x, val: p.value, base: p.cost })),
    px, py
  )

  const hovered = hoverIdx !== null ? points[hoverIdx] : null

  return (
    <>
    {isZoomedEvol && (
      <div className="flex justify-end mb-1">
        <button type="button" onClick={() => setZoomWEvol([0, 1])}
          className="text-xs text-[#9E9A93] hover:text-[#2B6B5A] px-2 py-0.5 rounded border border-[#DDD9D1] dark:border-[#2a3f52]">
          ↺ Réinitialiser zoom
        </button>
      </div>
    )}
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H, cursor: isZoomedEvol ? 'grab' : 'default' }}
      onMouseLeave={() => { setHoverIdx(null); setHoverMxEvol(null); zoomDragEvol.current = null }}
      onMouseDown={e => {
        if (!isZoomedEvol) return
        const svgEl = e.currentTarget as SVGSVGElement; const pt = svgEl.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const mx = pt.matrixTransform(svgEl.getScreenCTM()!.inverse()).x
        zoomDragEvol.current = { startX: mx, startZoom: [zE[0], zE[1]] }
        e.preventDefault()
      }}
      onMouseUp={() => { zoomDragEvol.current = null }}
      onMouseMove={e => {
        const svgEl = e.currentTarget as SVGSVGElement; const pt = svgEl.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const mx = pt.matrixTransform(svgEl.getScreenCTM()!.inverse()).x
        if (zoomDragEvol.current) {
          const delta = (zoomDragEvol.current.startX - mx) / iW * (zE[1] - zE[0])
          const [z0, z1] = zoomDragEvol.current.startZoom
          const sp = z1 - z0
          const newZ0 = Math.max(0, Math.min(1 - sp, z0 + delta))
          setZoomWEvol([newZ0, newZ0 + sp])
          return
        }
        const t = zE[0] + ((mx - PAD.l) / iW) * (zE[1] - zE[0])
        let best = 0, bd = Infinity
        points.forEach((p, i) => { const d = Math.abs(p.x - t); if (d < bd) { bd = d; best = i } })
        setHoverIdx(best); setHoverMxEvol(mx)
      }}
      onWheel={e => {
        e.preventDefault()
        const svgEl = e.currentTarget as SVGSVGElement; const pt = svgEl.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const mx = pt.matrixTransform(svgEl.getScreenCTM()!.inverse()).x
        const t = zE[0] + ((mx - PAD.l) / iW) * (zE[1] - zE[0])
        const factor = zE[1] - zE[0]
        const nf = Math.min(1, Math.max(0.05, factor * (e.deltaY > 0 ? 1.3 : 0.77)))
        const ratio = (t - zE[0]) / factor
        const newZ0 = Math.max(0, Math.min(1 - nf, t - ratio * nf))
        setZoomWEvol([newZ0, newZ0 + nf])
      }}
    >
      <defs>
        <clipPath id="eg-clip"><rect x={PAD.l} y={PAD.t} width={iW} height={iH} /></clipPath>
        <linearGradient id="eg-gain" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2B6B5A" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#2B6B5A" stopOpacity="0.04" />
        </linearGradient>
        <linearGradient id="eg-loss" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#DC2626" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#DC2626" stopOpacity="0.22" />
        </linearGradient>
        <linearGradient id="eg-cost" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5C6880" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#5C6880" stopOpacity="0" />
        </linearGradient>
      </defs>
      {tickVals.map((v, i) => (
        <g key={i}>
          <line x1={PAD.l} y1={py(v)} x2={W - PAD.r} y2={py(v)} stroke="#DDD9D1" strokeWidth="0.5" strokeDasharray="3 3" />
          <text x={PAD.l - 6} y={py(v) + 4} textAnchor="end" fontSize="10" fill="#9E9A93">
            {v >= 1000 ? `${(v / 1000).toFixed(niceStepVis < 1000 ? 1 : 0)}k` : v.toFixed(0)}
          </text>
        </g>
      ))}
      <g clipPath="url(#eg-clip)">
      {showInvesti && <path d={`${costPath} L ${px(points[points.length-1].x)} ${py(minV)} L ${px(points[0].x)} ${py(minV)} Z`} fill="url(#eg-cost)" />}
      {showValeur && gainD && <path d={gainD} fill="url(#eg-gain)" />}
      {showValeur && lossD && <path d={lossD} fill="url(#eg-loss)" />}
      {showInvesti && <path d={costPath} fill="none" stroke="var(--finv-cost-line)" strokeWidth="1" strokeDasharray="6 3" />}
      {showValeur && points.slice(0, -1).map((p0, i) => {
        const p1 = points[i + 1]
        const d0 = p0.value - p0.cost, d1 = p1.value - p1.cost
        if (d0 >= 0 && d1 >= 0) {
          return <line key={i} x1={px(p0.x)} y1={py(p0.value)} x2={px(p1.x)} y2={py(p1.value)} stroke="#2B6B5A" strokeWidth="2" strokeLinecap="round" />
        } else if (d0 <= 0 && d1 <= 0) {
          return <line key={i} x1={px(p0.x)} y1={py(p0.value)} x2={px(p1.x)} y2={py(p1.value)} stroke="#DC2626" strokeWidth="2" strokeLinecap="round" />
        } else {
          const t = d0 / (d0 - d1)
          const cx = px(p0.x) + t * (px(p1.x) - px(p0.x))
          const cy = py(p0.value) + t * (py(p1.value) - py(p0.value))
          return (
            <g key={i}>
              <line x1={px(p0.x)} y1={py(p0.value)} x2={cx} y2={cy} stroke={d0 > 0 ? '#2B6B5A' : '#DC2626'} strokeWidth="2" strokeLinecap="round" />
              <line x1={cx} y1={cy} x2={px(p1.x)} y2={py(p1.value)} stroke={d0 > 0 ? '#DC2626' : '#2B6B5A'} strokeWidth="2" strokeLinecap="round" />
            </g>
          )
        }
      })}
      {hovered && (() => {
        const g = hovered.value - hovered.cost
        const gNoFX = hovered.valueNoFX - hovered.cost
        const lines: { label: string; val: number; col: string }[] = []
        if (showValeur) lines.push({ label: 'Valeur', val: hovered.value, col: g >= 0 ? '#4ADE80' : '#F87171' })
        if (showInvesti) lines.push({ label: 'Investi', val: hovered.cost, col: '#9E9A93' })
        if (showHorsFX) lines.push({ label: 'Hors FX', val: hovered.valueNoFX, col: gNoFX >= 0 ? '#F59E0B' : '#F87171' })
        const bh = 14 + Math.max(lines.length, 1) * 16
        const refV = showValeur ? hovered.value : showHorsFX ? hovered.valueNoFX : hovered.cost
        const ty = py(refV) - 10
        const tx = Math.min(Math.max(px(hovered.x), PAD.l + 62), W - PAD.r - 62)
        return (
          <g>
            <line x1={hoverMxEvol ?? px(hovered.x)} y1={PAD.t} x2={hoverMxEvol ?? px(hovered.x)} y2={H - PAD.b} stroke="#9E9A93" strokeWidth="0.8" strokeDasharray="3 2" />
            {showValeur && <circle cx={px(hovered.x)} cy={py(hovered.value)} r="3.5" fill={g >= 0 ? '#2B6B5A' : '#DC2626'} />}
            {showInvesti && <circle cx={px(hovered.x)} cy={py(hovered.cost)} r="3" fill="#9E9A93" />}
            {showHorsFX && <circle cx={px(hovered.x)} cy={py(hovered.valueNoFX)} r="3" fill="#B5820F" />}
            <g transform={`translate(${tx}, ${ty < PAD.t + bh + 4 ? PAD.t + bh + 4 : ty})`}>
              <rect x="-62" y={-bh} width="124" height={bh + 4} rx="4" fill="#1C2B22" opacity="0.92" />
              <text x="0" y={-(bh - 12)} textAnchor="middle" fontSize="10" fill="#9E9A93">{hovered.label}</text>
              {lines.map((l, i) => (
                <g key={i}>
                  <text x="-4" y={-(bh - 12) + 14 + i * 16} textAnchor="end" fontSize="10" fill="#9E9A93">{l.label}</text>
                  <text x="4" y={-(bh - 12) + 14 + i * 16} textAnchor="start" fontSize="10" fill={l.col}>{l.val >= 1000 || l.val <= -1000 ? `${(l.val/1000).toFixed(1)}k` : l.val.toFixed(0)} CHF</text>
                </g>
              ))}
            </g>
          </g>
        )
      })()}
      {showHorsFX && <path
          d={points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${px(p.x)} ${py(p.valueNoFX)}`).join(' ')}
          fill="none" stroke="#B5820F" strokeWidth="1.5" strokeDasharray="6 3" opacity="0.7"
        />}
      {showValeur && <circle cx={px(points[points.length-1].x)} cy={py(lastVal)} r="4" fill={lastVal >= points[points.length-1].cost ? '#2B6B5A' : '#DC2626'} />}
      </g>
      <text x={Math.max(PAD.l + 4, Math.min(W - PAD.r - 4, px(firstVisE.x)))} y={H - 6} textAnchor="middle" fontSize="10" fill="#9E9A93">{firstVisE.label}</text>
      <text x={Math.max(PAD.l + 4, Math.min(W - PAD.r - 4, px(lastVisE.x)))} y={H - 6} textAnchor="middle" fontSize="10" fill="#9E9A93">{lastVisE === points[points.length-1] ? 'Auj.' : lastVisE.label}</text>
    </svg>
    <div className="flex items-center gap-2 mt-2 flex-wrap">
      <button type="button" onClick={() => setShowInvesti(v => !v)}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs transition-all ${showInvesti ? 'border-[#C8BC9E] bg-[#F5F3EF] dark:bg-[#1B2D3E]' : 'border-[#DDD9D1] dark:border-[#2a3f52] opacity-40'}`}>
        <svg width="20" height="10"><line x1="0" y1="5" x2="20" y2="5" stroke="var(--finv-cost-line)" strokeWidth="1" strokeDasharray="6 3" /></svg>
        <span className="text-[#9E9A93]">Investi</span>
      </button>
      <button type="button" onClick={() => setShowValeur(v => !v)}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs transition-all ${showValeur ? 'border-[#2B6B5A] bg-[#F5F3EF] dark:bg-[#1B2D3E]' : 'border-[#DDD9D1] dark:border-[#2a3f52] opacity-40'}`}>
        <svg width="20" height="10"><line x1="0" y1="5" x2="10" y2="5" stroke="#2B6B5A" strokeWidth="2" /><line x1="10" y1="5" x2="20" y2="5" stroke="#DC2626" strokeWidth="2" /></svg>
        <span className="text-[#9E9A93]">Valeur actuelle</span>
      </button>
      <button type="button" onClick={() => setShowHorsFX(v => !v)}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs transition-all ${showHorsFX ? 'border-[#B5820F] bg-[#F5F3EF] dark:bg-[#1B2D3E]' : 'border-[#DDD9D1] dark:border-[#2a3f52] opacity-40'}`}>
        <svg width="20" height="10"><line x1="0" y1="5" x2="20" y2="5" stroke="#B5820F" strokeWidth="1.5" strokeDasharray="6 3" opacity="0.7" /></svg>
        <span style={{ color: '#B5820F' }}>Hors FX</span>
      </button>
    </div>
    </>
  )
}


// ─── Chart: PnL ──────────────────────────────────────────────────────────────
function inflationBetween(dateAchat: string, dateTo: string): number {
  return cpiAt(dateTo) / cpiAt(dateAchat) - 1
}

function PnLChart({ data, tickerDivs, range, bustKey = 0 }: { data: PositionCalc[]; tickerDivs?: Record<string, { dividendTTM: number; dividends: { ts: number; amount: number }[] }>; range?: 'all' | '60d' | 'weekly'; bustKey?: number }) {
  const [showNominal, setShowNominal] = useState(true)
  const [showReel, setShowReel] = useState(false)
  const [showDividendes, setShowDividendes] = useState(false)
  const W = 600, H = 180, PAD = { t: 16, r: 16, b: 36, l: 64 }
  const iW = W - PAD.l - PAD.r, iH = H - PAD.t - PAD.b

  const [monthlyPts, setMonthlyPts] = useState<{ x: number; nominal: number; reel: number; nominalNoFX: number; dividendes: number; label: string }[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [hoverIdxPnl, setHoverIdxPnl] = useState<number | null>(null)
  const [hoverMxPnl, setHoverMxPnl] = useState<number | null>(null)
  const [zoomWPnl, setZoomWPnl] = useState<[number, number]>([0, 1])
  const zoomDragPnl = useRef<{ startX: number; startZoom: [number, number] } | null>(null)

  const { dates, firstDate, totalMs } = useMemo(() => {
    if (data.length === 0) return { dates: [] as string[], firstDate: new Date(), totalMs: 1 }
    const sorted = [...data].sort((a, b) => new Date(a.dateAchat).getTime() - new Date(b.dateAchat).getTime())
    const today = new Date()
    if (range === '60d') {
      const list: string[] = []
      for (let i = 59; i >= 0; i--) {
        const d = new Date(today); d.setDate(d.getDate() - i)
        list.push(d.toISOString().slice(0, 10))
      }
      const first = new Date(list[0])
      return { dates: list, firstDate: first, totalMs: today.getTime() - first.getTime() || 1 }
    }
    const first = new Date(sorted[0].dateAchat)
    const ms = today.getTime() - first.getTime()
    if (range === 'weekly') {
      const list: string[] = []
      let d = new Date(first)
      while (d <= today) {
        list.push(d.toISOString().slice(0, 10))
        d = new Date(d); d.setDate(d.getDate() + 7)
      }
      return { dates: list, firstDate: first, totalMs: ms || 1 }
    }
    const list: string[] = []
    let d = new Date(first.getFullYear(), first.getMonth(), 1)
    while (d <= today) {
      list.push(d.toISOString().slice(0, 10))
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    }
    return { dates: list, firstDate: first, totalMs: ms || 1 }
  }, [data, range])

  const divKey = Object.keys(tickerDivs ?? {}).sort().join(',')
  const dataKey = useMemo(() => data.map(p => p.ticker + p.dateAchat + p.quantite).join(',') + '|' + (range ?? 'all') + '|' + divKey + '|' + bustKey, [data, range, divKey, bustKey])
  const _bustLastSeenPnL = useRef(0)

  useEffect(() => {
    if (data.length === 0 || dates.length === 0) return
    let cancelled = false
    setLoading(true); setProgress(0); setMonthlyPts(null)

    async function fetchAll() {
      const today = new Date().toISOString().slice(0, 10)
      const result: { x: number; nominal: number; reel: number; nominalNoFX: number; dividendes: number; label: string }[] = []

      // ─── Bulk history (évite N×M appels /api/prices) ──────────────────────
      const allTickers = [...new Set(data.map(p => p.ticker.toUpperCase()))]
      const fxPairs = [...new Set(data.filter(p => p.devise !== 'CHF').map(p => `${p.devise}CHF=X`))]
      const isBust = bustKey > _bustLastSeenPnL.current; _bustLastSeenPnL.current = bustKey
      const histJson = await fetchHistory([...allTickers, ...fxPairs].join(','), isBust) as Record<string, { dates: string[]; closes: number[] }>
      const lookupClose = makeLookupClose(histJson)
      // Pré-calcul unique : date la plus ancienne couverte par l'historique
      const histStart = Object.values(histJson).map(h => h.dates[0]).filter(Boolean).sort()[0] ?? ''

      for (let i = 0; i < dates.length; i++) {
        if (cancelled) return
        const dateStr = dates[i]
        const isToday = dateStr >= today
        const activePosns = data.filter(p => p.dateAchat <= dateStr)
        if (activePosns.length === 0) { setProgress(Math.round((i + 1) / dates.length * 100)); continue }

        // histStart computed once above the loop (not per iteration)
        const useOldest = !isToday && dateStr < histStart

        const prices = await Promise.all(activePosns.map(async p => {
          if (!isToday) {
            const price = lookupClose(p.ticker, dateStr)
            if (price !== null) {
              const fxPair = p.devise !== 'CHF' ? `${p.devise}CHF=X` : null
              const fxRate = fxPair ? (lookupClose(fxPair, dateStr) ?? p.tauxActuelCHF) : 1
              return { price, fxRate }
            }
            // Date is before history window: use oldest history price (avoids rate-limiting Yahoo)
            if (useOldest) {
              const h = histJson[p.ticker.toUpperCase()]
              const fxKey = p.devise !== 'CHF' ? `${p.devise}CHF=X` : null
              const hFx = fxKey ? histJson[fxKey.toUpperCase()] : null
              const price0 = h?.closes[0] ?? p.prixAchat
              const fxRate0 = hFx?.closes[0] ?? p.tauxAchatCHF
              return { price: price0, fxRate: fxRate0 }
            }
          }
          const d = await fetchPriceCached(p.ticker, p.devise, isToday ? undefined : dateStr)
          return d ?? { price: p.prixActuel, fxRate: p.tauxActuelCHF }
        }))

        let nominal = 0, reel = 0, nominalNoFX = 0, dividendes = 0
        const dateTs = new Date(dateStr).getTime()
        for (let j = 0; j < activePosns.length; j++) {
          const p = activePosns[j]
          if (p.quantite < 0 && p.prixVente != null) {
            // Lot de vente clôturé :
            //   qty(négatif) × price(t) × fx  → retire les unités vendues du lot long
            //   + valeurCHF (produits encaissés, fixe) → ajoute le gain réalisé
            // = PnL sur 800 unités restantes + gain réalisé sur 200 vendues
            const valCHF   = p.quantite * prices[j].price * prices[j].fxRate
            const valNoFX  = p.quantite * prices[j].price * p.tauxAchatCHF
            nominal    += valCHF + p.valeurCHF
            nominalNoFX += valNoFX + Math.abs(p.quantite) * p.prixVente * p.tauxAchatCHF
            reel       += valCHF + p.valeurCHF - p.coutCHF * inflationBetween(p.dateAchat, dateStr)
            // pas de dividendes sur une position clôturée
          } else {
            const valCHF = p.quantite * prices[j].price * prices[j].fxRate
            const valNoFX = p.quantite * prices[j].price * p.tauxAchatCHF
            const infAdj = p.coutCHF * (1 + inflationBetween(p.dateAchat, dateStr))
            nominal += valCHF - p.coutCHF
            nominalNoFX += valNoFX - p.coutCHF
            reel    += valCHF - infAdj
            const divEntry = tickerDivs?.[p.ticker.toUpperCase()]
            if (divEntry) {
              const purchaseTsSec = new Date(p.dateAchat).getTime() / 1000
              const dateTsSec = dateTs / 1000
              dividendes += divEntry.dividends
                .filter(d => d.ts >= purchaseTsSec && d.ts <= dateTsSec)
                .reduce((a, d) => a + d.amount, 0) * p.quantite * prices[j].fxRate
            }
          }
        }

        const t = (new Date(dateStr).getTime() - firstDate.getTime()) / totalMs
        const label = range === 'all' ? fmtMonth(dateStr) : range === 'weekly' ? fmtDate(dateStr) : fmtDay(dateStr)
        // Dividendes cumulés intégrés dans nominal et réel (cohérent avec la carte Gains réalisés)
        result.push({ x: isToday ? 1 : Math.min(t, 0.98), nominal: nominal + dividendes, reel: reel + dividendes, nominalNoFX, dividendes, label })
        setProgress(Math.round((i + 1) / dates.length * 100))
      }
      if (!cancelled) { setMonthlyPts(result); setLoading(false) }
    }
    fetchAll()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey])

  const points = monthlyPts

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-36 gap-2">
      <div className="w-48 h-1.5 bg-[#DDD9D1] dark:bg-[#2a3f52] rounded-full overflow-hidden">
        <div className="h-full bg-[#2B6B5A] rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>
      <p className="text-xs text-[#9E9A93]">{range === '60d' ? 'Chargement 60 jours…' : range === 'weekly' ? 'Chargement des données hebdomadaires…' : 'Chargement des données mensuelles…'} {progress}%</p>
    </div>
  )

  if (!points || points.length < 2) return (
    <div className="flex items-center justify-center h-36 text-sm text-[#9E9A93]">
      Ajoutez au moins 2 positions pour voir le graphique
    </div>
  )

  const zP = zoomWPnl
  const isZoomedPnl = zP[0] > 0.001 || zP[1] < 0.999
  const visPtsP = points.filter(p => p.x >= zP[0] - 0.001 && p.x <= zP[1] + 0.001)
  const firstVisP = visPtsP[0] ?? points[0]
  const scalePtsP = isZoomedPnl && visPtsP.length > 1 ? visPtsP : points
  const allValsVis = scalePtsP.flatMap(p => {
    const arr: number[] = []
    if (showNominal) arr.push(p.nominal)
    if (showReel) arr.push(p.reel)
    return arr
  })
  const allValsFallbackVis = allValsVis.length ? allValsVis : scalePtsP.flatMap(p => [p.nominal])
  const _maxRawVis = Math.max(...allValsFallbackVis, 0), _minRawVis = Math.min(...allValsFallbackVis, 0)
  const rawSpanPnlVis = (_maxRawVis - _minRawVis) || Math.abs(_maxRawVis) * 0.1 || 1
  const rawStepPnlVis = rawSpanPnlVis / 4
  const magPnlVis = Math.pow(10, Math.floor(Math.log10(rawStepPnlVis)))
  const normPnlVis = rawStepPnlVis / magPnlVis
  const niceStepVis = (normPnlVis < 1.5 ? 1 : normPnlVis < 3 ? 2 : normPnlVis < 7 ? 5 : 10) * magPnlVis
  const minVVis = Math.floor(_minRawVis / niceStepVis) * niceStepVis
  const maxVVis = Math.ceil(_maxRawVis / niceStepVis) * niceStepVis
  const spanVis = maxVVis - minVVis || 1
  const px = (t: number) => PAD.l + ((t - zP[0]) / (zP[1] - zP[0])) * iW
  const py = (v: number) => PAD.t + iH - ((v - minVVis) / spanVis) * iH
  const tickVals = Array.from({ length: Math.round((maxVVis - minVVis) / niceStepVis) + 1 }, (_, i) => minVVis + i * niceStepVis)
  const zeroY = py(0)

  const nomAreas = showNominal ? buildColoredAreas(points.map(p => ({ x: p.x, val: p.nominal, base: 0 })), px, py) : { gainD: '', lossD: '' }
  const reelAreas = showReel ? buildColoredAreas(points.map(p => ({ x: p.x, val: p.reel, base: 0 })), px, py) : { gainD: '', lossD: '' }
  const lastVisP = visPtsP[visPtsP.length - 1] ?? points[points.length - 1]

  return (
    <>
    {isZoomedPnl && (
      <div className="flex justify-end mb-1">
        <button type="button" onClick={() => setZoomWPnl([0, 1])}
          className="text-xs text-[#9E9A93] hover:text-[#2B6B5A] px-2 py-0.5 rounded border border-[#DDD9D1] dark:border-[#2a3f52]">
          ↺ Réinitialiser zoom
        </button>
      </div>
    )}
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H, cursor: isZoomedPnl ? 'grab' : 'default' }}
      onMouseLeave={() => { setHoverIdxPnl(null); setHoverMxPnl(null); zoomDragPnl.current = null }}
      onMouseDown={e => {
        if (!isZoomedPnl) return
        const svgEl = e.currentTarget as SVGSVGElement; const pt = svgEl.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const mx = pt.matrixTransform(svgEl.getScreenCTM()!.inverse()).x
        zoomDragPnl.current = { startX: mx, startZoom: [zP[0], zP[1]] }
        e.preventDefault()
      }}
      onMouseUp={() => { zoomDragPnl.current = null }}
      onMouseMove={e => {
        const svgEl = e.currentTarget as SVGSVGElement; const pt = svgEl.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const mx = pt.matrixTransform(svgEl.getScreenCTM()!.inverse()).x
        if (zoomDragPnl.current) {
          const delta = (zoomDragPnl.current.startX - mx) / iW * (zP[1] - zP[0])
          const [z0, z1] = zoomDragPnl.current.startZoom
          const sp = z1 - z0
          const newZ0 = Math.max(0, Math.min(1 - sp, z0 + delta))
          setZoomWPnl([newZ0, newZ0 + sp])
          return
        }
        const t = zP[0] + ((mx - PAD.l) / iW) * (zP[1] - zP[0])
        let best = 0, bd = Infinity
        points.forEach((p, i) => { const d = Math.abs(p.x - t); if (d < bd) { bd = d; best = i } })
        setHoverIdxPnl(best); setHoverMxPnl(mx)
      }}
      onWheel={e => {
        e.preventDefault()
        const svgEl = e.currentTarget as SVGSVGElement; const pt = svgEl.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const mx = pt.matrixTransform(svgEl.getScreenCTM()!.inverse()).x
        const t = zP[0] + ((mx - PAD.l) / iW) * (zP[1] - zP[0])
        const factor = zP[1] - zP[0]
        const nf = Math.min(1, Math.max(0.05, factor * (e.deltaY > 0 ? 1.3 : 0.77)))
        const ratio = (t - zP[0]) / factor
        const newZ0 = Math.max(0, Math.min(1 - nf, t - ratio * nf))
        setZoomWPnl([newZ0, newZ0 + nf])
      }}>
      <defs>
        <clipPath id="pnl-clip"><rect x={PAD.l} y={PAD.t} width={iW} height={iH} /></clipPath>
        <linearGradient id="pnl-ng" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2B6B5A" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#2B6B5A" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="pnl-nl" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#DC2626" stopOpacity="0.02" />
          <stop offset="100%" stopColor="#DC2626" stopOpacity="0.20" />
        </linearGradient>
        <linearGradient id="pnl-rg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1B5C80" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#1B5C80" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="pnl-rl" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#DC2626" stopOpacity="0.02" />
          <stop offset="100%" stopColor="#DC2626" stopOpacity="0.14" />
        </linearGradient>
      </defs>
      {tickVals.map((v, i) => (
        <g key={i}>
          <line x1={PAD.l} y1={py(v)} x2={W - PAD.r} y2={py(v)} stroke="#DDD9D1" strokeWidth="0.5" strokeDasharray="3 3" />
          <text x={PAD.l - 6} y={py(v) + 4} textAnchor="end" fontSize="10" fill="#9E9A93">
            {v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v >= 0 ? `+${v.toFixed(0)}` : v.toFixed(0)}
          </text>
        </g>
      ))}
      <g clipPath="url(#pnl-clip)">
      {zeroY >= PAD.t && zeroY <= PAD.t + iH && (
        <line x1={PAD.l} y1={zeroY} x2={W - PAD.r} y2={zeroY} stroke="#9E9A93" strokeWidth="1" />
      )}
      {showReel && (
        <>
          {reelAreas.gainD && <path d={reelAreas.gainD} fill="url(#pnl-rg)" />}
          {reelAreas.lossD && <path d={reelAreas.lossD} fill="url(#pnl-rl)" />}
          {points.slice(0, -1).map((p0, i) => {
            const p1 = points[i + 1]
            const d0 = p0.reel, d1 = p1.reel
            if (d0 >= 0 && d1 >= 0) return <line key={i} x1={px(p0.x)} y1={py(d0)} x2={px(p1.x)} y2={py(d1)} stroke="#1B5C80" strokeWidth="1.5" strokeDasharray="5 3" strokeLinecap="round" />
            if (d0 <= 0 && d1 <= 0) return <line key={i} x1={px(p0.x)} y1={py(d0)} x2={px(p1.x)} y2={py(d1)} stroke="#DC2626" strokeWidth="1.5" strokeDasharray="5 3" strokeLinecap="round" />
            const t = d0 / (d0 - d1)
            const cx = px(p0.x) + t * (px(p1.x) - px(p0.x))
            const cy = py(d0) + t * (py(d1) - py(d0))
            return <g key={i}>
              <line x1={px(p0.x)} y1={py(d0)} x2={cx} y2={cy} stroke={d0 > 0 ? '#1B5C80' : '#DC2626'} strokeWidth="1.5" strokeDasharray="5 3" strokeLinecap="round" />
              <line x1={cx} y1={cy} x2={px(p1.x)} y2={py(d1)} stroke={d0 > 0 ? '#DC2626' : '#1B5C80'} strokeWidth="1.5" strokeDasharray="5 3" strokeLinecap="round" />
            </g>
          })}
          <circle cx={px(points[points.length-1].x)} cy={py(points[points.length-1].reel)} r="3.5" fill={points[points.length-1].reel >= 0 ? '#1B5C80' : '#DC2626'} />
        </>
      )}
      {showNominal && (
        <>
          {nomAreas.gainD && <path d={nomAreas.gainD} fill="url(#pnl-ng)" />}
          {nomAreas.lossD && <path d={nomAreas.lossD} fill="url(#pnl-nl)" />}
          {points.slice(0, -1).map((p0, i) => {
            const p1 = points[i + 1]
            const d0 = p0.nominal, d1 = p1.nominal
            if (d0 >= 0 && d1 >= 0) return <line key={i} x1={px(p0.x)} y1={py(d0)} x2={px(p1.x)} y2={py(d1)} stroke="#2B6B5A" strokeWidth="2" strokeLinecap="round" />
            if (d0 <= 0 && d1 <= 0) return <line key={i} x1={px(p0.x)} y1={py(d0)} x2={px(p1.x)} y2={py(d1)} stroke="#DC2626" strokeWidth="2" strokeLinecap="round" />
            const t = d0 / (d0 - d1)
            const cx = px(p0.x) + t * (px(p1.x) - px(p0.x))
            const cy = py(d0) + t * (py(d1) - py(d0))
            return <g key={i}>
              <line x1={px(p0.x)} y1={py(d0)} x2={cx} y2={cy} stroke={d0 > 0 ? '#2B6B5A' : '#DC2626'} strokeWidth="2" strokeLinecap="round" />
              <line x1={cx} y1={cy} x2={px(p1.x)} y2={py(d1)} stroke={d0 > 0 ? '#DC2626' : '#2B6B5A'} strokeWidth="2" strokeLinecap="round" />
            </g>
          })}
          <circle cx={px(points[points.length-1].x)} cy={py(points[points.length-1].nominal)} r="4" fill={points[points.length-1].nominal >= 0 ? '#2B6B5A' : '#DC2626'} />
        </>
      )}
      {showDividendes && (
        <path
          d={points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${px(p.x)} ${py(p.dividendes)}`).join(' ')}
          fill="none" stroke="#F59E0B" strokeWidth="1.5"
        />
      )}
      </g>
      <text x={Math.max(PAD.l + 4, Math.min(W - PAD.r - 4, px(firstVisP.x)))} y={H - 6} textAnchor="middle" fontSize="10" fill="#9E9A93">{firstVisP.label}</text>
      <text x={Math.max(PAD.l + 4, Math.min(W - PAD.r - 4, px(lastVisP.x)))} y={H - 6} textAnchor="middle" fontSize="10" fill="#9E9A93">{lastVisP === points[points.length-1] ? 'Auj.' : lastVisP.label}</text>
      {hoverIdxPnl !== null && (() => {
        const hov = points[hoverIdxPnl]
        const lines: {label: string; val: number; col: string}[] = []
        if (showNominal) lines.push({ label: 'Nominal', val: hov.nominal, col: hov.nominal >= 0 ? '#4ADE80' : '#F87171' })
        if (showReel) lines.push({ label: 'Réel', val: hov.reel, col: hov.reel >= 0 ? '#6BB8E0' : '#F87171' })
        if (showDividendes) lines.push({ label: 'Dividendes', val: hov.dividendes, col: '#F59E0B' })
        const bh = 18 + lines.length * 16
        const tx = Math.min(Math.max(px(hov.x), PAD.l + 58), W - PAD.r - 58)
        const refV = showNominal ? hov.nominal : showReel ? hov.reel : 0
        const ty = Math.max(PAD.t + bh + 4, py(refV) - 10)
        return (
          <g>
            <line x1={hoverMxPnl ?? px(hov.x)} y1={PAD.t} x2={hoverMxPnl ?? px(hov.x)} y2={H - PAD.b} stroke="#9E9A93" strokeWidth="0.8" strokeDasharray="3 2" />
            {showNominal && <circle cx={px(hov.x)} cy={py(hov.nominal)} r="3.5" fill={hov.nominal >= 0 ? '#2B6B5A' : '#DC2626'} />}
            {showReel && <circle cx={px(hov.x)} cy={py(hov.reel)} r="3" fill={hov.reel >= 0 ? '#1B5C80' : '#DC2626'} />}
            {showDividendes && hov.dividendes > 0 && <circle cx={px(hov.x)} cy={py(hov.dividendes)} r="3" fill="#F59E0B" />}
            <g transform={`translate(${tx},${ty})`}>
              <rect x="-58" y={-bh} width="116" height={bh + 4} rx="4" fill="#1C2B22" opacity="0.92" />
              <text x="0" y={-(bh - 12)} textAnchor="middle" fontSize="10" fill="#9E9A93">{hov.label}</text>
              {lines.map((l, i) => (
                <g key={i}>
                  <text x="-4" y={-(bh - 12) + 14 + i * 16} textAnchor="end" fontSize="10" fill="#9E9A93">{l.label}</text>
                  <text x="4" y={-(bh - 12) + 14 + i * 16} textAnchor="start" fontSize="10" fill={l.col}>{l.val >= 0 ? '+' : ''}{Math.abs(l.val) >= 1000 ? `${(l.val/1000).toFixed(1)}k` : l.val.toFixed(0)} CHF</text>
                </g>
              ))}
            </g>
          </g>
        )
      })()}
    </svg>
    <div className="flex items-center gap-2 mt-2 flex-wrap">
      <button type="button" onClick={() => setShowNominal(v => !v)}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs transition-all ${showNominal ? 'border-[#2B6B5A] bg-[#F5F3EF] dark:bg-[#1B2D3E]' : 'border-[#DDD9D1] dark:border-[#2a3f52] opacity-40'}`}>
        <svg width="20" height="10"><line x1="0" y1="5" x2="10" y2="5" stroke="#2B6B5A" strokeWidth="2" /><line x1="10" y1="5" x2="20" y2="5" stroke="#DC2626" strokeWidth="2" /></svg>
        <span className="text-[#9E9A93]">Nominal</span>
      </button>
      <button type="button" onClick={() => setShowReel(v => !v)}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs transition-all ${showReel ? 'border-[#1B5C80] bg-[#F5F3EF] dark:bg-[#1B2D3E]' : 'border-[#DDD9D1] dark:border-[#2a3f52] opacity-40'}`}>
        <svg width="20" height="10"><line x1="0" y1="5" x2="10" y2="5" stroke="#1B5C80" strokeWidth="1.5" strokeDasharray="5 3" /><line x1="10" y1="5" x2="20" y2="5" stroke="#DC2626" strokeWidth="1.5" strokeDasharray="5 3" /></svg>
        <span className="text-[#9E9A93]">Réel</span>
      </button>

    </div>
    </>
  )
}


// ─── Chart: Drawdown ─────────────────────────────────────────────────────────
function DrawdownChart({ data, onMaxDrawdown, range, bustKey = 0 }: { data: PositionCalc[]; onMaxDrawdown?: (pct: number, date: string) => void; range?: 'all' | '60d' | 'weekly'; bustKey?: number }) {
  const W = 600, H = 180, PAD = { t: 16, r: 16, b: 36, l: 56 }
  const iW = W - PAD.l - PAD.r, iH = H - PAD.t - PAD.b

  const [ddPts, setDdPts] = useState<{ x: number; dd: number; label: string }[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const [hoverMxDd, setHoverMxDd] = useState<number | null>(null)
  const [zoomWDd, setZoomWDd] = useState<[number, number]>([0, 1])
  const zoomDragDd = useRef<{ startX: number; startZoom: [number, number] } | null>(null)

  const { dates, firstDate, totalMs } = useMemo(() => {
    if (data.length === 0) return { dates: [] as string[], firstDate: new Date(), totalMs: 1 }
    const sorted = [...data].sort((a, b) => new Date(a.dateAchat).getTime() - new Date(b.dateAchat).getTime())
    const today = new Date()
    if (range === '60d') {
      const list: string[] = []
      for (let i = 59; i >= 0; i--) {
        const d = new Date(today); d.setDate(d.getDate() - i)
        list.push(d.toISOString().slice(0, 10))
      }
      const first = new Date(list[0])
      return { dates: list, firstDate: first, totalMs: today.getTime() - first.getTime() || 1 }
    }
    const first = new Date(sorted[0].dateAchat)
    const ms = today.getTime() - first.getTime()
    if (range === 'weekly') {
      const list: string[] = []
      let d = new Date(first)
      while (d <= today) {
        list.push(d.toISOString().slice(0, 10))
        d = new Date(d); d.setDate(d.getDate() + 7)
      }
      return { dates: list, firstDate: first, totalMs: ms || 1 }
    }
    const list: string[] = []
    let d = new Date(first.getFullYear(), first.getMonth(), 1)
    while (d <= today) { list.push(d.toISOString().slice(0, 10)); d = new Date(d.getFullYear(), d.getMonth() + 1, 1) }
    return { dates: list, firstDate: first, totalMs: ms || 1 }
  }, [data, range])

  const dataKey = useMemo(() => data.map(p => p.ticker + p.dateAchat + p.quantite).join(',') + '|' + (range ?? 'all') + '|' + bustKey, [data, range, bustKey])
  const _bustLastSeenDD = useRef(0)

  useEffect(() => {
    if (data.length === 0 || dates.length === 0) return
    let cancelled = false
    setLoading(true)
    async function fetchAll() {
      const today = new Date().toISOString().slice(0, 10)
      const values: { x: number; value: number; label: string }[] = []

      // ─── Bulk history (évite N×M appels /api/prices) ──────────────────────
      const allTickers = [...new Set(data.map(p => p.ticker.toUpperCase()))]
      const fxPairs = [...new Set(data.filter(p => p.devise !== 'CHF').map(p => `${p.devise}CHF=X`))]
      const isBust = bustKey > _bustLastSeenDD.current; _bustLastSeenDD.current = bustKey
      const histJson = await fetchHistory([...allTickers, ...fxPairs].join(','), isBust) as Record<string, { dates: string[]; closes: number[] }>
      const lookupClose = makeLookupClose(histJson)

      for (let i = 0; i < dates.length; i++) {
        if (cancelled) return
        const dateStr = dates[i]
        const isToday = dateStr >= today
        const active = data.filter(p => p.dateAchat <= dateStr)
        if (active.length === 0) continue

        // Pour les dates historiques, on exige des données réelles pour TOUS les actifs actifs.
        // Utiliser p.prixActuel comme fallback introduirait de faux pics (prix actuel > prix historique)
        // ce qui gonflerait artificiellement le drawdown calculé depuis ce faux sommet.
        if (!isToday) {
          const allHaveData = active.every(p => lookupClose(p.ticker, dateStr) !== null)
          if (!allHaveData) continue
        }

        const prices = await Promise.all(active.map(async p => {
          if (!isToday) {
            const price = lookupClose(p.ticker, dateStr)!
            const fxPair = p.devise !== 'CHF' ? `${p.devise}CHF=X` : null
            const fxRate = fxPair ? (lookupClose(fxPair, dateStr) ?? p.tauxActuelCHF) : 1
            return { price, fxRate }
          }
          const d = await fetchPriceCached(p.ticker, p.devise, undefined)
          return d ?? { price: p.prixActuel, fxRate: p.tauxActuelCHF }
        }))
        const value = active.reduce((s, p, j) => s + p.quantite * prices[j].price * prices[j].fxRate, 0)
        const t = (new Date(dateStr).getTime() - firstDate.getTime()) / totalMs
        const label = range === 'all' ? fmtMonth(dateStr) : range === 'weekly' ? fmtDate(dateStr) : fmtDay(dateStr)
        values.push({ x: isToday ? 1 : Math.min(t, 0.98), value, label })
      }
      if (cancelled) return
      let peak = -Infinity
      const result: { x: number; dd: number; label: string }[] = []
      for (const v of values) {
        if (v.value > peak) peak = v.value
        result.push({ x: v.x, dd: peak > 0 ? ((v.value - peak) / peak) * 100 : 0, label: v.label })
      }
      const maxDDPt = result.reduce((m, p) => p.dd < m.dd ? p : m, result[0])
      if (onMaxDrawdown && maxDDPt) onMaxDrawdown(maxDDPt.dd, maxDDPt.label)
      setDdPts(result)
      setLoading(false)
    }
    fetchAll()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey])

  if (loading) return <div className="flex items-center justify-center h-20 text-xs text-[#9E9A93]">Calcul du drawdown…</div>
  const points = ddPts
  if (!points || points.length < 2) return null

  const zD = zoomWDd
  const isZoomedDd = zD[0] > 0.001 || zD[1] < 0.999
  const visPtsD = points.filter(p => p.x >= zD[0] - 0.001 && p.x <= zD[1] + 0.001)
  const firstVisD = visPtsD[0] ?? points[0]
  const lastVisD = visPtsD[visPtsD.length - 1] ?? points[points.length - 1]
  const scalePtsD = isZoomedDd && visPtsD.length > 1 ? visPtsD : points
  const minDD = Math.min(...scalePtsD.map(p => p.dd), -0.01)
  const maxV = 0, minV = minDD * 1.2, span = maxV - minV || 1
  const px = (t: number) => PAD.l + ((t - zD[0]) / (zD[1] - zD[0])) * iW
  const py = (v: number) => PAD.t + iH - ((v - minV) / span) * iH
  const zeroY = py(0)
  const tickCount = 4
  const tickVals = Array.from({ length: tickCount + 1 }, (_, i) => minV + (span * i) / tickCount)
  const areaPath = [`M ${px(points[0].x)} ${zeroY}`, ...points.map(p => `L ${px(p.x)} ${py(p.dd)}`), `L ${px(points[points.length-1].x)} ${zeroY}`, 'Z'].join(' ')
  const maxDDPt = points.reduce((m, p) => p.dd < m.dd ? p : m, points[0])
  const hovered = hoverIdx !== null ? points[hoverIdx] : null

  return (
    <>
    {isZoomedDd && (
      <div className="flex justify-end mb-1">
        <button type="button" onClick={() => setZoomWDd([0, 1])}
          className="text-xs text-[#9E9A93] hover:text-[#2B6B5A] px-2 py-0.5 rounded border border-[#DDD9D1] dark:border-[#2a3f52]">
          ↺ Réinitialiser zoom
        </button>
      </div>
    )}
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H, cursor: isZoomedDd ? 'grab' : 'default' }}
      onMouseLeave={() => { setHoverIdx(null); setHoverMxDd(null); zoomDragDd.current = null }}
      onMouseDown={e => {
        if (!isZoomedDd) return
        const svgEl = e.currentTarget as SVGSVGElement; const pt = svgEl.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const mx = pt.matrixTransform(svgEl.getScreenCTM()!.inverse()).x
        zoomDragDd.current = { startX: mx, startZoom: [zD[0], zD[1]] }
        e.preventDefault()
      }}
      onMouseUp={() => { zoomDragDd.current = null }}
      onMouseMove={e => {
        const svgEl = e.currentTarget as SVGSVGElement; const pt = svgEl.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const mx = pt.matrixTransform(svgEl.getScreenCTM()!.inverse()).x
        if (zoomDragDd.current) {
          const delta = (zoomDragDd.current.startX - mx) / iW * (zD[1] - zD[0])
          const [z0, z1] = zoomDragDd.current.startZoom
          const sp = z1 - z0
          const newZ0 = Math.max(0, Math.min(1 - sp, z0 + delta))
          setZoomWDd([newZ0, newZ0 + sp])
          return
        }
        const t = zD[0] + ((mx - PAD.l) / iW) * (zD[1] - zD[0])
        let best = 0, bd = Infinity
        points.forEach((p, i) => { const d = Math.abs(p.x - t); if (d < bd) { bd = d; best = i } })
        setHoverIdx(best); setHoverMxDd(mx)
      }}
      onWheel={e => {
        e.preventDefault()
        const svgEl = e.currentTarget as SVGSVGElement; const pt = svgEl.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const mx = pt.matrixTransform(svgEl.getScreenCTM()!.inverse()).x
        const t = zD[0] + ((mx - PAD.l) / iW) * (zD[1] - zD[0])
        const factor = zD[1] - zD[0]
        const nf = Math.min(1, Math.max(0.05, factor * (e.deltaY > 0 ? 1.3 : 0.77)))
        const ratio = (t - zD[0]) / factor
        const newZ0 = Math.max(0, Math.min(1 - nf, t - ratio * nf))
        setZoomWDd([newZ0, newZ0 + nf])
      }}
    >
      <defs>
        <clipPath id="dd-clip"><rect x={PAD.l} y={PAD.t} width={iW} height={iH} /></clipPath>
        <linearGradient id="dd-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#DC2626" stopOpacity="0.30" />
          <stop offset="100%" stopColor="#DC2626" stopOpacity="0.04" />
        </linearGradient>
      </defs>
      {tickVals.map((v, i) => (
        <g key={i}>
          <line x1={PAD.l} y1={py(v)} x2={W - PAD.r} y2={py(v)} stroke="#DDD9D1" strokeWidth="0.5" strokeDasharray="3 3" />
          <text x={PAD.l - 4} y={py(v) + 4} textAnchor="end" fontSize="10" fill="#9E9A93">{v.toFixed(0)}%</text>
        </g>
      ))}
      <g clipPath="url(#dd-clip)">
      <line x1={PAD.l} y1={zeroY} x2={W - PAD.r} y2={zeroY} stroke="#9E9A93" strokeWidth="0.8" />
      <path d={areaPath} fill="url(#dd-fill)" />
      <path d={points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${px(p.x)} ${py(p.dd)}`).join(' ')} fill="none" stroke="#DC2626" strokeWidth="1.5" />
      <circle cx={px(maxDDPt.x)} cy={py(maxDDPt.dd)} r="3.5" fill="#DC2626" />
      {hovered && (
        <g>
          <line x1={hoverMxDd ?? px(hovered.x)} y1={PAD.t} x2={hoverMxDd ?? px(hovered.x)} y2={H - PAD.b} stroke="#9E9A93" strokeWidth="0.8" strokeDasharray="3 2" />
          <circle cx={px(hovered.x)} cy={py(hovered.dd)} r="3" fill="#DC2626" />
          {(() => {
            const tx = Math.min(Math.max(px(hovered.x), PAD.l + 58), W - PAD.r - 58)
            const below = py(hovered.dd) + 20 < H - PAD.b - 20
            const ty = below ? py(hovered.dd) + 12 : py(hovered.dd) - 36
            return (
              <g transform={`translate(${tx}, ${ty})`}>
                <rect x="-55" y="-4" width="110" height="30" rx="4" fill="#2A1515" opacity="0.92" />
                <text x="0" y="8" textAnchor="middle" fontSize="10" fill="#9E9A93">{hovered.label}</text>
                <text x="0" y="20" textAnchor="middle" fontSize="10" fill="#F87171" fontWeight="600">{hovered.dd.toFixed(2)}%</text>
              </g>
            )
          })()}
        </g>
      )}
      </g>
      <text x={Math.max(PAD.l + 4, Math.min(W - PAD.r - 4, px(firstVisD.x)))} y={H - 6} textAnchor="middle" fontSize="10" fill="#9E9A93">{firstVisD.label}</text>
      <text x={Math.max(PAD.l + 4, Math.min(W - PAD.r - 4, px(lastVisD.x)))} y={H - 6} textAnchor="middle" fontSize="10" fill="#9E9A93">{lastVisD === points[points.length-1] ? 'Auj.' : lastVisD.label}</text>

    </svg>
    <div style={{ height: 32 }} />
    </>
  )
}


const CATS = ['ETF Oblig.', 'ETF', 'Actions', 'Matières premières', 'Monnaies', 'Crypto']
const CAT_VOL: Record<string, number> = {
  'ETF Oblig.': 0.08, 'ETF': 0.15, 'Actions': 0.25,
  'Matières premières': 0.20, 'Monnaies': 0.12, 'Crypto': 0.70,
}
const CORR: Record<string, Record<string, number>> = {
  'ETF Oblig.':        { 'ETF Oblig.': 1.00, 'ETF': -0.10, 'Actions': -0.05, 'Matières premières':  0.05, 'Monnaies': -0.15, 'Crypto':  0.00 },
  'ETF':                { 'ETF Oblig.': -0.10, 'ETF': 1.00, 'Actions':  0.80, 'Matières premières':  0.30, 'Monnaies':  0.10, 'Crypto':  0.20 },
  'Actions':            { 'ETF Oblig.': -0.05, 'ETF': 0.80, 'Actions':  1.00, 'Matières premières':  0.20, 'Monnaies':  0.05, 'Crypto':  0.25 },
  'Matières premières': { 'ETF Oblig.':  0.05, 'ETF': 0.30, 'Actions':  0.20, 'Matières premières':  1.00, 'Monnaies':  0.15, 'Crypto':  0.10 },
  'Monnaies':           { 'ETF Oblig.': -0.15, 'ETF': 0.10, 'Actions':  0.05, 'Matières premières':  0.15, 'Monnaies':  1.00, 'Crypto':  0.05 },
  'Crypto':             { 'ETF Oblig.':  0.00, 'ETF': 0.20, 'Actions':  0.25, 'Matières premières':  0.10, 'Monnaies':  0.05, 'Crypto':  1.00 },
}

// ─── Chart: Allocation ────────────────────────────────────────────
function AllocChart({ data }: { data: PositionCalc[] }) {
  const [hovered, setHovered] = React.useState<string | null>(null)
  // Valeur nette par catégorie — même logique FIFO que l'onglet Positions :
  //   1. Exclure les positions clôturées (dateVente présent)
  //   2. Grouper par ticker, calculer la quantité nette (lots longs − réductions)
  //   3. Si qté nette > 0 → valeur = qté nette × prix actuel × taux CHF
  const openVal = React.useMemo(() => {
    const byTicker: Record<string, PositionCalc[]> = {}
    for (const p of data) {
      if (p.dateVente) continue
      const k = p.ticker.toUpperCase();
      (byTicker[k] ??= []).push(p)
    }
    const result: { categorie: string; valeurCHF: number }[] = []
    for (const lots of Object.values(byTicker)) {
      const netQty = lots.reduce((s, p) => s + p.quantite, 0)
      if (netQty <= 0) continue
      const ref = lots.find(p => p.quantite > 0) ?? lots[0]
      result.push({ categorie: ref.categorie, valeurCHF: netQty * ref.prixActuel * ref.tauxActuelCHF })
    }
    return result
  }, [data])

  const totalVal = openVal.reduce((s, p) => s + p.valeurCHF, 0)
  if (totalVal <= 0) return null
  const byCategory = CATEGORIES
    .map(cat => ({ cat, val: openVal.filter(p => p.categorie === cat).reduce((s, p) => s + p.valeurCHF, 0), color: CAT_COLOR[cat] }))
    .filter(c => c.val > 0).sort((a, b) => b.val - a.val)

  const CX = 90, CY = 90, R = 72, IR = 46
  const GAP = 0.018 // radians gap between slices
  const slices: { cat: string; color: string; val: number; pct: number; startA: number; endA: number }[] = []
  let cursor = -Math.PI / 2
  for (const { cat, val, color } of byCategory) {
    const pct = val / totalVal
    const sweep = pct * 2 * Math.PI - GAP
    slices.push({ cat, color, val, pct: pct * 100, startA: cursor + GAP / 2, endA: cursor + GAP / 2 + sweep })
    cursor += pct * 2 * Math.PI
  }

  function arc(cx: number, cy: number, r: number, ir: number, startA: number, endA: number, expand = 0) {
    const cos = Math.cos, sin = Math.sin
    const re = r + expand, ire = ir - expand
    const x1 = cx + re * cos(startA), y1 = cy + re * sin(startA)
    const x2 = cx + re * cos(endA),   y2 = cy + re * sin(endA)
    const x3 = cx + ire * cos(endA),  y3 = cy + ire * sin(endA)
    const x4 = cx + ire * cos(startA),y4 = cy + ire * sin(startA)
    const large = endA - startA > Math.PI ? 1 : 0
    return `M ${x1} ${y1} A ${re} ${re} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${ire} ${ire} 0 ${large} 0 ${x4} ${y4} Z`
  }

  const hovSlice = slices.find(s => s.cat === hovered)
  const centerLabel = hovSlice
    ? { top: hovSlice.pct.toFixed(1) + '%', bottom: hovSlice.cat }
    : { top: (totalVal / 1000).toFixed(1) + 'k', bottom: 'CHF total' }

  return (
    <div className="flex items-center gap-6">
      <svg width="180" height="180" viewBox="0 0 180 180" className="flex-shrink-0">
        {slices.map(s => (
          <path
            key={s.cat}
            d={arc(CX, CY, R, IR, s.startA, s.endA, hovered === s.cat ? 4 : 0)}
            fill={s.color}
            opacity={hovered && hovered !== s.cat ? 0.35 : 1}
            style={{ transition: 'opacity 0.15s, d 0.15s', cursor: 'pointer' }}
            onMouseEnter={() => setHovered(s.cat)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
        <text x={CX} y={CY - 7} textAnchor="middle" fontSize="15" fontWeight="700"
          fill={hovSlice ? hovSlice.color : '#1B3050'} className="dark:fill-white font-mono">
          {centerLabel.top}
        </text>
        <text x={CX} y={CY + 10} textAnchor="middle" fontSize="9.5" fill="#9E9A93">
          {centerLabel.bottom}
        </text>
      </svg>
      <div className="flex flex-col gap-2 justify-center">
        {slices.map(({ cat, pct, color }) => (
          <div key={cat}
            className="flex items-center gap-1.5 cursor-pointer"
            style={{ opacity: hovered && hovered !== cat ? 0.4 : 1, transition: 'opacity 0.15s' }}
            onMouseEnter={() => setHovered(cat)}
            onMouseLeave={() => setHovered(null)}
          >
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            <span className="text-xs font-mono text-[#1B3050] dark:text-[#E8E4DC]">{pct.toFixed(0)}%</span>
            <span className="text-xs text-[#5C6880]">{cat}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Investor Profile ────────────────────────────────────────────────────────
const RF_RATE = 0.008
const MKT_ER  = 0.095
const BETA: Record<string, number> = {
  'ETF Oblig.': 0.05, 'ETF': 1.00, 'Actions': 1.25,
  'Matières premières': 0.55, 'Monnaies': 0.15, 'Crypto': 1.80,
}
const EXPECTED_RETURN: Record<string, number> = Object.fromEntries(
  Object.entries(BETA).map(([k, b]) => [k, RF_RATE + b * (MKT_ER - RF_RATE)])
)
const STRESS: { label: string; shocks: Record<string, number>; peakDate: string; troughDate: string }[] = [
  { label: 'Grande Crise Financière 2008', peakDate: '2007-10-09', troughDate: '2009-03-09', shocks: { 'ETF Oblig.': -0.03, 'ETF': -0.57, 'Actions': -0.75, 'Matières premières': -0.70, 'Monnaies': -0.10, 'Crypto': 0 } },
  { label: 'COVID-19 Mars 2020',           peakDate: '2020-02-19', troughDate: '2020-03-23', shocks: { 'ETF Oblig.':  0.05, 'ETF': -0.34, 'Actions': -0.45, 'Matières premières': -0.32, 'Monnaies':  0.00, 'Crypto': -0.50 } },
  { label: 'Choc taux 2022',               peakDate: '2021-12-31', troughDate: '2022-10-12', shocks: { 'ETF Oblig.': -0.20, 'ETF': -0.19, 'Actions': -0.25, 'Matières premières':  0.25, 'Monnaies':  0.08, 'Crypto': -0.75 } },
]
interface InvProfile {
  horizon: number
  loss: number
  liquidity: 'haute' | 'moyenne' | 'faible'
  objective: 'inflation' | 'modéré' | 'croissance' | 'agressif'
}

function normalRand(): number {
  let u = 0, v = 0
  while (!u) u = Math.random()
  while (!v) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}
function pctile(arr: number[], p: number): number {
  const s = [...arr].sort((a, b) => a - b)
  return s[Math.min(Math.floor(p / 100 * s.length), s.length - 1)]
}
function portfolioSigma(catWeights: Record<string, number>): number {
  let v = 0
  for (const ci of CATS) for (const cj of CATS)
    v += (catWeights[ci] ?? 0) * (catWeights[cj] ?? 0) * (CAT_VOL[ci] ?? 0.15) * (CAT_VOL[cj] ?? 0.15) * (CORR[ci]?.[cj] ?? 0)
  return Math.sqrt(Math.max(0, v))
}
function portfolioER(catWeights: Record<string, number>): number {
  return CATS.reduce((s, c) => s + (catWeights[c] ?? 0) * (EXPECTED_RETURN[c] ?? RF_RATE), 0)
}

// ─── Profile scoring (shared by InvProfileCard and InvestorProfileSection) ───
function deriveProfileType(profile: InvProfile) {
  let score = 0
  score += profile.horizon >= 20 ? 4 : profile.horizon >= 10 ? 3 : profile.horizon >= 5 ? 2 : 1
  score += profile.loss >= 40 ? 4 : profile.loss >= 25 ? 3 : profile.loss >= 15 ? 2 : 1
  score += profile.liquidity === 'faible' ? 3 : profile.liquidity === 'moyenne' ? 2 : 1
  score += profile.objective === 'agressif' ? 4 : profile.objective === 'croissance' ? 3 : profile.objective === 'modéré' ? 2 : 1
  if (score <= 5)  return { label: 'Prudent',   color: '#4A7EA5', desc: 'Capital preservation, faible risque.' }
  if (score <= 8)  return { label: 'Défensif',  color: '#4A8573', desc: 'Rendement régulier, volatilité limitée.' }
  if (score <= 11) return { label: 'Équilibré', color: '#C4952A', desc: 'Équilibre croissance / sécurité.' }
  if (score <= 14) return { label: 'Dynamique', color: '#B8722A', desc: 'Croissance prioritaire, tolérance modérée.' }
  return               { label: 'Agressif',  color: '#A85050', desc: 'Maximisation du rendement long terme.' }
}

function InvProfileCard({ profile }: { profile: InvProfile }) {
  const profileType = React.useMemo(() => deriveProfileType(profile), [profile])

  return (
    <div className="bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#1B3050] dark:text-white">Profil d&apos;investisseur</h3>
        <a href="/profil" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#DDD9D1] dark:border-[#1e3347] text-xs font-medium text-[#2B6B5A] hover:bg-[#F5F3EF] dark:hover:bg-[#1B2D3E] transition-colors">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M9 1L11 3L4 10H2V8L9 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
          Modifier
        </a>
      </div>
      <div className="flex items-center gap-3">
        <div>
          <p className="font-semibold text-sm" style={{ color: profileType.color }}>{profileType.label}</p>
          <p className="text-xs text-[#5C6880] dark:text-[#7B8DA6]">{profileType.desc}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-[#F5F3EF] dark:bg-[#1B2D3E] rounded-lg p-3">
          <p className="text-xs text-[#9E9A93] mb-0.5">Horizon</p>
          <p className="text-sm font-semibold text-[#1B3050] dark:text-white">{profile.horizon} ans</p>
        </div>
        <div className="bg-[#F5F3EF] dark:bg-[#1B2D3E] rounded-lg p-3">
          <p className="text-xs text-[#9E9A93] mb-0.5">Tolérance perte</p>
          <p className="text-sm font-semibold text-[#1B3050] dark:text-white">-{profile.loss} %</p>
        </div>
        <div className="bg-[#F5F3EF] dark:bg-[#1B2D3E] rounded-lg p-3">
          <p className="text-xs text-[#9E9A93] mb-0.5">Besoin de liquidité</p>
          <p className="text-sm font-semibold text-[#1B3050] dark:text-white">{profile.liquidity === 'haute' ? '1–3 ans' : profile.liquidity === 'moyenne' ? '3–7 ans' : '7+ ans'}</p>
        </div>
        <div className="bg-[#F5F3EF] dark:bg-[#1B2D3E] rounded-lg p-3">
          <p className="text-xs text-[#9E9A93] mb-0.5">Objectif</p>
          <p className="text-sm font-semibold text-[#1B3050] dark:text-white">{profile.objective === 'inflation' ? '~2–3 %/an' : profile.objective === 'modéré' ? '~5–7 %/an' : profile.objective === 'croissance' ? '~8–10 %/an' : '~10–15 %/an'}</p>
        </div>
      </div>
    </div>
  )
}

function InvestorProfileSection({
  data, profile,
}: {
  data: PositionCalc[]
  profile: InvProfile
}) {
  const [tab, setTab] = React.useState<'stats' | 'montecarlo' | 'stress' | 'frontier' | 'historique'>('stats')
  const [tip, setTip] = React.useState<string | null>(null)
  const [expandedFrontierTickers, setExpandedFrontierTickers] = React.useState<Set<string>>(new Set())
  const [showFX, setShowFX] = React.useState(false)

  // ── Positions ouvertes nettes (FIFO) — même logique que l'onglet Positions ──
  // Exclut les positions clôturées (dateVente) et tient compte des réductions
  // (quantité nette = lots longs − lots de vente). Une entrée par ticker.
  const netData = React.useMemo(() => {
    const byTicker: Record<string, PositionCalc[]> = {}
    for (const p of data) {
      if (p.dateVente) continue
      const k = p.ticker.toUpperCase();
      (byTicker[k] ??= []).push(p)
    }
    const result: PositionCalc[] = []
    for (const lots of Object.values(byTicker)) {
      const netQty = lots.reduce((s, p) => s + p.quantite, 0)
      if (netQty <= 0) continue
      const ref = lots.find(p => p.quantite > 0) ?? lots[0]
      const netValCHF = netQty * ref.prixActuel * ref.tauxActuelCHF
      const netCoutCHF = lots.reduce((s, p) => s + (p.quantite > 0 ? p.coutCHF : -p.coutCHF), 0)
      result.push({ ...ref, quantite: netQty, valeurCHF: netValCHF, coutCHF: netCoutCHF, gainCHF: netValCHF - netCoutCHF })
    }
    return result
  }, [data])

  const hasPositions = netData.length > 0
  const total = netData.reduce((s, p) => s + p.valeurCHF, 0)

  // ── Poids par catégorie ──
  const catWeights = React.useMemo(() => {
    const w: Record<string, number> = {}
    if (total <= 0) return w
    for (const p of netData) w[p.categorie] = (w[p.categorie] ?? 0) + p.valeurCHF / total
    return w
  }, [netData, total])

  // ── Métriques CAPM (fallback) ──
  const capmSigma = React.useMemo(() => portfolioSigma(catWeights), [catWeights])
  const capmER    = React.useMemo(() => portfolioER(catWeights), [catWeights])

  // ── Statistiques historiques réelles ──
  const [histStats, setHistStats] = React.useState<{
    er: number; sigma: number; periodStart: string; periodEnd: string
    yearsCount: number
    excluded: {nom: string; ticker: string; years: number}[]
    reduced:  {nom: string; ticker: string; years: number}[]
    optWeights: { ticker: string; nom: string; wCurrent: number; wOptimal: number; wMinVol: number; erAsset: number; sigmaAsset: number }[]
    optSharpe: number; optMinVolSigma: number; curSharpe: number
    // FX-adjusted
    fxAssetsFound: number
    erFX: number; sigmaFX: number; curSharpeFX: number
    optWeightsFX: { ticker: string; nom: string; wCurrent: number; wOptimal: number; wMinVol: number; erAsset: number; sigmaAsset: number }[]
    optSharpeFX: number; optMinVolSigmaFX: number
    covMatrix: number[][]; covMatrixFX: number[][]
    frontierPts: { r: number; s: number; sh: number }[]
    frontierPtsFX: { r: number; s: number; sh: number }[]
    realStress: { label: string; loss: number; isReal: boolean; coveredPct: number; peakDate: string; troughDate: string }[]
    maxDrawdown: number  // valeur négative, ex. -0.35 = drawdown max de 35 %
  } | null>(null)
  const [histLoading, setHistLoading] = React.useState(false)

  const histKey = netData.map(p => `${p.ticker}:${p.valeurCHF.toFixed(0)}`).join(',')
  React.useEffect(() => {
    if (!hasPositions || netData.length === 0 || total <= 0) return
    setHistStats(null)
    setHistLoading(true)
    const tickers = [...new Set(netData.map(p => p.ticker.toUpperCase()))].join(',')
    const normFxDevise = (d: string) => { const u = d.toUpperCase(); return u === 'GBX' ? 'GBP' : u }
    const fxPairsNeeded = [...new Set(netData.filter(p => normFxDevise(p.devise) !== 'CHF').map(p => `${normFxDevise(p.devise)}CHF=X`))]
    const allTickersHist = [...tickers.split(','), ...fxPairsNeeded].join(',')
    fetchHistory(allTickersHist)
      .then((raw: Record<string, { dates: string[]; closes: number[] }>) => {
        const today = new Date()
        const MIN_YEARS_INCLUDE = 3    // seuil minimum : exclus des analyses si < 3 ans
        const MAX_YEARS_WINDOW  = 10   // fenêtre cible : on ne remonte pas au-delà de 10 ans
        const tenYearsAgo = new Date(today); tenYearsAgo.setFullYear(today.getFullYear() - MAX_YEARS_WINDOW)
        const tenYearsAgoStr = tenYearsAgo.toISOString().slice(0, 10)

        const assetInfos = netData.map(p => {
          const hist = raw[p.ticker.toUpperCase()]
          if (!hist || hist.dates.length < 24) return { ...p, firstDate: '', years: 0, hist: null as null }
          const firstDate = hist.dates[0]
          const years = (today.getTime() - new Date(firstDate).getTime()) / (365.25 * 24 * 3600 * 1000)
          return { ...p, firstDate, years, hist }
        })
        const excluded = assetInfos
          .filter(a => a.hist !== null && a.years < MIN_YEARS_INCLUDE)
          .map(a => ({ nom: a.nom, ticker: a.ticker, years: Math.round(a.years * 10) / 10 }))
        const noData = assetInfos
          .filter(a => a.hist === null)
          .map(a => ({ nom: a.nom, ticker: a.ticker, years: 0 }))
        const included = assetInfos.filter(a => a.hist !== null && a.years >= MIN_YEARS_INCLUDE)
        if (included.length === 0) { setHistLoading(false); return }

        // commonStart = date la plus tardive parmi les actifs inclus
        const commonStart = included.reduce((mx, a) => a.firstDate > mx ? a.firstDate : mx, included[0].firstDate)
        // effectiveStart = on plafonne à 10 ans (si tous les actifs ont ≥ 10 ans, on prend tenYearsAgo)
        const effectiveStart = commonStart > tenYearsAgoStr ? commonStart : tenYearsAgoStr
        // Actifs qui réduisent la fenêtre en dessous de 10 ans (firstDate > tenYearsAgo)
        const reduced = included
          .filter(a => a.firstDate > tenYearsAgoStr)
          .map(a => ({ nom: a.nom, ticker: a.ticker, years: Math.round(a.years * 10) / 10 }))

        function dailyRets(dates: string[], closes: number[], from: string): number[] {
          const fd: number[] = []
          for (let i = 0; i < dates.length; i++) if (dates[i] >= from) fd.push(closes[i])
          return fd.slice(1).map((c, i) => c / fd[i] - 1)
        }
        function dailyRetsFX(dates: string[], closes: number[], fxDates: string[], fxCloses: number[], from: string): number[] {
          // Build carry-forward FX lookup (binary search)
          let carry = 0
          const fxSorted: { date: string; rate: number }[] = fxDates.map((d, i) => {
            if (fxCloses[i] > 0) carry = fxCloses[i]
            return { date: d, rate: carry }
          })
          const getFX = (d: string) => {
            let lo = 0, hi = fxSorted.length - 1, r = fxSorted[0]?.rate ?? 1
            while (lo <= hi) {
              const mid = (lo + hi) >> 1
              if (fxSorted[mid].date <= d) { r = fxSorted[mid].rate; lo = mid + 1 } else hi = mid - 1
            }
            return r
          }
          const filtDates: string[] = [], filtCloses: number[] = []
          for (let i = 0; i < dates.length; i++) {
            if (dates[i] >= from) { filtDates.push(dates[i]); filtCloses.push(closes[i]) }
          }
          return filtDates.slice(1).map((d, i) => {
            const rAsset = filtCloses[i + 1] / filtCloses[i] - 1
            const fxPrev = getFX(filtDates[i]), fxCurr = getFX(d)
            const rFX = fxPrev > 0 && fxCurr > 0 ? fxCurr / fxPrev - 1 : 0
            return (1 + rAsset) * (1 + rFX) - 1
          })
        }

        const inclTotal = included.reduce((s, a) => s + a.valeurCHF, 0)
        if (inclTotal <= 0) { setHistLoading(false); return }

        // ── Retours journaliers → E(R), σ, Sharpe, VaR/CVaR ──
        const assetRets = included.map(a => ({
          rets: dailyRets(a.hist!.dates, a.hist!.closes, effectiveStart),
          w: a.valeurCHF / inclTotal,
        }))
        let fxAssetsFound = 0
        const assetRetsFX = included.map(a => {
          const devNorm = a.devise.toUpperCase() === 'GBX' ? 'GBP' : a.devise.toUpperCase()
          if (devNorm === 'CHF') return { rets: dailyRets(a.hist!.dates, a.hist!.closes, effectiveStart), w: a.valeurCHF / inclTotal }
          const fxKey = `${devNorm}CHF=X`
          const fxHist = raw[fxKey]
          if (!fxHist) {
            return { rets: dailyRets(a.hist!.dates, a.hist!.closes, effectiveStart), w: a.valeurCHF / inclTotal }
          }
          fxAssetsFound++
          return { rets: dailyRetsFX(a.hist!.dates, a.hist!.closes, fxHist.dates, fxHist.closes, effectiveStart), w: a.valeurCHF / inclTotal }
        })
        const minLen = Math.min(...assetRets.map(a => a.rets.length))
        if (minLen < 60) { setHistLoading(false); return }
        const portRets: number[] = []
        for (let t = 0; t < minLen; t++)
          portRets.push(assetRets.reduce((s, a) => s + a.w * (a.rets[t] ?? 0), 0))
        const mean = portRets.reduce((s, r) => s + r, 0) / portRets.length
        const erH  = mean * 252
        const varM = portRets.reduce((s, r) => s + (r - mean) ** 2, 0) / (portRets.length - 1)
        const sigH = Math.sqrt(varM * 252)
        const curSharpe = sigH > 0 ? (erH - RF_RATE) / sigH : 0

        // FX-adjusted (journalier)
        const minLenFX = Math.min(...assetRetsFX.map(a => a.rets.length))
        const portRetsFX: number[] = []
        for (let t = 0; t < minLenFX; t++)
          portRetsFX.push(assetRetsFX.reduce((s, a) => s + a.w * (a.rets[t] ?? 0), 0))
        const meanFX = portRetsFX.length > 0 ? portRetsFX.reduce((s, r) => s + r, 0) / portRetsFX.length : 0
        const erFXH  = meanFX * 252
        const varMFX = portRetsFX.length > 1 ? portRetsFX.reduce((s, r) => s + (r - meanFX) ** 2, 0) / (portRetsFX.length - 1) : 0
        const sigFX  = Math.sqrt(varMFX * 252)
        const curSharpeFX = sigFX > 0 ? (erFXH - RF_RATE) / sigFX : 0

        // Per-asset stats (journaliers, cohérents avec les métriques principales)
        const assetStats = included.map((a, i) => {
          const rets = assetRets[i].rets.slice(0, minLen)
          const m = rets.length > 0 ? rets.reduce((s, r) => s + r, 0) / rets.length : 0
          const v = rets.length > 1 ? rets.reduce((s, r) => s + (r - m) ** 2, 0) / (rets.length - 1) : 0
          return { ticker: a.ticker, nom: a.nom, wCurrent: assetRets[i].w, erAsset: m * 252, sigmaAsset: Math.sqrt(v * 252) }
        })
        const assetStatsFX = included.map((a, i) => {
          const rets = assetRetsFX[i].rets.slice(0, minLenFX)
          const m = rets.length > 0 ? rets.reduce((s, r) => s + r, 0) / rets.length : 0
          const v = rets.length > 1 ? rets.reduce((s, r) => s + (r - m) ** 2, 0) / (rets.length - 1) : 0
          return { ticker: a.ticker, nom: a.nom, wCurrent: assetRetsFX[i].w, erAsset: m * 252, sigmaAsset: Math.sqrt(v * 252) }
        })

        // Matrices de covariance annualisées (frontière efficiente précise)
        const nA = assetRets.length
        const covMatrix: number[][] = Array.from({length: nA}, (_, i) =>
          Array.from({length: nA}, (_, j) => {
            const ri = assetRets[i].rets, rj = assetRets[j].rets
            const len = Math.min(ri.length, rj.length, minLen)
            if (len < 2) return i === j ? (assetStats[i].sigmaAsset ** 2) : 0
            let si = 0, sj = 0
            for (let t = 0; t < len; t++) { si += ri[t]; sj += rj[t] }
            const mi = si / len, mj = sj / len
            let cov = 0
            for (let t = 0; t < len; t++) cov += (ri[t] - mi) * (rj[t] - mj)
            return cov / (len - 1) * 252
          })
        )
        const covMatrixFX: number[][] = Array.from({length: nA}, (_, i) =>
          Array.from({length: nA}, (_, j) => {
            const ri = assetRetsFX[i].rets, rj = assetRetsFX[j].rets
            const len = Math.min(ri.length, rj.length, minLenFX)
            if (len < 2) return i === j ? (assetStatsFX[i].sigmaAsset ** 2) : 0
            let si = 0, sj = 0
            for (let t = 0; t < len; t++) { si += ri[t]; sj += rj[t] }
            const mi = si / len, mj = sj / len
            let cov = 0
            for (let t = 0; t < len; t++) cov += (ri[t] - mi) * (rj[t] - mj)
            return cov / (len - 1) * 252
          })
        )

        // PRNG déterministe (mulberry32) seedé sur la composition du portefeuille
        const portfolioSeed = included.reduce((acc, a) => {
          let h = 0
          for (let i = 0; i < a.ticker.length; i++) h = Math.imul(h ^ a.ticker.charCodeAt(i), 0x9e3779b9)
          return acc ^ (h + Math.round(a.valeurCHF * 100))
        }, 0x12345678)
        function makePrng(seed: number) {
          let s = seed | 0
          return () => {
            s = s + 0x6D2B79F5 | 0
            let t = Math.imul(s ^ s >>> 15, 1 | s)
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
            return ((t ^ t >>> 14) >>> 0) / 4294967296
          }
        }
        const rand = makePrng(portfolioSeed)
        const randFX = makePrng(portfolioSeed ^ 0xdeadbeef)

        // Monte Carlo journalier: max-Sharpe + min-vol + points frontière (5000 portefeuilles)
        const n = assetRets.length
        let bestSharpe = -Infinity, bestVolSigma = Infinity
        let bestW = assetRets.map(a => a.w)
        let minVolW = assetRets.map(a => a.w)
        const frontierPts: { r: number; s: number; sh: number }[] = []
        for (let s = 0; s < 5000; s++) {
          const rw = Array.from({ length: n }, () => -Math.log(rand() + 1e-12))
          const sum = rw.reduce((a, b) => a + b, 0)
          const w = rw.map(x => x / sum)
          const pr = Array.from({ length: minLen }, (_, t) => assetRets.reduce((acc, a, i) => acc + w[i] * a.rets[t], 0))
          const pm = pr.reduce((a, b) => a + b, 0) / pr.length
          const pv = pr.reduce((a, r) => a + (r - pm) ** 2, 0) / (pr.length - 1)
          const ps = Math.sqrt(pv * 252)
          const sharpeS = ps > 0 ? (pm * 252 - RF_RATE) / ps : 0
          if (sharpeS > bestSharpe) { bestSharpe = sharpeS; bestW = w }
          if (ps < bestVolSigma) { bestVolSigma = ps; minVolW = w }
          frontierPts.push({ r: pm * 252, s: ps, sh: sharpeS })
        }
        const optWeights = assetStats.map((a, i) => ({ ...a, wOptimal: bestW[i], wMinVol: minVolW[i] }))

        // Monte Carlo FX journalier
        let bestSharpeFX = -Infinity, bestVolSigmaFX = Infinity
        let bestWFX = assetRetsFX.map(a => a.w)
        let minVolWFX = assetRetsFX.map(a => a.w)
        const frontierPtsFX: { r: number; s: number; sh: number }[] = []
        for (let s = 0; s < 5000; s++) {
          const rwFX = Array.from({ length: n }, () => -Math.log(randFX() + 1e-12))
          const sumW = rwFX.reduce((a, b) => a + b, 0)
          const w = rwFX.map(x => x / sumW)
          const pr = Array.from({ length: minLenFX }, (_, t) => assetRetsFX.reduce((acc, a, i) => acc + w[i] * a.rets[t], 0))
          const pm = pr.reduce((a, b) => a + b, 0) / pr.length
          const pv = pr.reduce((a, r) => a + (r - pm) ** 2, 0) / (pr.length - 1)
          const ps = Math.sqrt(pv * 252)
          const sharpeS = ps > 0 ? (pm * 252 - RF_RATE) / ps : 0
          if (sharpeS > bestSharpeFX) { bestSharpeFX = sharpeS; bestWFX = w }
          if (ps < bestVolSigmaFX) { bestVolSigmaFX = ps; minVolWFX = w }
          frontierPtsFX.push({ r: pm * 252, s: ps, sh: sharpeS })
        }
        const optWeightsFX = assetStatsFX.map((a, i) => ({ ...a, wOptimal: bestWFX[i], wMinVol: minVolWFX[i] }))

        // ── Max drawdown historique du portefeuille (converti en CHF) ──
        // On utilise portRetsFX (rendements ajustés change) pour que les fluctuations
        // USD/EUR → CHF soient prises en compte — sans ça le drawdown est sous-estimé.
        // Si aucun actif étranger (fxAssetsFound=0), portRetsFX === portRets.
        const ddRets = minLenFX >= 60 ? portRetsFX : portRets
        let cumVal = 1, peakVal = 1, mdd = 0
        for (const r of ddRets) {
          cumVal *= (1 + r)
          if (cumVal > peakVal) peakVal = cumVal
          const dd = (cumVal - peakVal) / peakVal
          if (dd < mdd) mdd = dd
        }
        const maxDrawdown = mdd  // ≤ 0, ex. -0.35

        // ── Stress tests avec données réelles ──
        function priceOnOrBefore(dates: string[], closes: number[], target: string): number | null {
          let lo = 0, hi = dates.length - 1, res: number | null = null
          while (lo <= hi) {
            const mid = (lo + hi) >> 1
            if (dates[mid] <= target) { res = closes[mid]; lo = mid + 1 } else hi = mid - 1
          }
          return res
        }
        const realStress = STRESS.map(sc => {
          // Si la crise précède la fenêtre d'analyse → non couverte
          if (sc.peakDate < effectiveStart) {
            return { label: sc.label, loss: 0, isReal: false, coveredPct: 0, peakDate: sc.peakDate, troughDate: sc.troughDate }
          }
          let weightedLoss = 0, totalWeightCovered = 0
          for (const a of included) {
            const peakPrice   = priceOnOrBefore(a.hist!.dates, a.hist!.closes, sc.peakDate)
            const troughPrice = priceOnOrBefore(a.hist!.dates, a.hist!.closes, sc.troughDate)
            if (peakPrice == null || troughPrice == null || peakPrice === 0) continue
            weightedLoss      += a.valeurCHF * ((troughPrice - peakPrice) / peakPrice)
            totalWeightCovered += a.valeurCHF
          }
          const coveredPct = inclTotal > 0 ? totalWeightCovered / inclTotal : 0
          const loss = inclTotal > 0 ? weightedLoss / inclTotal : 0
          // N'afficher que si 100 % des actifs analysés sont couverts
          return { label: sc.label, loss, isReal: coveredPct >= 0.999, coveredPct, peakDate: sc.peakDate, troughDate: sc.troughDate }
        })

        setHistStats({
          er: erH, sigma: sigH,
          periodStart: effectiveStart,
          periodEnd: today.toISOString().slice(0, 10),
          yearsCount: portRets.length / 252,
          excluded: [...excluded, ...noData], reduced,
          optWeights, optSharpe: bestSharpe, optMinVolSigma: bestVolSigma, curSharpe,
          fxAssetsFound, erFX: erFXH, sigmaFX: sigFX, curSharpeFX,
          optWeightsFX, optSharpeFX: bestSharpeFX, optMinVolSigmaFX: bestVolSigmaFX,
          covMatrix, covMatrixFX,
          frontierPts, frontierPtsFX,
          realStress,
          maxDrawdown,
        })
      })
      .catch(() => {})
      .finally(() => setHistLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [histKey, hasPositions])

  // ── Métriques finales (historiques si dispo, CAPM sinon) ──
  const er      = histStats?.er    ?? capmER
  const sigma   = histStats?.sigma ?? capmSigma
  const erFX    = histStats?.erFX    ?? er
  const sigmaFX = histStats?.sigmaFX ?? sigma
  const sharpe  = sigma > 0 ? (er - RF_RATE) / sigma : 0
  // Valeurs effectives selon le toggle FX (utilisées pour MC, stress, frontière)
  const erEff    = showFX && histStats ? erFX    : er
  const sigmaEff = showFX && histStats ? sigmaFX : sigma
  const var95   = er - 1.645 * sigma
  const cvar95  = er - 2.063 * sigma
  const hhi     = Object.values(catWeights).reduce((s, w) => s + w * w, 0)
  const effN    = hhi > 0 ? 1 / hhi : 0
  const var95m  = er / 12 - 1.645 * sigma / Math.sqrt(12)

  // ── Type de profil dérivé ──
  const profileType = React.useMemo(() => deriveProfileType(profile), [profile])

  // ── Monte Carlo ──
  const mcPaths = React.useMemo(() => {
    if (!hasPositions || sigmaEff === 0) return []
    const N = 2000, dt = 1 / 12, steps = 20 * 12
    const paths: number[][] = []
    for (let i = 0; i < N; i++) {
      const path = [1.0]
      for (let t = 0; t < steps; t++) {
        const prev = path[path.length - 1]
        path.push(prev * Math.exp((erEff - sigmaEff * sigmaEff / 2) * dt + sigmaEff * Math.sqrt(dt) * normalRand()))
      }
      paths.push(path)
    }
    return paths
  }, [hasPositions, sigmaEff, erEff, profile.horizon])

  const mcBands = React.useMemo(() => {
    if (mcPaths.length === 0) return []
    const steps = 20 * 12 + 1
    return Array.from({ length: steps }, (_, t) => {
      const vals = mcPaths.map(p => p[t])
      return {
        p5:  pctile(vals, 5),
        p25: pctile(vals, 25),
        p50: pctile(vals, 50),
        p75: pctile(vals, 75),
        p95: pctile(vals, 95),
      }
    })
  }, [mcPaths, profile.horizon])

  // ── Stress tests ──
  const stressResults = React.useMemo(() => {
    if (!hasPositions) return []
    // Données réelles disponibles : n'afficher que les crises couvertes
    if (histStats?.realStress) {
      return histStats.realStress
        .filter(sc => sc.isReal)
        .map(sc => {
          const recovery = sc.loss < 0 ? Math.ceil(Math.log(1 / (1 + sc.loss)) / Math.log(1 + erEff)) : 0
          return { ...sc, recovery }
        })
    }
    // Fallback CAPM (données historiques pas encore chargées) : on affiche tout
    return STRESS.map(sc => {
      const loss = CATS.reduce((s, c) => s + (catWeights[c] ?? 0) * (sc.shocks[c] ?? 0), 0)
      const recovery = loss < 0 ? Math.ceil(Math.log(1 / (1 + loss)) / Math.log(1 + erEff)) : 0
      return { ...sc, loss, recovery, coveredPct: 0 }
    })
  }, [catWeights, hasPositions, erEff, histStats])

  // ── Score du portefeuille ──
  const scoreResult = React.useMemo(() => {
    if (!hasPositions || sigma === 0) return null

    const h = profile.horizon

    // ── Poids dynamiques selon l'horizon ──
    // Court terme : liquidité et protection des pertes priment
    // Long terme : rendement et diversification réelle priment
    const wts = h >= 15
      ? { q1: 0.30, q2: 0.20, q3: 0.15, q4: 0.35 }
      : h >= 8
      ? { q1: 0.25, q2: 0.25, q3: 0.25, q4: 0.25 }
      : { q1: 0.20, q2: 0.30, q3: 0.35, q4: 0.15 }

    // ── Q1 — Horizon : volatilité + diversification ajustée corrélations ──
    // Volatilité (0-100) : seuils plus permissifs sur long terme
    const sigScore = h >= 15
      ? sigma <= 0.30 ? 100 : sigma <= 0.45 ? 75 : sigma <= 0.60 ? 40 : 15
      : h >= 8
      ? sigma <= 0.18 ? 100 : sigma <= 0.28 ? 65 : sigma <= 0.40 ? 30 : 10
      : sigma <= 0.08 ? 100 : sigma <= 0.15 ? 60 : sigma <= 0.22 ? 25 : 0

    // Diversification Ratio (DR) ajusté corrélations, si covMatrix disponible
    // DR = Σ(wᵢ × σᵢ) / σp — vaut 1 si tous corrélés, √n si décorrélés à poids égaux
    let drScore: number
    let dr: number | null = null
    if (histStats && histStats.optWeights.length > 1 && histStats.sigma > 0) {
      dr = histStats.optWeights.reduce((s, a) => s + a.wCurrent * a.sigmaAsset, 0) / histStats.sigma
      const drMax = Math.sqrt(histStats.optWeights.length)
      const drNorm = Math.min(1, Math.max(0, (dr - 1) / Math.max(0.5, drMax - 1)))
      drScore = Math.round(drNorm * 100)
      // Pénalité si DR < 1.15 (quasi aucun bénéfice de diversification) sur horizon long
      if (h >= 15 && dr < 1.15) drScore = Math.min(drScore, 25)
    } else {
      // Fallback sur N effectif si pas de données historiques
      drScore = h >= 15
        ? effN >= 8 ? 100 : effN >= 5 ? 70 : effN >= 3 ? 40 : 10
        : h >= 8
        ? effN >= 5 ? 100 : effN >= 3 ? 70 : effN >= 2 ? 40 : 15
        : effN >= 3 ? 100 : effN >= 2 ? 70 : 40
    }
    const q1 = Math.round(sigScore * 0.48 + drScore * 0.52)

    // ── Q2 — Pertes : VaR annuelle + drawdown max historique (ou CVaR si pas de données) ──
    const tol = profile.loss / 100
    const varLoss = Math.max(0, -var95)
    const varScore = varLoss <= tol * 0.7 ? 100 : varLoss <= tol ? 80 : varLoss <= tol * 1.3 ? 40 : varLoss <= tol * 1.6 ? 15 : 0

    let lossScore2: number
    const maxDD = histStats?.maxDrawdown ?? null
    if (maxDD !== null) {
      // Drawdown max historique (perte réelle la pire observée)
      // Tolérance implicite sur drawdown = 2× la tolérance annuelle déclarée (car drawdown ≫ VaR)
      const dd = Math.abs(maxDD)
      const ddTol = tol * 2.0
      lossScore2 = dd <= ddTol * 0.6 ? 100 : dd <= ddTol ? 80 : dd <= ddTol * 1.4 ? 40 : dd <= ddTol * 1.8 ? 15 : 0
    } else {
      // Fallback CVaR si pas de données historiques
      const cvarLoss = Math.max(0, -cvar95)
      lossScore2 = cvarLoss <= tol ? 100 : cvarLoss <= tol * 1.3 ? 65 : cvarLoss <= tol * 1.6 ? 25 : 0
    }
    const q2 = Math.round(varScore * 0.55 + lossScore2 * 0.45)

    // ── Q3 — Liquidité : VaR mensuelle + concentration HHI ──
    const varMLoss = Math.max(0, -var95m)
    const liq = profile.liquidity
    const varMScore = liq === 'haute'
      ? varMLoss <= 0.025 ? 100 : varMLoss <= 0.05 ? 65 : varMLoss <= 0.08 ? 25 : 0
      : liq === 'moyenne'
      ? varMLoss <= 0.05  ? 100 : varMLoss <= 0.08 ? 65 : varMLoss <= 0.12 ? 25 : 0
      : varMLoss <= 0.08  ? 100 : varMLoss <= 0.15 ? 65 : varMLoss <= 0.25 ? 30 : 10
    const effNScore = liq === 'haute'
      ? effN >= 6.5 ? 100 : effN >= 4 ? 60 : effN >= 2.5 ? 20 : 0
      : liq === 'moyenne'
      ? effN >= 4 ? 100 : effN >= 2.5 ? 60 : effN >= 1.6 ? 25 : 10
      : effN >= 2.5 ? 100 : effN >= 1.6 ? 70 : 40
    const q3 = Math.round(varMScore * 0.60 + effNScore * 0.40)

    // ── Q4 — Rendement : E(Rp) vs cible + Sharpe (efficience risque/rendement) ──
    const target = ({ 'inflation': 0.03, 'modéré': 0.06, 'croissance': 0.09, 'agressif': 0.13 } as Record<string,number>)[profile.objective] ?? 0.06
    const retScore = er >= target ? 100 : er >= target * 0.75 ? 72 : er >= target * 0.5 ? 40 : er >= 0 ? 20 : 8
    const shScore  = sharpe >= 1 ? 100 : sharpe >= 0.5 ? 70 : sharpe >= 0.2 ? 40 : sharpe >= 0 ? 15 : 0
    const q4 = Math.round(retScore * 0.65 + shScore * 0.35)

    const total = Math.min(100, Math.round(wts.q1 * q1 + wts.q2 * q2 + wts.q3 * q3 + wts.q4 * q4))

    return {
      total, q1, q2, q3, q4, wts,
      sigScore, drScore, varScore, lossScore2, varMScore, effNScore, retScore, shScore,
      tol, varLoss, target, dr, maxDD,
    }
  }, [hasPositions, sigma, er, sharpe, hhi, effN, var95, cvar95, var95m, profile, histStats])

  const portfolioScore = scoreResult?.total ?? null

  // ── Recommandations ──
  const recommendations = React.useMemo(() => {
    if (!scoreResult) return []
    const recs: {icon: string; text: string; severity: 'high' | 'medium' | 'low'}[] = []
    const { varScore, lossScore2, shScore, drScore, retScore, varMScore, effNScore,
            tol, varLoss, target, dr, maxDD } = scoreResult
    const h = profile.horizon

    if (retScore <= 20)
      recs.push({ icon: '📉', severity: 'high',
        text: `Rendement attendu (${(er*100).toFixed(1)} %) insuffisant pour votre objectif (${(target*100).toFixed(0)} %). Envisagez des actifs plus dynamiques (actions, ETF croissance).` })
    else if (retScore <= 40)
      recs.push({ icon: '📊', severity: 'low',
        text: `Rendement en dessous de votre objectif (${(target*100).toFixed(0)} %). Une légère réorientation vers des actifs de croissance pourrait suffire.` })

    if (varScore === 0)
      recs.push({ icon: '⚠️', severity: 'high',
        text: `Perte probable (VaR ${(varLoss*100).toFixed(1)} %) très supérieure à votre tolérance (${(tol*100).toFixed(0)} %). Réduisez l'exposition aux actifs volatils.` })
    else if (varScore <= 40)
      recs.push({ icon: '⚠️', severity: 'medium',
        text: `Perte probable (VaR ${(varLoss*100).toFixed(1)} %) dépasse votre tolérance déclarée de ${(tol*100).toFixed(0)} %. Rééquilibrage conseillé.` })

    if (maxDD !== null && lossScore2 <= 15)
      recs.push({ icon: '🔥', severity: 'high',
        text: `Pire baisse historique (${(Math.abs(maxDD)*100).toFixed(1)} %) très supérieure à votre tolérance. Augmentez les actifs défensifs (obligations, or).` })
    else if (maxDD === null && lossScore2 <= 25)
      recs.push({ icon: '🔥', severity: 'high',
        text: `En scénario de crise (CVaR), la perte potentielle est dangereuse par rapport à votre profil. Augmentez les actifs défensifs (obligations, or).` })

    if (shScore <= 15)
      recs.push({ icon: '⚖️', severity: 'medium',
        text: `Ratio de Sharpe faible (${sharpe.toFixed(2)}) : le risque pris n'est pas bien rémunéré. Cherchez des actifs à meilleur couple rendement/risque.` })

    if (drScore <= 20 && h >= 10)
      recs.push({ icon: '🗂️', severity: 'high',
        text: dr !== null
          ? `Vos actifs sont fortement corrélés (DR ${dr.toFixed(2)}) : ils baissent ensemble en cas de crise. Ajoutez des classes d'actifs décorrélées (obligations, or, immobilier).`
          : `Diversification insuffisante (N eff. ${effN.toFixed(1)}) pour un horizon de ${h} ans. Ajoutez des classes d'actifs décorrélées (ETF monde, obligations).` })
    else if (drScore <= 50 && h >= 15)
      recs.push({ icon: '🗂️', severity: 'medium',
        text: `Diversification à améliorer pour votre horizon long (${h} ans). Les actifs restent trop corrélés entre eux.` })

    if (varMScore === 0 && profile.liquidity === 'haute')
      recs.push({ icon: '💧', severity: 'high',
        text: `Volatilité mensuelle élevée incompatible avec votre besoin de liquidité haute. Augmentez la part de fonds monétaires ou d'obligations courtes.` })
    else if (effNScore <= 20 && profile.liquidity !== 'faible')
      recs.push({ icon: '🔒', severity: 'medium',
        text: `Portefeuille concentré (N effectif ${effN.toFixed(1)}) : certains actifs peuvent être difficiles à liquider rapidement. Diversifiez ou réduisez les positions illiquides.` })

    return recs.sort((a, b) => a.severity === 'high' ? -1 : b.severity === 'high' ? 1 : 0).slice(0, 4)
  }, [scoreResult, er, sharpe, effN, hhi, profile])

  // ── Frontière efficiente ──
  const frontier = React.useMemo(() => {
    if (!hasPositions) return { pts: [], current: null, maxSharpe: null, minSigma: null }

    // Données historiques disponibles : points pré-calculés dans useEffect (déterministes)
    if (histStats?.frontierPts && histStats.frontierPts.length > 0) {
      const rawPts = (showFX && histStats.frontierPtsFX?.length ? histStats.frontierPtsFX : histStats.frontierPts)
      const pts = rawPts.map(p => ({ ...p, w: {} as Record<string, number> }))
      const current   = { r: erEff, s: sigmaEff, sh: sigmaEff > 0 ? (erEff - RF_RATE) / sigmaEff : 0 }
      const maxSharpe = pts.reduce((b, p) => p.sh > b.sh ? p : b, pts[0])
      const minSigma  = pts.reduce((b, p) => p.s  < b.s  ? p : b, pts[0])
      return { pts, current, maxSharpe, minSigma }
    }

    // Fallback CAPM (données historiques pas encore chargées)
    const pts: { r: number; s: number; sh: number; w: Record<string, number> }[] = []
    for (let i = 0; i < 500; i++) {
      const raws = CATS.map(() => -Math.log(Math.random()))
      const sum  = raws.reduce((a, b) => a + b, 0)
      const w: Record<string, number> = {}
      CATS.forEach((c, j) => { w[c] = raws[j] / sum })
      const r = portfolioER(w), s = portfolioSigma(w)
      pts.push({ r, s, sh: s > 0 ? (r - RF_RATE) / s : 0, w })
    }
    const current  = { r: erEff, s: sigmaEff, sh: sigmaEff > 0 ? (erEff - RF_RATE) / sigmaEff : 0 }
    const maxSharpe = pts.reduce((b, p) => p.sh > b.sh ? p : b, pts[0])
    const minSigma  = pts.reduce((b, p) => p.s < b.s  ? p : b, pts[0])
    return { pts, current, maxSharpe, minSigma }
  }, [hasPositions, catWeights, erEff, sigmaEff, histStats, showFX])

  // ── SVG helpers ──
  const W = 560, H = 220, PAD = { t: 16, r: 16, b: 32, l: 52 }
  const PW = W - PAD.l - PAD.r, PH = H - PAD.t - PAD.b

  function mcSVG() {
    if (mcBands.length < 2) return null
    const T = mcBands.length
    const allVals = mcBands.flatMap(b => [b.p5, b.p95])
    const rawMin = Math.min(...allVals, 1.0)   // ×1.0 toujours inclus
    const rawMax = Math.max(...allVals)
    // Palier arrondi adapté à l'étendue
    const niceStep = (() => {
      const raw = (rawMax - rawMin) / 5
      const candidates = [0.5, 1, 2, 5, 10, 20, 50, 100]
      return candidates.find(s => s >= raw) ?? 100
    })()
    // Les bornes du graphique = les bords des ticks (données toujours dans le cadre)
    const minY = Math.floor(rawMin / niceStep) * niceStep
    const maxY = Math.ceil(rawMax  / niceStep) * niceStep
    const xS = (i: number) => PAD.l + (i / (T - 1)) * PW
    const yS = (v: number) => PAD.t + PH - ((v - minY) / (maxY - minY || 1)) * PH
    const line = (key: 'p5' | 'p25' | 'p50' | 'p75' | 'p95') =>
      mcBands.map((b, i) => `${i === 0 ? 'M' : 'L'}${xS(i).toFixed(1)},${yS(b[key]).toFixed(1)}`).join(' ')
    const area = (hi: 'p95' | 'p75', lo: 'p5' | 'p25') => {
      const fwd = mcBands.map((b, i) => `${i === 0 ? 'M' : 'L'}${xS(i).toFixed(1)},${yS(b[hi]).toFixed(1)}`).join(' ')
      const bwd = [...mcBands].reverse().map((b, i) => `L${xS(T - 1 - i).toFixed(1)},${yS(b[lo]).toFixed(1)}`).join(' ')
      return fwd + bwd + 'Z'
    }
    // Ticks Y — paliers réguliers arrodnis
    const decimals = niceStep < 1 ? 1 : 0
    const ticks: { y: number; label: string; isOrigin: boolean }[] = []
    for (let v = minY; v <= maxY + 1e-9; v = Math.round((v + niceStep) * 1e9) / 1e9) {
      if (Math.abs(v) < 1e-9) continue  // ne pas afficher ×0
      ticks.push({ y: yS(v), label: `×${v.toFixed(decimals)}`, isOrigin: Math.abs(v - 1) < 1e-9 })
    }
    // Si ×1.0 n'est pas déjà un tick, l'ajouter comme repère
    const hasOrigin = ticks.some(t => t.isOrigin)
    const originY = yS(1)
    // Ticks en années — tous les 5 ans
    const xTicks: { x: number; label: string }[] = []
    for (let yr = 5; yr <= 20; yr += 5) {
      xTicks.push({ x: xS(yr * 12), label: `${yr} ans` })
    }
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 220 }}>
        <defs>
          <linearGradient id="mc-g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2B6B5A" stopOpacity="0.25"/><stop offset="100%" stopColor="#2B6B5A" stopOpacity="0.05"/></linearGradient>
          <linearGradient id="mc-g2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2B6B5A" stopOpacity="0.12"/><stop offset="100%" stopColor="#2B6B5A" stopOpacity="0.03"/></linearGradient>
        </defs>
        {ticks.map((tk, i) => (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={tk.y} y2={tk.y}
              stroke={tk.isOrigin ? '#9E9A93' : '#DDD9D1'}
              strokeWidth={tk.isOrigin ? 1 : 0.5}
              strokeDasharray={tk.isOrigin ? undefined : '3,3'}/>
            <text x={PAD.l - 4} y={tk.y + 4} textAnchor="end" fontSize="9"
              fill={tk.isOrigin ? '#5A5550' : '#8899AA'}
              fontWeight={tk.isOrigin ? '600' : undefined}>{tk.label}</text>
          </g>
        ))}
        {!hasOrigin && (
          <g>
            <line x1={PAD.l} x2={W - PAD.r} y1={originY} y2={originY} stroke="#9E9A93" strokeWidth="1"/>
            <text x={PAD.l - 4} y={originY + 4} textAnchor="end" fontSize="9" fill="#5A5550" fontWeight="600">×1</text>
          </g>
        )}
        {xTicks.map((tk, i) => (
          <text key={i} x={tk.x} y={H - 6} textAnchor="middle" fontSize="9" fill="#8899AA">{tk.label}</text>
        ))}
        <path d={area('p95', 'p5')}  fill="url(#mc-g2)"/>
        <path d={area('p75', 'p25')} fill="url(#mc-g1)"/>
        <path d={line('p95')} fill="none" stroke="#2B6B5A" strokeWidth="0.8" strokeDasharray="4,2"/>
        <path d={line('p5')}  fill="none" stroke="#2B6B5A" strokeWidth="0.8" strokeDasharray="4,2"/>
        <path d={line('p75')} fill="none" stroke="#2B6B5A" strokeWidth="1.2"/>
        <path d={line('p25')} fill="none" stroke="#2B6B5A" strokeWidth="1.2"/>
        <path d={line('p50')} fill="none" stroke="#2B6B5A" strokeWidth="2"/>
        <circle cx={xS(T - 1)} cy={yS(mcBands[T - 1].p50)} r="3" fill="#2B6B5A"/>
      </svg>
    )
  }

  function frontierSVG() {
    const { pts, current, maxSharpe, minSigma } = frontier
    if (!pts.length || !current) return null
    const xs = pts.map(p => p.s), ys = pts.map(p => p.r)
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minYv = Math.min(...ys), maxYv = Math.max(...ys)
    const xS = (v: number) => PAD.l + ((v - minX) / (maxX - minX || 1)) * PW
    const yS = (v: number) => PAD.t + PH - ((v - minYv) / (maxYv - minYv || 1)) * PH
    const tX = Array.from({ length: 5 }, (_, i) => {
      const v = minX + (i / 4) * (maxX - minX)
      return { x: xS(v), label: `${(v * 100).toFixed(0)}%` }
    })
    const tY = Array.from({ length: 5 }, (_, i) => {
      const v = minYv + (i / 4) * (maxYv - minYv)
      return { y: yS(v), label: `${(v * 100).toFixed(1)}%` }
    })
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 220 }}>
        {tY.map((tk, i) => (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={tk.y} y2={tk.y} stroke="#DDD9D1" strokeWidth="0.5" strokeDasharray="3,3"/>
            <text x={PAD.l - 4} y={tk.y + 4} textAnchor="end" fontSize="9" fill="#8899AA">{tk.label}</text>
          </g>
        ))}
        {tX.map((tk, i) => <text key={i} x={tk.x} y={H - 6} textAnchor="middle" fontSize="9" fill="#8899AA">{tk.label}</text>)}
        <text x={PAD.l + PW / 2} y={H - 2} textAnchor="middle" fontSize="9" fill="#8899AA">σ (risque)</text>
        <text x={10} y={PAD.t + PH / 2} textAnchor="middle" fontSize="9" fill="#8899AA" transform={`rotate(-90,10,${PAD.t + PH / 2})`}>E(R)</text>
        {pts.map((p, i) => <circle key={i} cx={xS(p.s)} cy={yS(p.r)} r="2" fill="#2B6B5A" fillOpacity="0.25"/>)}
        {minSigma  && <circle cx={xS(minSigma.s)}  cy={yS(minSigma.r)}  r="5" fill="#3B82F6" stroke="white" strokeWidth="1.5"/>}
        {maxSharpe && <circle cx={xS(maxSharpe.s)} cy={yS(maxSharpe.r)} r="5" fill="#F59E0B" stroke="white" strokeWidth="1.5"/>}
        <circle cx={xS(current.s)} cy={yS(current.r)} r="6" fill="#EF4444" stroke="white" strokeWidth="2"/>
        <text x={xS(current.s) + 8} y={yS(current.r) + 4} fontSize="10" fill="#EF4444" fontWeight="600">Votre portefeuille</text>
        {maxSharpe && <text x={xS(maxSharpe.s) + 8} y={yS(maxSharpe.r) + 4} fontSize="9" fill="#F59E0B">Max Sharpe</text>}
        {minSigma  && <text x={xS(minSigma.s) + 8}  y={yS(minSigma.r) + 4}  fontSize="9" fill="#3B82F6">Min σ</text>}
      </svg>
    )
  }

  const tile = (label: string, value: string, sub?: string, color?: string, fxVal?: string) => (
    <div className="relative bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-4 flex flex-col gap-1">
      <div className="flex items-start justify-between gap-1">
        <p className="text-xs text-[#5C6880] dark:text-[#7B8DA6] leading-tight pr-1">{label}</p>
        {sub && (
          <button
            className="flex-shrink-0 w-4 h-4 rounded-full text-[9px] font-bold border flex items-center justify-center transition-colors"
            style={{ color: tip === label ? '#2B6B5A' : '#8899AA', borderColor: tip === label ? '#2B6B5A' : '#C4C9D4' }}
            onMouseEnter={() => setTip(label)}
            onMouseLeave={() => setTip(null)}
            onClick={() => setTip(tip === label ? null : label)}
          >?</button>
        )}
      </div>
      <p className="text-lg font-semibold" style={{ color: color ?? 'inherit' }}>{value}</p>
      {fxVal && (
        <p className="text-[10px] text-[#9E9A93] dark:text-[#5C7080] leading-tight">{fxVal}</p>
      )}
      {tip === label && sub && (
        <div className="absolute top-0 right-6 z-30 bg-[#1B3050] text-white text-xs rounded-xl px-3 py-2 w-56 shadow-xl" style={{ transform: 'translateY(-105%)' }}>
          {sub}
          <div className="absolute bottom-[-5px] right-3 w-2.5 h-2.5 bg-[#1B3050] rotate-45"/>
        </div>
      )}
    </div>
  )

  return (
    <div className="mt-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-1 h-6 rounded-full bg-[#2B6B5A]"/>
        <h2 className="text-lg font-semibold text-[#1B3050] dark:text-white">Analyse du portefeuille</h2>
      </div>

      {/* Analyses quantitatives (uniquement si positions) */}
      {hasPositions && (
        <div className="bg-white dark:bg-[#162534] rounded-2xl border border-[#DDD9D1] dark:border-[#1e3347] overflow-hidden">
          {/* Tab bar */}
          <div className="flex items-center border-b border-[#DDD9D1] dark:border-[#1e3347]">
            <div className="flex overflow-x-auto flex-1">
              {([
                ['stats',       'Statistiques'],
                ['montecarlo',  'Monte Carlo'],
                ['stress',      'Stress Tests'],
                ['frontier',    'Frontière efficiente'],
                ['historique',  'Données historiques'],
              ] as const).map(([key, lbl]) => (
                <button key={key} onClick={() => setTab(key)}
                  className={`px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === key
                    ? 'border-[#2B6B5A] text-[#2B6B5A]'
                    : 'border-transparent text-[#5C6880] dark:text-[#7B8DA6] hover:text-[#1B3050] dark:hover:text-white'}`}>
                  {lbl}
                </button>
              ))}
            </div>
            {histStats && (
              <button onClick={() => setShowFX(v => !v)}
                title={showFX ? 'Afficher en devise locale' : 'Afficher en CHF (FX inclus)'}
                className={`mx-3 px-2.5 py-1 rounded-lg border text-base transition-all flex-shrink-0 ${showFX ? 'border-[#B5820F] bg-[#FEF3C7] dark:bg-[#2a2010]' : 'border-[#DDD9D1] dark:border-[#2a3f52] opacity-50 hover:opacity-100'}`}>
                🇨🇭
              </button>
            )}
          </div>

          <div className="p-6">

            {/* ── Statistiques ── */}
            {tab === 'stats' && (
              <div className="space-y-4">
                <p className="text-xs text-[#8899AA]">
                  {histLoading
                    ? '⏳ Chargement des données historiques…'
                    : histStats
                    ? `📈 Basé sur les cours réels de vos actifs entre ${histStats.periodStart.slice(0,7)} et ${histStats.periodEnd.slice(0,7)} (${histStats.yearsCount.toFixed(1)} ans de données)`
                    : '⚠️ Estimations CAPM (données historiques indisponibles — β par catégorie, matrice de corrélation 6×6)'}
                </p>
                {(() => {
                  const erD     = erEff
                  const sigD    = sigmaEff
                  const sharpeD = sigD > 0 ? (erD - RF_RATE) / sigD : 0
                  const var95D  = erD - 1.645 * sigD
                  const cvar95D = erD - 2.063 * sigD
                  const var95mD = erD / 12 - 1.645 * sigD / Math.sqrt(12)
                  const inCHF   = showFX && histStats
                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {tile(
                        'Rendement annuel attendu',
                        `${(erD * 100).toFixed(2)} %`,
                        inCHF
                          ? `Gain moyen annuel sur la période analysée, en CHF. Historique — les années futures peuvent différer. · Formule : moyenne des rendements journaliers × 252, converti en CHF`
                          : `Gain moyen annuel sur la période analysée. Historique — les années futures peuvent différer. · Formule : moyenne des rendements journaliers × 252`,
                        '#2B6B5A'
                      )}
                      {tile(
                        'Volatilité annuelle',
                        `${(sigD * 100).toFixed(2)} %`,
                        inCHF
                          ? `Amplitude des variations annuelles de votre portefeuille, en CHF. Plus c'est élevé, plus les hausses et baisses sont fortes. · Formule : σ journalière × √252, converti en CHF`
                          : `Amplitude des variations annuelles de votre portefeuille. Plus c'est élevé, plus les hausses et baisses sont fortes. · Formule : σ journalière × √252`
                      )}
                      {tile(
                        'Ratio de Sharpe',
                        sharpeD.toFixed(3),
                        `Rendement obtenu par unité de risque prise. ≥ 1 : excellent · ≥ 0,5 : correct · < 0,5 : risque mal compensé. · Formule : (E(Rp) − Rf) / σ · Rf = ${(RF_RATE * 100).toFixed(1)} %`,
                        sharpeD >= 1 ? '#22C55E' : sharpeD >= 0.5 ? '#F59E0B' : '#EF4444'
                      )}
                      {tile('Perte max probable / an', `${(var95D * 100).toFixed(2)} %`,
                        `Dans 95 % des années, la perte ne dépassera pas ce seuil. Il reste 5 % de chances de faire pire. · Formule : VaR 95 % = E(Rp) − 1,645 × σ`
                      )}
                      {/* Pire baisse historique réelle si dispo, sinon CVaR paramétrique */}
                      {histStats?.maxDrawdown !== undefined
                        ? tile('Max Drawdown',
                            `${(Math.abs(histStats.maxDrawdown) * 100).toFixed(1)} %`,
                            `La plus forte baisse réelle observée sur la période analysée, du sommet au creux. Mesure concrète du pire scénario passé — plus parlant que la CVaR théorique. · Calculée sur ${histStats.yearsCount.toFixed(1)} ans de données réelles`,
                            Math.abs(histStats.maxDrawdown) > 0.4 ? '#EF4444' : Math.abs(histStats.maxDrawdown) > 0.2 ? '#F59E0B' : '#22C55E'
                          )
                        : tile('Perte extrême moyenne / an', `${(cvar95D * 100).toFixed(2)} %`,
                            `Perte moyenne dans les 5 % de pires années. Le scénario de crise, pas le cas habituel. · Formule : CVaR 95 % = E(Rp) − 2,063 × σ`
                          )
                      }
                      {tile('Perte max probable / mois', `${(var95mD * 100).toFixed(2)} %`,
                        `Dans 95 % des mois, la perte ne dépassera pas ce seuil. Utile pour jauger votre confort face aux baisses à court terme. · Formule : VaR 95 % mensuelle = E(Rp)/12 − 1,645 × σ / √12`
                      )}
                      {tile('N effectif', effN.toFixed(1),
                        `Nombre d'actifs équivalents si votre portefeuille était parfaitement équipondéré. 10 lignes qui bougent ensemble = N effectif proche de 1. · < 2 : trop concentré · 2–4 : modéré · ≥ 4 : bonne répartition · Formule : N eff = 1 / Σ wᵢ²`,
                        effN < 2 ? '#EF4444' : effN < 4 ? '#F59E0B' : '#22C55E'
                      )}
                      {/* Diversification Ratio ajusté corrélations si dispo, sinon N effectif */}
                      {(() => {
                        const drVal = scoreResult?.dr ?? null
                        if (drVal !== null && histStats) {
                          const drColor = drVal >= 1.5 ? '#22C55E' : drVal >= 1.2 ? '#F59E0B' : '#EF4444'
                          return tile('Bénéfice de diversification',
                            `×${drVal.toFixed(2)}`,
                            `Mesure si vos actifs se compensent vraiment entre eux. ×1,0 = ils bougent tous ensemble (aucun bénéfice). Plus c'est élevé, mieux vos actifs se complètent. · Formule : DR = Σ(wᵢ × σᵢ) / σp · ≥ 1,5 : bonne diversification · < 1,2 : actifs trop corrélés`,
                            drColor
                          )
                        }
                        return tile('Diversification effective', effN.toFixed(1),
                          `Nombre d'actifs vraiment indépendants que votre portefeuille équivaut à détenir. 10 actifs qui bougent ensemble = score proche de 1. Plus c'est élevé, mieux c'est. · Formule : 1 / HHI · Idéalement ≥ 5`
                        )
                      })()}
                      {portfolioScore !== null && tile('Score du portefeuille', `${portfolioScore} / 100`,
                        (() => {
                          const sr = scoreResult!
                          const pct = (w: number) => `${Math.round(w * 100)} %`
                          return `Note sur 100 adaptée à votre profil. Poids par quadrant : Q1 Horizon ${pct(sr.wts.q1)} · Q2 Pertes ${pct(sr.wts.q2)} · Q3 Liquidité ${pct(sr.wts.q3)} · Q4 Rendement ${pct(sr.wts.q4)}. Les poids changent selon votre horizon : liquidité en priorité sur court terme, rendement sur long terme.`
                        })(),
                        portfolioScore >= 75 ? '#22C55E' : portfolioScore >= 50 ? '#F59E0B' : '#EF4444'
                      )}
                    </div>
                  )
                })()}

                {/* ── Recommandations ── */}
                {recommendations.length > 0 && (
                  <div className="rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-4 space-y-3">
                    <p className="text-xs font-semibold text-[#1B3050] dark:text-white uppercase tracking-wide">Recommandations</p>
                    {recommendations.map((r, i) => (
                      <div key={i} className="flex gap-3 items-start">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm"
                          style={{ background: r.severity === 'high' ? '#FEE2E2' : r.severity === 'medium' ? '#FEF3C7' : '#DCFCE7' }}>
                          {r.icon}
                        </div>
                        <p className="text-xs text-[#3D4F62] dark:text-[#A8BBCC] leading-relaxed">{r.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Monte Carlo ── */}
            {tab === 'montecarlo' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-xs text-[#8899AA]">{mcBands.length > 0 ? <>2 000 scénarios simulés mois par mois sur 20 ans, basés sur la volatilité annuelle et le rendement annuel attendu de votre portefeuille (section Statistiques). La <strong className="text-[#1B3050] dark:text-white">ligne épaisse</strong> = résultat médian. La <strong className="text-[#1B3050] dark:text-white">zone sombre</strong> = la moitié des scénarios (entre le défavorable et le favorable). La <strong className="text-[#1B3050] dark:text-white">zone claire</strong> = 90 % des scénarios en enlevant les 5 % de chaque extrême (de ×{mcBands[mcBands.length - 1].p5.toFixed(2)} à ×{mcBands[mcBands.length - 1].p95.toFixed(2)}).{showFX && histStats ? ' · CHF (FX inclus)' : ''}</> : <>2 000 scénarios simulés mois par mois sur 20 ans.</>}</p>
                </div>
                <div className="rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-3 bg-[#FAFAF8] dark:bg-[#0F1E2E]">
                  {mcSVG()}
                </div>
                {mcBands.length > 0 && (
                  <div className="grid grid-cols-3 gap-3">
                    {tile('Résultat médian', `×${mcBands[mcBands.length - 1].p50.toFixed(2)}`, `Dans 1 scénario sur 2, votre portefeuille atteint au moins ce multiple à 20 ans. C'est le résultat "typique".`, '#2B6B5A')}
                    {tile('Scénario favorable', `×${mcBands[mcBands.length - 1].p75.toFixed(2)}`, `Dans 1 scénario sur 4, votre portefeuille fait encore mieux. C'est un bon résultat, sans être exceptionnel.`)}
                    {tile('Scénario défavorable', `×${mcBands[mcBands.length - 1].p25.toFixed(2)}`, `Dans 3 scénarios sur 4, votre portefeuille fait mieux que ça. C'est le plancher probable hors crise majeure et durable.`, '#F97316')}
                  </div>
                )}
              </div>
            )}

            {/* ── Stress Tests ── */}
            {tab === 'stress' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-xs text-[#8899AA]">{histStats ? 'Simulation : si vous aviez détenu ce portefeuille (mêmes proportions) pendant ces crises, voici la perte que vous auriez subie. Le temps de récupération est estimé selon le rendement annuel moyen de votre portefeuille.' : 'Estimation de la perte basée sur des chocs types par catégorie d\'actifs. Le temps de récupération est estimé selon le rendement annuel moyen de votre portefeuille.'}{showFX && histStats ? ' · CHF (FX inclus)' : ''}</p>
                </div>
                {stressResults.length === 0 && histStats && (
                  <p className="text-sm text-[#8899AA] text-center py-4">Aucune crise historique ne couvre la période de vos actifs.</p>
                )}
                {stressResults.map((sc, i) => (
                  <div key={i} className="rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-4 space-y-2">
                    <div className="flex justify-between items-center gap-2">
                      <p className="text-sm font-semibold text-[#1B3050] dark:text-white">{sc.label}</p>
                      <span className="text-sm font-bold" style={{ color: sc.loss < -0.15 ? '#EF4444' : sc.loss < 0 ? '#F97316' : '#22C55E' }}>
                        {sc.loss >= 0 ? '+' : ''}{(sc.loss * 100).toFixed(1)} %
                      </span>
                    </div>
                    {/* Barre */}
                    <div className="h-3 rounded-full bg-[#F0EDE8] dark:bg-[#1e3347] overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{
                        width: `${Math.min(100, Math.abs(sc.loss) * 100)}%`,
                        background: sc.loss < -0.15 ? '#EF4444' : sc.loss < 0 ? '#F97316' : '#22C55E'
                      }}/>
                    </div>
                    <p className="text-xs text-[#8899AA]">
                      {sc.loss < 0
                        ? `Récupération estimée : ~${sc.recovery} an${sc.recovery > 1 ? 's' : ''} (E(Rp) = ${(erEff * 100).toFixed(1)} %/an${showFX && histStats ? ' CHF' : ''})`
                        : 'Gain net — aucune perte de capital.'}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* ── Frontière efficiente ── */}
            {tab === 'frontier' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-xs text-[#8899AA]">
                    {histStats
                      ? <>5 000 répartitions aléatoires testées sur {Math.round(histStats.yearsCount * 10) / 10} ans de données réelles{showFX ? ' (en CHF)' : ''}. Chaque point = une façon différente de distribuer votre argent entre vos actifs. <span className="text-[#EF4444] font-medium">Rouge</span> = votre portefeuille actuel · <span className="text-[#F59E0B] font-medium">Jaune</span> = meilleur rendement pour le risque pris · <span className="text-[#3B82F6] font-medium">Bleu</span> = risque le plus faible.</>
                      : <>500 répartitions aléatoires testées. Chaque point = une façon différente de distribuer votre argent entre vos actifs. <span className="text-[#EF4444] font-medium">Rouge</span> = votre portefeuille actuel · <span className="text-[#F59E0B] font-medium">Jaune</span> = meilleur rendement pour le risque pris · <span className="text-[#3B82F6] font-medium">Bleu</span> = risque le plus faible.</>
                    }
                  </p>
                </div>
                <div className="rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-3 bg-[#FAFAF8] dark:bg-[#0F1E2E]">
                  {frontierSVG()}
                </div>
                {frontier.maxSharpe && frontier.minSigma && (
                  <div className="grid grid-cols-3 gap-3">
                    {tile('Votre Sharpe', frontier.current ? frontier.current.sh.toFixed(3) : sharpe.toFixed(3), `E(R) ${(erEff*100).toFixed(1)} % / σ ${(sigmaEff*100).toFixed(1)} %${showFX && histStats ? ' · CHF' : ''}`, '#EF4444')}
                    {tile('Max Sharpe', frontier.maxSharpe.sh.toFixed(3), `E(R) ${(frontier.maxSharpe.r * 100).toFixed(1)} % / σ ${(frontier.maxSharpe.s * 100).toFixed(1)} %`, '#F59E0B')}
                    {tile('Min σ', `${(frontier.minSigma.s * 100).toFixed(1)} %`, `E(R) ${(frontier.minSigma.r * 100).toFixed(1)} %`, '#3B82F6')}
                  </div>
                )}
                {histStats && histStats.optWeights.length >= 1 && (
                  <div className="rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] overflow-hidden">
                    <div className="px-4 py-3 border-b border-[#F5F3EF] dark:border-[#1e3347] flex items-center justify-between">
                      <p className="text-xs font-semibold text-[#1B3050] dark:text-white uppercase tracking-wide">Poids par actif</p>
                      <div className="flex gap-4 text-xs text-[#8899AA]">
                        <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#EF4444]"/> Actuel</span>
                        <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#F59E0B]"/> Max Sharpe</span>
                        <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#3B82F6]"/> Min vol</span>
                      </div>
                    </div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[#F5F3EF] dark:border-[#1e3347]">
                          <th className="px-4 py-2 text-left font-semibold text-[#5C6880] uppercase tracking-wider">Actif</th>
                          <th className="px-4 py-2 text-right font-semibold text-[#EF4444] uppercase tracking-wider">Actuel</th>
                          <th className="px-4 py-2 text-right font-semibold text-[#F59E0B] uppercase tracking-wider">Max Sharpe</th>
                          <th className="px-4 py-2 text-right font-semibold text-[#3B82F6] uppercase tracking-wider">Min vol</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F5F3EF] dark:divide-[#1e3347]">
                        {(() => {
                          // Group by ticker
                          const tickerOrder: string[] = []
                          const grouped: Record<string, typeof histStats.optWeights> = {}
                          for (const a of histStats.optWeights) {
                            if (!grouped[a.ticker]) { tickerOrder.push(a.ticker); grouped[a.ticker] = [] }
                            grouped[a.ticker].push(a)
                          }
                          tickerOrder.sort((ta, tb) => {
                            const wa = grouped[ta].reduce((s, a) => s + a.wCurrent, 0)
                            const wb = grouped[tb].reduce((s, a) => s + a.wCurrent, 0)
                            return wb - wa
                          })
                          return tickerOrder.map(ticker => {
                            const lots = grouped[ticker]
                            const isMulti = lots.length > 1
                            const isExp = expandedFrontierTickers.has(ticker)
                            const toggle = () => setExpandedFrontierTickers(s => { const n = new Set(s); n.has(ticker) ? n.delete(ticker) : n.add(ticker); return n })
                            const gCurrent = lots.reduce((s, a) => s + a.wCurrent, 0)
                            const gOptimal = lots.reduce((s, a) => s + a.wOptimal, 0)
                            const gMinVol  = lots.reduce((s, a) => s + a.wMinVol, 0)
                            const nom = lots[0].nom
                            return (
                              <React.Fragment key={ticker}>
                                <tr className={`hover:bg-[#F5F3EF]/50 dark:hover:bg-[#1B2D3E]/50 ${isExp ? 'bg-[#F5F3EF]/30 dark:bg-[#1B2D3E]/30' : ''}`}>
                                  <td className="px-4 py-2.5">
                                    <div className="flex items-center gap-1.5">
                                      {isMulti && (
                                        <button onClick={toggle} className="text-[#5C6880] hover:text-[#1B3050] dark:hover:text-white text-xs flex-shrink-0 w-4">
                                          {isExp ? '▾' : '▸'}
                                        </button>
                                      )}
                                      <div>
                                        <span className="font-medium text-[#1B3050] dark:text-white">{ticker}</span>
                                        <span className="ml-1.5 text-[#9E9A93]">{nom.length > 22 ? nom.slice(0, 22) + '…' : nom}</span>
                                        {isMulti && <span className="ml-1 text-[#9E9A93]">· {lots.length} lots</span>}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2.5 text-right font-mono font-semibold text-[#EF4444]">{(gCurrent * 100).toFixed(1)} %</td>
                                  <td className="px-4 py-2.5 text-right font-mono font-semibold text-[#F59E0B]">{(gOptimal * 100).toFixed(1)} %</td>
                                  <td className="px-4 py-2.5 text-right font-mono font-semibold text-[#3B82F6]">{(gMinVol * 100).toFixed(1)} %</td>
                                </tr>
                                {isMulti && isExp && lots.map((a, i) => (
                                  <tr key={i} className="bg-[#F5F3EF]/60 dark:bg-[#1B2D3E]/60 text-[#5C6880] dark:text-[#7B8DA6]">
                                    <td className="px-4 py-2 pl-9 text-xs">Lot {i + 1}</td>
                                    <td className="px-4 py-2 text-right font-mono text-xs text-[#EF4444]">{(a.wCurrent * 100).toFixed(1)} %</td>
                                    <td className="px-4 py-2 text-right font-mono text-xs text-[#F59E0B]">{(a.wOptimal * 100).toFixed(1)} %</td>
                                    <td className="px-4 py-2 text-right font-mono text-xs text-[#3B82F6]">{(a.wMinVol * 100).toFixed(1)} %</td>
                                  </tr>
                                ))}
                              </React.Fragment>
                            )
                          })
                        })()}
                      </tbody>
                    </table>
                    <p className="px-4 py-2 text-xs text-[#9E9A93] border-t border-[#F5F3EF] dark:border-[#1e3347]">
                      Monte Carlo sur données réelles — {histStats.yearsCount.toFixed(1)} ans · {histStats.optWeights.length} actif{histStats.optWeights.length > 1 ? 's' : ''} inclus
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── Données historiques ── */}
            {tab === 'historique' && (
              <div className="space-y-4">
                {histLoading && (
                  <div className="flex items-center gap-3 text-sm text-[#5C6880] dark:text-[#7B8DA6]">
                    <svg className="animate-spin h-4 w-4 text-[#2B6B5A]" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Récupération des données historiques Yahoo Finance…
                  </div>
                )}

                {!histLoading && !histStats && (
                  <p className="text-sm text-[#8899AA]">Impossible de récupérer les données historiques. Les statistiques affichées sont des estimations CAPM.</p>
                )}

                {histStats && (
                  <>
                    {/* Méthodologie en premier */}
                    <div className="rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-4 space-y-2">
                      <p className="text-xs font-semibold text-[#1B3050] dark:text-white uppercase tracking-wide">Comment ces chiffres sont calculés</p>
                      <p className="text-xs text-[#5C6880] dark:text-[#7B8DA6]">
                        Toutes les statistiques sont basées sur les cours réels de vos actifs entre{' '}
                        <strong className="text-[#1B3050] dark:text-white">
                          {new Date(histStats.periodStart).toLocaleDateString('fr-CH', { month: 'long', year: 'numeric' })}
                        </strong>
                        {' '}et{' '}
                        <strong className="text-[#1B3050] dark:text-white">
                          {new Date(histStats.periodEnd).toLocaleDateString('fr-CH', { month: 'long', year: 'numeric' })}
                        </strong>
                        {' '}({histStats.yearsCount.toFixed(1)} ans), fournis par Yahoo Finance et ajustés pour les dividendes et les divisions d&apos;actions. On mesure chaque jour la variation de valeur du portefeuille en appliquant vos proportions actuelles sur toute cette période — comme si vous aviez toujours détenu ces actifs dans ces mêmes proportions. Le rendement annuel et le risque sont ensuite calculés à partir de ces variations journalières.
                      </p>
                      <div className="space-y-1 text-xs text-[#8899AA] pt-1 border-t border-[#F5F3EF] dark:border-[#1e3347]">
                        <p>· E(Rp) = moyenne des rendements journaliers × 252 (nombre de jours de bourse par an)</p>
                        <p>· σ = écart-type des rendements journaliers × √252 (annualisé)</p>
                        <p>· VaR et CVaR paramétriques (loi normale, 95 %)</p>
                      </div>
                    </div>

                    {/* Tous les actifs — statut unifié */}
                    {(() => {
                      const allAssets = [
                        ...histStats.optWeights.map(a => {
                          const reducedEntry = histStats.reduced.find(r => r.ticker === a.ticker)
                          const isReduced = !!reducedEntry
                          return { ticker: a.ticker, nom: a.nom, status: isReduced ? 'reduced' : 'included' as 'included' | 'reduced' | 'excluded', years: isReduced && reducedEntry ? reducedEntry.years : histStats.yearsCount }
                        }),
                        ...histStats.excluded.map(a => ({ ticker: a.ticker, nom: a.nom, status: 'excluded' as const, years: a.years })),
                      ]
                      if (allAssets.length === 0) return null
                      const badge = (status: string) => {
                        if (status === 'included') return <span className="text-[#2B6B5A] font-semibold">✅ Inclus</span>
                        if (status === 'reduced')  return <span className="text-[#D97706] font-semibold">⚠️ Réduit</span>
                        return <span className="text-[#EF4444] font-semibold">⛔ Exclu</span>
                      }
                      const yearsColor = (status: string) =>
                        status === 'included' ? 'text-[#2B6B5A]' : status === 'reduced' ? 'text-[#D97706]' : 'text-[#EF4444]'
                      return (
                        <div className="rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] bg-white dark:bg-[#162534] p-4 space-y-3">
                          <p className="text-xs font-semibold text-[#1B3050] dark:text-white uppercase tracking-wide">Actifs du portefeuille</p>
                          <div className="space-y-2">
                            {allAssets.map(a => (
                              <div key={a.ticker} className="flex items-center justify-between gap-2 text-xs">
                                <span className="font-medium text-[#1B3050] dark:text-white min-w-0 truncate">
                                  {a.nom} <span className="text-[#8899AA]">({a.ticker})</span>
                                </span>
                                <div className="flex items-center gap-3 shrink-0">
                                  {badge(a.status)}
                                  <span className={`font-mono ${yearsColor(a.status)}`}>
                                    {a.years > 0 ? `${a.years.toFixed(1)} ans` : '—'}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-[#8899AA] border-t border-[#F5F3EF] dark:border-[#1e3347] pt-2">
                            <strong>Inclus</strong> = pris en compte dans toutes les statistiques. <strong>Réduit</strong> = inclus mais avec moins d&apos;historique, ce qui raccourcit la période d&apos;analyse commune. <strong>Exclu</strong> = moins de 3 ans de données, non pris en compte (son poids est redistribué aux autres actifs).
                          </p>
                        </div>
                      )
                    })()}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}


// ─── Main ─────────────────────────────────────────────────────────────────────
export default function PortfolioPage() {
  const [positions, setPositions] = useState<Position[]>([])
  const [activeTab, setActiveTab] = useState<'positions' | 'analyse' | 'cloturees'>('positions')
  const [chartMode, setChartMode] = useState<'evol' | 'pnl' | 'drawdown'>('evol')
  const [chartRange, setChartRange] = useState<'all' | '60d' | 'weekly'>('all')
  const [chartBustKey, setChartBustKey] = useState(0)
  const [maxDrawdown, setMaxDrawdown] = useState<{ pct: number; date: string } | null>(null)
  const [dailyMaxDrawdown, setDailyMaxDrawdown] = useState<{ pct: number; peakDate: string; date: string } | null>(null)
  const [dailyMDDLoading, setDailyMDDLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<Position, 'id'>>(EMPTY_FORM)
  // Slice mode (modifier en créant une tranche)
  const [sliceMode, setSliceMode] = useState(false)
  const [sliceDate, setSliceDate] = useState('')
  const [sliceQuantiteRaw, setSliceQuantiteRaw] = useState('')
  const [sliceQuantite, setSliceQuantite] = useState(0)
  const [sliceGroupTotal, setSliceGroupTotal] = useState(0)  // total du groupe (tous lots) au moment de l'ouverture
  const [slicePrixVenteRaw, setSlicePrixVenteRaw] = useState('')
  const [slicePrixVente, setSlicePrixVente] = useState<number | undefined>(undefined)
  const [sliceHistoPrice, setSliceHistoPrice] = useState<{ price: number; fxRate: number } | null>(null)
  const [sliceHistoLoading, setSliceHistoLoading] = useState(false)
  // Modale de suppression
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Position | null>(null)
  const [deleteMode, setDeleteMode] = useState<'permanent' | 'close'>('permanent')
  const [deleteCloseDate, setDeleteCloseDate] = useState('')
  const [deleteHistoPrice, setDeleteHistoPrice] = useState<{ price: number; fxRate: number } | null>(null)
  const [deleteHistoLoading, setDeleteHistoLoading] = useState(false)
  const [quantiteRaw, setQuantiteRaw] = useState('')  // string pour permettre la saisie de 0.00001
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [fetchingModal, setFetchingModal] = useState(false)
  const [fetchModalError, setFetchModalError] = useState<string | null>(null)
  const [fetchingAchat, setFetchingAchat] = useState(false)
  const [manuel, setManuel] = useState(false)
  const [profile, setProfile] = useState<InvProfile>({
    horizon: 10,
    loss: 25,
    liquidity: 'moyenne',
    objective: 'modéré',
  })
  const [userId, setUserId] = useState<string | null>(null)
  const [tickerDivs, setTickerDivs] = useState<Record<string, { dividendTTM: number; dividends: { ts: number; amount: number }[] }>>({})

  // Profil courtier actif (basé sur form.courtier)
  const brokerProfile = form.courtier ? BROKER_PROFILES[form.courtier] : null

  // Types Yahoo Finance par catégorie
  const CATEGORY_TYPES: Record<string, string[]> = {
    'Actions':            ['EQUITY'],
    'ETF':                ['ETF'],
    'ETF Oblig.':        ['ETF', 'MUTUALFUND', 'BOND'],
    'Matières premières': ['FUTURE'],
    'Crypto':             ['CRYPTOCURRENCY'],
    'Monnaies':           ['CURRENCY'],
    'Tout':               [], // pas de filtre
  }

  // Filtre effectif = intersection courtier ∩ catégorie
  // undefined = aucun filtre (tout afficher) | [] = combinaison impossible | [...] = filtre actif
  const categoryTypes = CATEGORY_TYPES[form.categorie] ?? []
  const brokerTypes   = brokerProfile?.types ?? []
  const effectiveTypes: string[] | undefined = (() => {
    const catEmpty = categoryTypes.length === 0
    const brkEmpty = brokerTypes.length === 0
    if (catEmpty && brkEmpty) return undefined        // ni courtier ni catégorie → tout
    if (catEmpty) return brokerTypes                  // courtier seul
    if (brkEmpty) return categoryTypes               // catégorie seule
    return categoryTypes.filter(t => brokerTypes.includes(t)) // intersection (peut être [])
  })()

  // ── Chargement : Supabase si connecté, localStorage sinon ───────────────────
  useEffect(() => {
    async function init() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setUserId(user.id)
          // Positions
          const { data: rows } = await supabase
            .from('portfolio_positions')
            .select('*')
            .eq('user_id', user.id)
          if (rows && rows.length > 0) {
            setPositions(rows.map((r: Record<string, unknown>) => ({
              id: r.id as string,
              nom: r.nom as string,
              ticker: r.ticker as string,
              categorie: r.categorie as string,
              devise: r.devise as string,
              quantite: Number(r.quantite),
              prixAchat: Number(r.prix_achat),
              tauxAchatCHF: Number(r.taux_achat_chf),
              dateAchat: r.date_achat as string,
              prixActuel: Number(r.prix_actuel),
              tauxActuelCHF: Number(r.taux_actuel_chf),
              courtier: (r.courtier as string) ?? undefined,
              derniereMaj: (r.derniere_maj as string) ?? undefined,
              dateVente: (r.date_vente as string) ?? undefined,
              prixVente: r.prix_vente !== undefined && r.prix_vente !== null ? Number(r.prix_vente) : undefined,
              tauxVenteCHF: r.taux_vente_chf !== undefined && r.taux_vente_chf !== null ? Number(r.taux_vente_chf) : undefined,
            })))
          } else {
            // Fallback localStorage si Supabase est vide
            try { const raw = localStorage.getItem('finveria_portfolio'); if (raw) setPositions(JSON.parse(raw)) } catch {}
          }
          // Profil investisseur
          const { data: prof } = await supabase
            .from('investor_profile')
            .select('*')
            .eq('user_id', user.id)
            .single()
          if (prof) {
            setProfile({
              horizon: Number(prof.horizon),
              loss: Number(prof.loss) as 10 | 20 | 30 | 40 | 50,
              liquidity: prof.liquidity as 'haute' | 'moyenne' | 'faible',
              objective: prof.objective as 'défensif' | 'modéré' | 'croissance' | 'agressif',
            })
          }
        } else {
          // Non connecté : localStorage
          try { const raw = localStorage.getItem('finveria_portfolio'); if (raw) setPositions(JSON.parse(raw)) } catch {}
        }
      } catch {
        try { const raw = localStorage.getItem('finveria_portfolio'); if (raw) setPositions(JSON.parse(raw)) } catch {}
      }
    }
    init()
  }, [])
  useEffect(() => {
    if (userId) return // connecté : Supabase gère (étape suivante)
    try { localStorage.setItem('finveria_portfolio', JSON.stringify(positions)) } catch {}
  }, [positions, userId])

  // ── Positions actives (non fermées) — pour affichage + stats ────────────────
  const todayStr = new Date().toISOString().slice(0, 10)
  const currentPositions = useMemo(
    () => positions.filter(p => !p.dateVente || p.dateVente >= todayStr),
    [positions, todayStr]
  )

  // ── Refresh global ──────────────────────────────────────────────────────────
  async function refreshPrices() {
    setRefreshing(true); setRefreshError(null)
    const results = await Promise.allSettled(currentPositions.map(async (p) => {
      if (!p.ticker.trim()) return p
      const res = await fetch(`/api/prices?ticker=${encodeURIComponent(p.ticker)}&devise=${p.devise}`)
      if (!res.ok) return p
      const data = await res.json()
      return { ...p, ...(data.price != null ? { prixActuel: data.price } : {}), ...(data.fxRate != null ? { tauxActuelCHF: data.fxRate } : {}), derniereMaj: new Date().toISOString() }
    }))
    const updated = results.map((r, i) => r.status === 'fulfilled' ? r.value : currentPositions[i])
    // Merge updated current positions back into full positions list (preserve closed ones)
    const updatedIds = new Set(updated.map(p => p.id))
    setPositions(ps => ps.map(p => updatedIds.has(p.id) ? updated.find(u => u.id === p.id)! : p))
    if (userId) {
      const supabase = createClient()
      await Promise.all(updated.map(p => supabase.from('portfolio_positions').update({
        prix_actuel: p.prixActuel, taux_actuel_chf: p.tauxActuelCHF, derniere_maj: p.derniereMaj ?? null,
      }).eq('id', p.id).eq('user_id', userId)))
    }
    const errCount = results.filter(r => r.status === 'rejected').length
    if (errCount > 0) setRefreshError(`${errCount} position(s) non mises à jour.`)
    setRefreshing(false)
  }

  // ── Fetch dividendes TTM par ticker ─────────────────────────────────────────
  const divKey = currentPositions.map(p => p.ticker.toUpperCase()).join(',')
  useEffect(() => {
    if (currentPositions.length === 0) { setTickerDivs({}); return }
    const tickers = [...new Set(currentPositions.map(p => p.ticker.toUpperCase()))].join(',')
    fetchHistory(tickers)
      .then((raw: Record<string, { dividendTTM?: number; dividends?: { ts: number; amount: number }[] }>) => {
        const divs: Record<string, { dividendTTM: number; dividends: { ts: number; amount: number }[] }> = {}
        for (const [t, v] of Object.entries(raw)) {
          if (v?.dividendTTM && v.dividendTTM > 0) divs[t] = { dividendTTM: v.dividendTTM, dividends: v.dividends ?? [] }
        }
        setTickerDivs(divs)
      })
      .catch(() => {})
  }, [divKey])

  // ── Fetch prix actuel (params explicites pour déclencher sans attendre setState) ──
  async function fetchPrixActuelFor(ticker: string, devise: string) {
    if (!ticker.trim()) return
    setFetchingModal(true); setFetchModalError(null)
    try {
      const res = await fetch(`/api/prices?ticker=${encodeURIComponent(ticker)}&devise=${devise}`)
      const data = await res.json()
      if (data.price != null) setForm(f => ({ ...f, prixActuel: data.price, tauxActuelCHF: data.fxRate ?? 1 }))
    } catch {}
    finally { setFetchingModal(false) }
  }

  // ── Fetch prix historique (ou temps réel si date = aujourd'hui) ─────────────
  async function fetchPrixAchatFor(ticker: string, devise: string, date: string) {
    if (!ticker.trim() || !date) return
    setFetchingAchat(true); setFetchModalError(null)
    try {
      const today = new Date().toISOString().slice(0, 10)
      // Si date = aujourd'hui ou future : utiliser prix temps réel (historique Yahoo non dispo)
      const url = date >= today
        ? `/api/prices?ticker=${encodeURIComponent(ticker)}&devise=${devise}`
        : `/api/prices?ticker=${encodeURIComponent(ticker)}&devise=${devise}&date=${date}`
      const res = await fetch(url)
      const data = await res.json()
      if (data.price != null) setForm(f => ({ ...f, prixAchat: data.price, tauxAchatCHF: data.fxRate ?? 1 }))
    } catch {}
    finally { setFetchingAchat(false) }
  }

  // ── Calculs ─────────────────────────────────────────────────────────────────
  const positionsCalc: PositionCalc[] = useMemo(() => currentPositions.map(p => {
    // Pour les ventes (quantite < 0, prixVente renseigné) :
    //   cout  = |qty| × prixAchat × tauxAchat       (positif : ce qu'on a payé à l'achat)
    //   valeur= |qty| × prixVente × tauxVente        (positif : ce qu'on a encaissé à la vente)
    //   gain  = valeur − cout                        (réalisé, positif si profitable)
    const absQty = Math.abs(p.quantite)
    const isSale = p.quantite < 0 && p.prixVente != null
    const coutCHF = isSale
      ? absQty * p.prixAchat * p.tauxAchatCHF
      : p.quantite * p.prixAchat * p.tauxAchatCHF
    const valeurCHF = isSale
      ? absQty * p.prixVente! * (p.tauxVenteCHF ?? p.tauxAchatCHF)
      : p.quantite * p.prixActuel * p.tauxActuelCHF
    const gainCHF = valeurCHF - coutCHF
    const gainPctCHF = coutCHF > 0 ? (gainCHF / coutCHF) * 100 : 0
    const gainDevise = isSale
      ? absQty * (p.prixVente! - p.prixAchat)
      : p.quantite * (p.prixActuel - p.prixAchat)
    const gainPctDevise = p.prixAchat > 0 ? ((p.prixActuel - p.prixAchat) / p.prixAchat) * 100 : 0
    const impactFX = p.devise === 'CHF' ? 0
      : isSale
        ? absQty * p.prixVente! * ((p.tauxVenteCHF ?? p.tauxAchatCHF) - p.tauxAchatCHF)
        : p.quantite * p.prixActuel * (p.tauxActuelCHF - p.tauxAchatCHF)
    const inflation = inflationCumulee(p.dateAchat)
    const gainReel = gainCHF - coutCHF * inflation
    const gainPctReel = coutCHF > 0 ? (gainReel / coutCHF) * 100 : 0
    return { ...p, coutCHF, valeurCHF, gainCHF, gainPctCHF, gainDevise, gainPctDevise, impactFX, gainReel, gainPctReel }
  }), [currentPositions, tickerDivs])

  const totals = useMemo(() => {
    // Regrouper par ticker pour appliquer la même logique FIFO que l'onglet Positions
    const grp: Record<string, typeof positionsCalc> = {}
    for (const p of positionsCalc) { const k = p.ticker.toUpperCase(); (grp[k] ??= []).push(p) }

    let coutTotal = 0, valeurTotal = 0, fxTotal = 0, gainReelTotal = 0
    for (const group of Object.values(grp)) {
      const gQteNet = group.reduce((s, p) => s + p.quantite, 0)
      if (gQteNet <= 0) continue  // ticker entièrement vendu → exclure des totaux ouverts
      const longsGroup = group.filter(p => p.quantite > 0)
      const first = longsGroup[0] ?? group[0]  // Pour champs non-prix (nom, devise, dateAchat)
      // Référence de prix = lot le plus récemment rafraîchi (même actif = même prix courant)
      const priceRef = longsGroup.reduce(
        (best, p) => ((p.derniereMaj ?? '') >= (best.derniereMaj ?? '') ? p : best),
        longsGroup[0] ?? group[0]
      )
      // Valeur actuelle = quantité nette × prix actuel
      const gVal   = gQteNet * priceRef.prixActuel * priceRef.tauxActuelCHF
      valeurTotal += gVal
      // Coût net CHF (longs − réductions FIFO)
      const gCout  = group.reduce((s, p) => s + (p.quantite > 0 ? p.coutCHF : -p.coutCHF), 0)
      coutTotal   += gCout
      // Impact FX sur position nette : taux moyen pondéré à l'achat = gCout / gCoutDevise
      // Coût en devise = coût net de la position ouverte (longs FIFO nets)
      const gCoutDevise = longsGroup.reduce((s, p) => s + p.quantite * p.prixAchat, 0) - group.filter(q => q.quantite < 0 && q.prixVente != null).reduce((s, q) => s + Math.abs(q.quantite) * q.prixAchat, 0)
      const gWgtBuyRate = priceRef.devise !== 'CHF' && gCoutDevise > 0 ? gCout / gCoutDevise : first.tauxAchatCHF
      fxTotal      += priceRef.devise === 'CHF' ? 0 : gQteNet * priceRef.prixActuel * (priceRef.tauxActuelCHF - gWgtBuyRate)
      // Gain réel = gain CHF net − inflation sur coût net (depuis premier achat)
      gainReelTotal += (gVal - gCout) - gCout * inflationCumulee(first.dateAchat)
    }

    const gainTotal = valeurTotal - coutTotal
    const gainPct = coutTotal > 0 ? (gainTotal / coutTotal) * 100 : 0
    const gainReelPct = coutTotal > 0 ? (gainReelTotal / coutTotal) * 100 : 0
    const inflationErosionTotal = gainTotal - gainReelTotal

    // Dividendes : uniquement positions ouvertes (quantite > 0, pas de dateVente)
    const divCumulTotal = positionsCalc
      .filter(p => p.quantite > 0 && !p.dateVente)
      .reduce((s, p) => {
        const entry = tickerDivs[p.ticker.toUpperCase()]
        const purchaseTs = new Date(p.dateAchat).getTime() / 1000
        return s + (entry ? entry.dividends.filter(d => d.ts >= purchaseTs).reduce((a, d) => a + d.amount, 0) * p.quantite * p.tauxActuelCHF : 0)
      }, 0)

    return { coutTotal, valeurTotal, gainTotal, gainPct, fxTotal, gainReelTotal, gainReelPct, divCumulTotal, inflationErosionTotal }
  }, [positionsCalc, tickerDivs])

  // ── Groupement par ticker ────────────────────────────────────────────────────
  const [expandedTickers, setExpandedTickers] = useState<Set<string>>(new Set())
  const groupOrder = useMemo(() => {
    const seen: string[] = []
    for (const p of positionsCalc) { const k = p.ticker.toUpperCase(); if (!seen.includes(k)) seen.push(k) }
    // Exclure les tickers dont la quantité nette est nulle (lot entièrement vendu)
    const grpTmp: Record<string, typeof positionsCalc> = {}
    for (const p of positionsCalc) { const k = p.ticker.toUpperCase(); (grpTmp[k] ??= []).push(p) }
    return seen.filter(k => grpTmp[k].reduce((s, p) => s + p.quantite, 0) > 0)
  }, [positionsCalc])
  const groupedPositions = useMemo(() => {
    const g: Record<string, PositionCalc[]> = {}
    for (const p of positionsCalc) { const k = p.ticker.toUpperCase(); (g[k] ??= []).push(p) }
    return g
  }, [positionsCalc])

  // ── Modal ───────────────────────────────────────────────────────────────────
  // Auto-fetch historical price when sliceDate changes in reduction mode
  useEffect(() => {
    if (!sliceMode || !sliceDate || !form.ticker) {
      setSliceHistoPrice(null)
      return
    }
    setSliceHistoLoading(true)
    setSliceHistoPrice(null)
    fetchPriceCached(form.ticker, form.devise, sliceDate)
      .then(data => {
        setSliceHistoPrice(data)
        // Pre-fill the price field if user hasn't manually entered one
        if (data && slicePrixVenteRaw === '') {
          setSlicePrixVente(data.price)
        }
      })
      .finally(() => setSliceHistoLoading(false))
  }, [sliceDate, sliceMode, form.ticker, form.devise])

  function openAdd() { setEditId(null); setForm(EMPTY_FORM); setQuantiteRaw(''); setFetchModalError(null); setManuel(false); setSliceMode(false); setSliceDate(''); setSliceQuantiteRaw(''); setSliceQuantite(0); setSlicePrixVenteRaw(''); setSlicePrixVente(undefined); setSliceHistoPrice(null); setShowModal(true) }
  function openEdit(p: Position) {
    // Calculer le total du groupe (tous lots actifs du même ticker)
    const grp = groupedPositions[p.ticker.toUpperCase()]
    const groupTotal = grp ? grp.reduce((s, pc) => s + pc.quantite, 0) : p.quantite
    setEditId(p.id); setForm({ ...p }); setQuantiteRaw(String(p.quantite)); setFetchModalError(null); setManuel(true)
    setSliceMode(false); setSliceDate(p.dateAchat); setSliceQuantiteRaw(String(groupTotal)); setSliceQuantite(groupTotal)
    setSliceGroupTotal(groupTotal)
    setSlicePrixVenteRaw(''); setSlicePrixVente(undefined); setSliceHistoPrice(null); setShowModal(true)
  }

  async function upsertPositionDB(supabase: ReturnType<typeof createClient>, pos: Position) {
    const basePayload = {
      id: pos.id, user_id: userId,
      nom: pos.nom, ticker: pos.ticker, categorie: pos.categorie, devise: pos.devise,
      quantite: pos.quantite, prix_achat: pos.prixAchat, taux_achat_chf: pos.tauxAchatCHF,
      date_achat: pos.dateAchat, prix_actuel: pos.prixActuel, taux_actuel_chf: pos.tauxActuelCHF,
      courtier: pos.courtier ?? null, derniere_maj: pos.derniereMaj ?? null,
    }
    const payload = {
      ...basePayload,
      ...(pos.dateVente  !== undefined ? { date_vente: pos.dateVente }                                              : {}),
      ...(pos.prixVente  !== undefined ? { prix_vente: pos.prixVente, taux_vente_chf: pos.tauxVenteCHF ?? 1 }      : {}),
    }
    const { error } = await supabase.from('portfolio_positions').upsert(payload, { onConflict: 'id' })
    if (error) {
      if (error.message?.includes('date_vente') || error.message?.includes('prix_vente') || error.message?.includes('taux_vente_chf')) {
        // Colonne manquante — retenter sans colonnes optionnelles (migration requise)
        const { error: e2 } = await supabase.from('portfolio_positions').upsert(basePayload, { onConflict: 'id' })
        if (e2) console.error('[finveria] upsertPositionDB error:', e2.message)
        // migrations requises si absent : ALTER TABLE portfolio_positions ADD COLUMN IF NOT EXISTS date_vente date; ADD COLUMN IF NOT EXISTS prix_vente numeric; ADD COLUMN IF NOT EXISTS taux_vente_chf numeric;
      } else {
        console.error('[finveria] upsertPositionDB error:', error.message)
      }
    }
  }

  async function saveForm() {
    if (!form.ticker) return
    if (editId && sliceMode && sliceDate && form.dateAchat && sliceDate < form.dateAchat) return
    setShowModal(false)

    if (editId && sliceMode && sliceDate) {
      // MODE DELTA : ajouter une entrée de correction sans toucher à l'originale
      const newTotal = sliceQuantite || sliceGroupTotal
      const deltaQty = newTotal - sliceGroupTotal  // delta par rapport au total du groupe, pas du lot seul
      const isAddition = deltaQty > 0
      if (deltaQty !== 0) {
        const deltaPos: Position = {
          ...form,
          id: crypto.randomUUID(),
          quantite: deltaQty,
          dateAchat: sliceDate,
          dateVente: undefined,
          // Ajout de lot : nouveau prix d'achat propre au lot
          // Réduction : prix de vente + garder prixAchat original
          ...(isAddition ? {
            prixAchat: slicePrixVente ?? sliceHistoPrice?.price ?? form.prixActuel,
            tauxAchatCHF: sliceHistoPrice?.fxRate ?? form.tauxActuelCHF,
            prixVente: undefined,
            tauxVenteCHF: undefined,
          } : {
            prixVente: slicePrixVente ?? sliceHistoPrice?.price ?? form.prixActuel,
            tauxVenteCHF: sliceHistoPrice?.fxRate ?? form.tauxActuelCHF,
          }),
        }
        setPositions(ps => [...ps, deltaPos])
        if (userId) {
          const supabase = createClient()
          await upsertPositionDB(supabase, deltaPos)
        }
      }
      // L'ancienne position reste inchangée ; le total affiché = somme du groupe
    } else {
      // MODE NORMAL : remplacer ou créer
      const id = editId ?? crypto.randomUUID()
      const pos: Position = { ...form, id }
      if (editId) {
        setPositions(ps => ps.map(p => p.id === editId ? pos : p))
      } else {
        // Ajout d'un nouveau lot : mettre à jour le prix actuel de tous les lots ouverts
        // du même ticker pour garantir la cohérence dans l'onglet Analyse FX & Inflation
        const tickerUp = pos.ticker.toUpperCase()
        setPositions(ps => {
          const synced = ps.map(p =>
            p.ticker.toUpperCase() === tickerUp && !p.dateVente && p.quantite > 0
              ? { ...p, prixActuel: pos.prixActuel, tauxActuelCHF: pos.tauxActuelCHF, derniereMaj: pos.derniereMaj }
              : p
          )
          return [...synced, pos]
        })
      }

      if (userId) {
        const supabase = createClient()
        await upsertPositionDB(supabase, pos)
      }
    }
  }

  function openDeleteModal(p: Position) {
    setDeleteTarget(p)
    setDeleteMode('permanent')
    setDeleteCloseDate(new Date().toISOString().slice(0, 10))
    setShowDeleteModal(true)
  }

  // Auto-fetch historical price when close date changes
  useEffect(() => {
    if (deleteMode !== 'close' || !deleteCloseDate || !deleteTarget) {
      setDeleteHistoPrice(null)
      return
    }
    setDeleteHistoLoading(true)
    setDeleteHistoPrice(null)
    fetchPriceCached(deleteTarget.ticker, deleteTarget.devise, deleteCloseDate)
      .then(data => setDeleteHistoPrice(data))
      .finally(() => setDeleteHistoLoading(false))
  }, [deleteCloseDate, deleteMode, deleteTarget?.ticker, deleteTarget?.devise])

  async function confirmDelete() {
    if (!deleteTarget) return
    setShowDeleteModal(false)
    const id = deleteTarget.id

    if (deleteMode === 'permanent') {
      setPositions(ps => ps.filter(p => p.id !== id))
      if (userId) {
        const supabase = createClient()
        await supabase.from('portfolio_positions').delete().eq('id', id).eq('user_id', userId)
      }
    } else {
      // Clôturer = créer un lot de réduction pour la quantité nette FIFO restante du ticker
      // (même comportement qu'une réduction manuelle au maximum)
      const tickerUp = deleteTarget.ticker.toUpperCase()
      const tickerLots = positions.filter(p => p.ticker.toUpperCase() === tickerUp && !p.dateVente)
      const longsSort = tickerLots.filter(p => p.quantite > 0).sort((a, b) => a.dateAchat.localeCompare(b.dateAchat))
      let alreadySold = tickerLots.filter(p => p.quantite < 0 && p.prixVente != null).reduce((s, p) => s + Math.abs(p.quantite), 0)
      let netFifoQty = 0
      for (const l of longsSort) {
        const consumed = Math.min(l.quantite, alreadySold)
        alreadySold = Math.max(0, alreadySold - consumed)
        netFifoQty += l.quantite - consumed
      }
      if (netFifoQty > 0) {
        const reductionLot: Position = {
          ...deleteTarget,
          id: crypto.randomUUID(),
          quantite: -netFifoQty,
          dateAchat: deleteCloseDate,
          dateVente: undefined,
          prixVente: deleteHistoPrice?.price ?? deleteTarget.prixActuel,
          tauxVenteCHF: deleteHistoPrice?.fxRate ?? deleteTarget.tauxActuelCHF,
        }
        setPositions(ps => [...ps, reductionLot])
        if (userId) {
          const supabase = createClient()
          await upsertPositionDB(supabase, reductionLot)
        }
      }
    }
    setDeleteTarget(null)
  }

  function exportCSV() {
    const headers = ['Nom','Ticker','Catégorie','Devise','Quantité','Prix achat','Taux achat CHF','Prix actuel','Taux actuel CHF','Date achat','Coût CHF','Valeur CHF','Gain CHF','Gain %','Gain réel CHF']
    const rows = positionsCalc.map(p => [
      p.nom, p.ticker, p.categorie, p.devise,
      p.quantite, p.prixAchat, p.tauxAchatCHF, p.prixActuel, p.tauxActuelCHF,
      p.dateAchat,
      p.coutCHF.toFixed(2), p.valeurCHF.toFixed(2), p.gainCHF.toFixed(2),
      p.gainPctCHF.toFixed(2), p.gainReel.toFixed(2)
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `finveria-portfolio-${new Date().toISOString().slice(0,10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }
  const fld = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value }))

  const clr = (n: number) => n >= 0 ? 'text-[#2B6B5A]' : 'text-red-500'
  const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
  const chf = (n: number) => n.toLocaleString('fr-CH', { maximumFractionDigits: 0 }) + ' CHF'
  const isEmpty = currentPositions.length === 0
  const lastMaj = currentPositions.map(p => p.derniereMaj).filter(Boolean).sort().pop()

  const inputCls = `w-full bg-white dark:bg-[#1B2D3E] border border-[#DDD9D1] dark:border-[#2a3f52]
    rounded-lg px-3 py-2 text-sm text-[#1B3050] dark:text-[#E8E4DC]
    focus:outline-none focus:ring-2 focus:ring-[#2B6B5A] focus:border-transparent placeholder-[#9E9A93]`

  // ── Drawdown max journalier (calcul précis depuis l'achat) ─────────────────
  const _positionsKey = positionsCalc.map(p => p.ticker + '|' + p.dateAchat + '|' + p.quantite).join(',')
  useEffect(() => {
    if (positionsCalc.length === 0) return
    setDailyMDDLoading(true)
    const tickers = [...new Set(positionsCalc.map(p => p.ticker.toUpperCase()))].join(',')
    fetchHistory(tickers)
      .then((raw: Record<string, { dates: string[]; closes: number[] }>) => {
        // Build price map ticker → date → close
        const priceMap: Record<string, Record<string, number>> = {}
        const dateSet = new Set<string>()
        for (const [ticker, hist] of Object.entries(raw)) {
          priceMap[ticker] = {}
          for (let i = 0; i < hist.dates.length; i++) {
            priceMap[ticker][hist.dates[i]] = hist.closes[i]
            dateSet.add(hist.dates[i])
          }
        }
        const allDates = [...dateSet].sort()
        // Première date avec données réelles pour chaque ticker
        const tickerFirstDate: Record<string, string> = {}
        for (const [ticker, dayPrices] of Object.entries(priceMap)) {
          const sorted = Object.keys(dayPrices).filter(d => dayPrices[d] != null).sort()
          if (sorted.length > 0) tickerFirstDate[ticker.toUpperCase()] = sorted[0]
        }
        // Forward-fill last known price per ticker
        const lastPrice: Record<string, number> = {}
        let peak = -Infinity, peakDate = '', maxDD = 0, maxDDDate = '', maxDDPeakDate = ''
        for (const date of allDates) {
          for (const [ticker, dayPrices] of Object.entries(priceMap)) {
            if (dayPrices[date] != null) lastPrice[ticker.toUpperCase()] = dayPrices[date]
          }
          const active = positionsCalc.filter(p => p.dateAchat <= date)
          if (active.length === 0) continue
          // Ignorer les dates où des actifs actifs n'ont pas encore de données réelles
          // (évite d'utiliser p.valeurCHF = valeur actuelle comme fallback historique)
          if (!active.every(p => {
            const t = p.ticker.toUpperCase()
            return tickerFirstDate[t] != null && tickerFirstDate[t] <= date
          })) continue
          const value = active.reduce((s, p) => {
            const px = lastPrice[p.ticker.toUpperCase()]
            return s + (px != null ? p.quantite * px * p.tauxActuelCHF : 0)
          }, 0)
          if (value <= 0) continue
          if (value > peak) { peak = value; peakDate = date }
          if (peak > 0) {
            const dd = ((value - peak) / peak) * 100
            if (dd < maxDD) { maxDD = dd; maxDDDate = date; maxDDPeakDate = peakDate }
          }
        }
        setDailyMaxDrawdown(maxDD < -0.1 ? { pct: maxDD, peakDate: maxDDPeakDate, date: maxDDDate } : null)
        setDailyMDDLoading(false)
      })
      .catch(() => setDailyMDDLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_positionsKey])


  return (
    <div className="min-h-screen bg-[#F5F3EF] dark:bg-[#0F1E2C] text-[#1B3050] dark:text-[#E8E4DC]">
      <Header />

      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold tracking-tight">Mon portfolio</h1>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#B5820F]/10 text-[#B5820F] border border-[#B5820F]/20">Premium</span>
            </div>
            <p className="text-[#5C6880] text-sm">Suivi de vos positions avec performance nominale, ajustée FX et inflation réelle.</p>
            {lastMaj && (
              <p className="text-xs text-[#9E9A93] mt-1">
                Dernière mise à jour : {new Date(lastMaj).toLocaleString('fr-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                {' '}· Données Yahoo Finance (délai ~15 min)
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {!isEmpty && (
              <>
                <button onClick={exportCSV}
                  className="border border-[#DDD9D1] dark:border-[#2a3f52] text-[#5C6880] text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#F5F3EF] dark:hover:bg-[#1B2D3E] transition-colors flex items-center gap-2">
                  ↓ Export CSV
                </button>
                <button onClick={refreshPrices} disabled={refreshing}
                  className="border border-[#2B6B5A] text-[#2B6B5A] text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#2B6B5A]/10 disabled:opacity-40 transition-colors flex items-center gap-2">
                  <span className={refreshing ? 'animate-spin inline-block' : ''}>⟳</span>
                  {refreshing ? 'Mise à jour…' : 'Rafraîchir les prix'}
                </button>
              </>
            )}
            <button onClick={openAdd} className="bg-[#2B6B5A] hover:bg-[#225549] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              + Ajouter
            </button>
          </div>
        </div>

        {refreshError && (
          <div className="mb-4 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg text-sm text-amber-700 dark:text-amber-400 flex items-center justify-between">
            <span>⚠️ {refreshError}</span>
            <button onClick={() => setRefreshError(null)} className="ml-4 text-amber-400 hover:text-amber-600">×</button>
          </div>
        )}

        {isEmpty ? (
          <div className="bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-16 text-center">
            <div className="text-5xl mb-4">📈</div>
            <h2 className="text-lg font-semibold mb-2">Commencez à suivre votre portefeuille</h2>
            <p className="text-[#5C6880] text-sm mb-6 max-w-sm mx-auto">
              Recherchez un actif par nom ou ticker — les prix et taux de change sont récupérés automatiquement.
            </p>
            <button onClick={openAdd} className="bg-[#2B6B5A] hover:bg-[#225549] text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors">
              + Ajouter ma première position
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
              <div className="lg:col-span-1 space-y-4">
                <div className="bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-5">
                  <p className="text-xs font-semibold text-[#5C6880] uppercase tracking-wider mb-1">Valeur totale</p>
                  <p className="text-2xl font-bold font-mono" style={{ fontVariantNumeric: 'tabular-nums' }}>{chf(totals.valeurTotal)}</p>
                  <p className="text-xs text-[#9E9A93] mt-0.5">Investi: {chf(totals.coutTotal)}</p>
                </div>
                <div className="bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <p className="text-xs font-semibold text-[#5C6880] uppercase tracking-wider">Gain nominal CHF</p>
                    <div className="relative group">
                      <span className="w-4 h-4 rounded-full bg-[#DDD9D1] dark:bg-[#2a3f52] text-[#5C6880] text-[10px] font-bold flex items-center justify-center cursor-default select-none">?</span>
                      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 z-50 hidden group-hover:block pointer-events-none">
                        <div className="bg-[#1B3050] dark:bg-[#0F1E2C] text-white text-xs rounded-xl p-3 shadow-xl space-y-2">
                          <p className="font-semibold text-white/90">Gain nominal en CHF</p>
                          <p className="text-white/70 leading-relaxed">Différence entre la valeur actuelle et le coût d'achat, convertie en CHF au taux actuel. Reflète uniquement l'évolution du prix et l'effet du taux de change — dividendes non inclus.</p>
                          <div className="border-t border-white/20 pt-2">
                            <p className="text-white/60 text-[11px] mb-1">Dont impact taux de change :</p>
                            <p className={`font-mono font-semibold ${totals.fxTotal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {totals.fxTotal >= 0 ? '+' : ''}{chf(totals.fxTotal)}{' '}
                              <span className="text-[11px] opacity-80">({(() => { const base = totals.gainTotal - totals.fxTotal; return base !== 0 ? (totals.fxTotal / Math.abs(base) * 100).toFixed(2) : '0.00' })()} %)</span>
                            </p>
                          </div>
                          <div className="w-2 h-2 bg-[#1B3050] dark:bg-[#0F1E2C] rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className={`text-xl font-bold font-mono ${clr(totals.gainTotal)}`}>{totals.gainTotal >= 0 ? '+' : ''}{chf(totals.gainTotal)}</p>
                  <p className={`text-sm font-mono ${clr(totals.gainPct)}`}>{pct(totals.gainPct)}</p>
                </div>
                <div className="bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <p className="text-xs font-semibold text-[#5C6880] uppercase tracking-wider">Gain réel</p>
                    <div className="relative group">
                      <span className="w-4 h-4 rounded-full bg-[#DDD9D1] dark:bg-[#2a3f52] text-[#5C6880] text-[10px] font-bold flex items-center justify-center cursor-default select-none">?</span>
                      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 z-50 hidden group-hover:block pointer-events-none">
                        <div className="bg-[#1B3050] dark:bg-[#0F1E2C] text-white text-xs rounded-xl p-3 shadow-xl space-y-2">
                          <p className="font-semibold text-white/90">Gain réel après inflation</p>
                          <p className="text-white/70 leading-relaxed">Gain nominal diminué de l'érosion inflationniste (CPI suisse OFS) depuis la date d'achat. Reflète le vrai pouvoir d'achat gagné ou perdu — dividendes non inclus.</p>
                          <div className="border-t border-white/20 pt-2 space-y-1">
                            <p className="text-white/60 text-[11px]">Dont érosion par l'inflation :</p>
                            <p className="font-mono font-semibold text-orange-400">
                              -{chf(totals.inflationErosionTotal)}{' '}
                              <span className="text-[11px] opacity-80">({totals.gainTotal !== 0 ? (totals.inflationErosionTotal / Math.abs(totals.gainTotal) * 100).toFixed(2) : '0.00'} %)</span>
                            </p>
                          </div>
                          <div className="w-2 h-2 bg-[#1B3050] dark:bg-[#0F1E2C] rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className={`text-xl font-bold font-mono ${clr(totals.gainReelTotal)}`}>{totals.gainReelTotal >= 0 ? '+' : ''}{chf(totals.gainReelTotal)}</p>
                  <p className={`text-sm font-mono ${clr(totals.gainReelPct)}`}>{pct(totals.gainReelPct)}</p>
                </div>
                {(() => {
                  const realizedGain = positions.reduce((s, p) => {
                    if (p.quantite < 0 && p.prixVente !== undefined) {
                      const qty = Math.abs(p.quantite)
                      return s + qty * (p.prixVente ?? 0) * (p.tauxVenteCHF ?? 1) - qty * p.prixAchat * p.tauxAchatCHF
                    }
                    if (p.dateVente && p.quantite > 0) {
                      const pxV = p.prixVente ?? p.prixActuel
                      const txV = p.tauxVenteCHF ?? p.tauxActuelCHF
                      return s + p.quantite * pxV * txV - p.quantite * p.prixAchat * p.tauxAchatCHF
                    }
                    return s
                  }, 0)
                  const divCumul = positionsCalc.reduce((s, p) => {
                    const entry = tickerDivs[p.ticker.toUpperCase()]
                    if (!entry) return s
                    const purchaseTs = new Date(p.dateAchat).getTime() / 1000
                    const cumul = entry.dividends.filter(d => d.ts >= purchaseTs).reduce((a, d) => a + d.amount, 0)
                    return s + p.quantite * cumul * p.tauxActuelCHF
                  }, 0)
                  const divTTM = positionsCalc.reduce((s, p) => {
                    const entry = tickerDivs[p.ticker.toUpperCase()]
                    return s + (entry ? p.quantite * entry.dividendTTM * p.tauxActuelCHF : 0)
                  }, 0)
                  const divYield = totals.valeurTotal > 0 ? (divTTM / totals.valeurTotal) * 100 : 0
                  const total = realizedGain + divCumul
                  if (realizedGain === 0 && divCumul <= 0) return null
                  return (
                    <div className="bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <p className="text-xs font-semibold text-[#5C6880] uppercase tracking-wider">Gains réalisés</p>
                        <div className="relative group">
                          <span className="w-4 h-4 rounded-full bg-[#DDD9D1] dark:bg-[#2a3f52] text-[#5C6880] text-[10px] font-bold flex items-center justify-center cursor-default select-none">?</span>
                          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 z-50 hidden group-hover:block pointer-events-none">
                            <div className="bg-[#1B3050] dark:bg-[#0F1E2C] text-white text-xs rounded-xl p-3 shadow-xl space-y-2">
                              <p className="font-semibold text-white/90">Gains réalisés + dividendes perçus</p>
                              <p className="text-white/70 leading-relaxed">Total des gains en cash effectivement encaissés : positions clôturées/réduites + dividendes versés depuis la date d&apos;achat, convertis en CHF.</p>
                              <div className="border-t border-white/20 pt-2 space-y-1">
                                <p className="text-white/60 text-[11px]">· Gains clos/réductions : {realizedGain >= 0 ? '+' : ''}{chf(realizedGain)}</p>
                                <p className="text-white/60 text-[11px]">· Dividendes perçus : +{chf(divCumul)}</p>
                                <p className="text-white/60 text-[11px] mt-1">⚠️ Les ETF capitalisants (ex : CSPX, VWCE) réinvestissent leurs dividendes — non comptabilisés ici.</p>
                              </div>
                              <div className="w-2 h-2 bg-[#1B3050] dark:bg-[#0F1E2C] rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1"></div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <p className={`text-xl font-bold font-mono ${total >= 0 ? 'text-[#2B6B5A]' : 'text-red-500'}`}>{total >= 0 ? '+' : ''}{chf(total)}</p>
                      <div className="mt-1.5 space-y-0.5">
                        {realizedGain !== 0 && (
                          <p className="text-xs font-mono text-[#9E9A93]">
                            Clos/réduit : <span className={realizedGain >= 0 ? 'text-[#2B6B5A]' : 'text-red-400'}>{realizedGain >= 0 ? '+' : ''}{chf(realizedGain)}</span>
                          </p>
                        )}
                        {divCumul > 0 && (
                          <p className="text-xs font-mono text-[#9E9A93]">
                            Dividendes : <span className="text-[#2B6B5A]">+{chf(divCumul)}</span>
                            {divYield > 0 && <span className="text-[#9E9A93]"> · {divYield.toFixed(2)} % / an</span>}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })()}
                <div className="bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <p className="text-xs font-semibold text-[#5C6880] uppercase tracking-wider">Drawdown max</p>
                    <div className="relative group">
                      <span className="w-4 h-4 rounded-full bg-[#DDD9D1] dark:bg-[#2a3f52] text-[#5C6880] text-[10px] font-bold flex items-center justify-center cursor-default select-none">?</span>
                      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 z-50 hidden group-hover:block pointer-events-none">
                        <div className="bg-[#1B3050] dark:bg-[#0F1E2C] text-white text-xs rounded-xl p-3 shadow-xl space-y-2">
                          <p className="font-semibold text-white/90">Drawdown maximum historique</p>
                          <p className="text-white/70 leading-relaxed">Recul le plus important entre un pic de valeur et le creux suivant, calculé jour par jour depuis le premier achat.</p>
                          <div className="border-t border-white/20 pt-2">
                            <p className="text-white/60 text-[11px] leading-relaxed">⚠️ Cette valeur peut différer du graphique Drawdown : elle utilise toutes les données journalières, alors que le graphique peut être en vue &quot;Mois&quot; ou &quot;Sem&quot; et ne capturer qu&apos;une partie des creux intermédiaires.</p>
                          </div>
                          <div className="w-2 h-2 bg-[#1B3050] dark:bg-[#0F1E2C] rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {dailyMDDLoading ? (
                    <p className="text-sm text-[#9E9A93]">Calcul…</p>
                  ) : dailyMaxDrawdown ? (
                    <>
                      <p className="text-xl font-bold font-mono text-[#DC2626]">{dailyMaxDrawdown.pct.toFixed(2)} %</p>
                      <p className="text-sm font-mono text-[#9E9A93]">{dailyMaxDrawdown.peakDate.split('-').reverse().join('/')} → {dailyMaxDrawdown.date.split('-').reverse().join('/')}</p>
                    </>
                  ) : (
                    <p className="text-xl font-bold font-mono text-[#2B6B5A]">—</p>
                  )}
                </div>
              </div>

              <div className="lg:col-span-2 flex flex-col gap-4">
                <div className="bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-5 flex-1">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold">
                      {chartMode === 'evol' ? 'Évolution du portefeuille' : chartMode === 'pnl' ? 'PnL cumulé' : 'Drawdown'}
                    </h3>
                    <div className="flex items-center gap-2">
                      <div className="flex bg-[#F5F3EF] dark:bg-[#1B2D3E] rounded-lg p-0.5 gap-0.5 mr-1">
                        {(['all', 'weekly', '60d'] as const).map(r => (
                          <button key={r} onClick={() => setChartRange(r)}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${chartRange === r ? 'bg-white dark:bg-[#162534] text-[#1B3050] dark:text-white shadow-sm' : 'text-[#9E9A93] hover:text-[#5C6880]'}`}>
                            {r === 'all' ? 'Mois' : r === 'weekly' ? 'Sem' : '60j'}
                          </button>
                        ))}
                      </div>
                      <div className="flex bg-[#F5F3EF] dark:bg-[#1B2D3E] rounded-lg p-0.5 gap-0.5">
                        {(['evol', 'pnl', 'drawdown'] as const).map(m => (
                          <button key={m} onClick={() => setChartMode(m)}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${chartMode === m ? 'bg-white dark:bg-[#162534] text-[#1B3050] dark:text-white shadow-sm' : 'text-[#9E9A93] hover:text-[#5C6880]'}`}>
                            {m === 'evol' ? 'Évolution' : m === 'pnl' ? 'PnL' : 'Drawdown'}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => setChartBustKey(k => k + 1)} title="Rafraîchir les données historiques"
                        className="p-1.5 rounded-lg text-[#9E9A93] hover:text-[#5C6880] hover:bg-[#F5F3EF] dark:hover:bg-[#1B2D3E] transition-colors" aria-label="Rafraîchir">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
                      </button>
                    </div>
                  </div>
                  {chartMode === 'evol' && <EvolChart data={positionsCalc} showFX={true} range={chartRange} bustKey={chartBustKey} />}
                  {chartMode === 'pnl' && <PnLChart data={positionsCalc} tickerDivs={tickerDivs} range={chartRange} bustKey={chartBustKey} />}
                  {chartMode === 'drawdown' && <DrawdownChart data={positionsCalc} onMaxDrawdown={(pct, date) => setMaxDrawdown({ pct, date })} range={chartRange} bustKey={chartBustKey} />}
                  <p className="text-xs text-[#9E9A93] mt-2">
                    {chartMode === 'evol' ? (chartRange === '60d' ? 'Valeur journalière du portefeuille sur les 60 derniers jours.' : chartRange === 'weekly' ? 'Valeur hebdomadaire du portefeuille depuis le premier achat.' : 'Valeur mensuelle réelle du portefeuille depuis le premier achat.') : chartMode === 'pnl' ? (chartRange === '60d' ? 'Gain journalier cumulé (variation de prix + gains réalisés dont dividendes) sur les 60 derniers jours.' : chartRange === 'weekly' ? 'Gain hebdomadaire cumulé (variation de prix + gains réalisés dont dividendes) depuis le premier achat.' : 'Gain mensuel cumulé (variation de prix + gains réalisés dont dividendes) basé sur les prix historiques réels. Nominal = en CHF courant · Réel = ajusté inflation.') : (chartRange === '60d' ? 'Drawdown journalier sur les 60 derniers jours.' : chartRange === 'weekly' ? 'Drawdown hebdomadaire depuis le premier achat.' : 'Recul maximal par rapport au pic de valeur du portefeuille.')}
                  </p>
                </div>
                <div className="bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-5">
                  <div className="flex gap-6">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold mb-4">Allocation par catégorie</h3>
                      <AllocChart data={positionsCalc} />
                    </div>
                    <div className="w-px bg-[#DDD9D1] dark:bg-[#1e3347] self-stretch flex-shrink-0" />
                    <div className="w-56 flex-shrink-0 flex flex-col gap-3 justify-center">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-[#1B3050] dark:text-white">Profil d&apos;investisseur</h3>
                        <a href="/profil?tab=investisseur" className="flex items-center gap-1 text-xs font-medium text-[#2B6B5A] hover:underline">
                          <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M9 1L11 3L4 10H2V8L9 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
                          Modifier
                        </a>
                      </div>
                      {(() => {
                        let score = 0
                        score += profile.horizon >= 20 ? 4 : profile.horizon >= 10 ? 3 : profile.horizon >= 5 ? 2 : 1
                        score += profile.loss >= 40 ? 4 : profile.loss >= 25 ? 3 : profile.loss >= 15 ? 2 : 1
                        score += profile.liquidity === 'faible' ? 3 : profile.liquidity === 'moyenne' ? 2 : 1
                        score += profile.objective === 'agressif' ? 4 : profile.objective === 'croissance' ? 3 : profile.objective === 'modéré' ? 2 : 1
                        const pt = score <= 5 ? { label: 'Prudent', color: '#4A7EA5', desc: 'Capital preservation, faible risque.' }
                          : score <= 8  ? { label: 'Défensif',  color: '#4A8573', desc: 'Rendement régulier, volatilité limitée.' }
                          : score <= 11 ? { label: 'Équilibré', color: '#C4952A', desc: 'Équilibre croissance / sécurité.' }
                          : score <= 14 ? { label: 'Dynamique', color: '#B8722A', desc: 'Croissance prioritaire, tolérance modérée.' }
                          :               { label: 'Agressif',  color: '#A85050', desc: 'Maximisation du rendement long terme.' }
                        return (
                          <>
                            <div className="flex items-center gap-2">
                              <div>
                                <p className="font-semibold text-sm leading-tight" style={{ color: pt.color }}>{pt.label}</p>
                                <p className="text-xs text-[#5C6880] dark:text-[#7B8DA6] leading-tight">{pt.desc}</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                              <div className="bg-[#F5F3EF] dark:bg-[#1B2D3E] rounded-lg p-2.5">
                                <p className="text-[10px] text-[#9E9A93] mb-0.5">Horizon</p>
                                <p className="text-xs font-semibold text-[#1B3050] dark:text-white">{profile.horizon} ans</p>
                              </div>
                              <div className="bg-[#F5F3EF] dark:bg-[#1B2D3E] rounded-lg p-2.5">
                                <p className="text-[10px] text-[#9E9A93] mb-0.5">Tolérance perte</p>
                                <p className="text-xs font-semibold text-[#1B3050] dark:text-white">-{profile.loss} %</p>
                              </div>
                              <div className="bg-[#F5F3EF] dark:bg-[#1B2D3E] rounded-lg p-2.5">
                                <p className="text-[10px] text-[#9E9A93] mb-0.5">Besoin de liquidité</p>
                                <p className="text-xs font-semibold text-[#1B3050] dark:text-white">{profile.liquidity === 'haute' ? '1–3 ans' : profile.liquidity === 'moyenne' ? '3–7 ans' : '7+ ans'}</p>
                              </div>
                              <div className="bg-[#F5F3EF] dark:bg-[#1B2D3E] rounded-lg p-2.5">
                                <p className="text-[10px] text-[#9E9A93] mb-0.5">Objectif</p>
                                <p className="text-xs font-semibold text-[#1B3050] dark:text-white">{profile.objective === 'inflation' ? '~2–3 %/an' : profile.objective === 'modéré' ? '~5–7 %/an' : profile.objective === 'croissance' ? '~8–10 %/an' : '~10–15 %/an'}</p>
                              </div>
                            </div>
                          </>
                        )
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>


            <div className="flex gap-1 mb-4 bg-white dark:bg-[#162534] p-1 rounded-lg border border-[#DDD9D1] dark:border-[#1e3347] w-fit">
              {(['positions', 'analyse', 'cloturees'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-[#2B6B5A] text-white' : 'text-[#5C6880] hover:text-[#1B3050] dark:hover:text-white'}`}>
                  {tab === 'positions' ? 'Positions' : tab === 'analyse' ? 'Analyse FX & Inflation' : 'Positions clôturées'}
                </button>
              ))}
            </div>

            {activeTab === 'positions' && (
              <div className="bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#DDD9D1] dark:border-[#1e3347]">
                        {['Position', 'Qté', 'Prix actuel', 'Valeur CHF', 'Gain CHF', 'Perf.', 'MAJ', 'Actions'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#5C6880] uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F5F3EF] dark:divide-[#1e3347]">
                      {groupOrder.map(ticker => {
                        const group = groupedPositions[ticker]
                        const isMulti = group.length > 1
                        const isExpanded = expandedTickers.has(ticker)
                        const first = group[0]
                        // Quantité nette restante (ex: 1000 − 200 = 800)
                        const gQteNet = group.reduce((s, p) => s + p.quantite, 0)
                        // Valeur au prix actuel sur la quantité restante uniquement
                        const gVal  = gQteNet * first.prixActuel * first.tauxActuelCHF
                        // Coût net = coût longs − coût des ventes (pour éviter le double-comptage)
                        const gCout = group.reduce((s, p) => s + (p.quantite > 0 ? p.coutCHF : -p.coutCHF), 0)
                        // Gain = (valeur restante − coût net) + gains réalisés des ventes
                        const gRealizedGains = group.filter(p => p.quantite < 0 && p.prixVente != null).reduce((s, p) => s + p.gainCHF, 0)
                        const gGain = gVal - gCout
                        const gPerf = gCout > 0 ? (gGain / gCout) * 100 : 0
                        const gQte  = gQteNet
                        const gMaj  = group.reduce((m, p) => p.derniereMaj && (!m || p.derniereMaj > m) ? p.derniereMaj : m, '')
                        const toggle = () => setExpandedTickers(s => { const n = new Set(s); n.has(ticker) ? n.delete(ticker) : n.add(ticker); return n })
                        return (
                          <React.Fragment key={ticker}>
                            <tr className={`hover:bg-[#F5F3EF]/50 dark:hover:bg-[#1B2D3E]/50 transition-colors ${isExpanded ? 'bg-[#F5F3EF]/30 dark:bg-[#1B2D3E]/30' : ''}`}>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5">
                                  {isMulti && (
                                    <button onClick={toggle} className="text-[#5C6880] hover:text-[#1B3050] dark:hover:text-white text-xs flex-shrink-0 w-4">
                                      {isExpanded ? '▾' : '▸'}
                                    </button>
                                  )}
                                  <div>
                                    <div className="font-medium">{first.nom}</div>
                                    <div className="text-xs text-[#9E9A93]">{first.ticker} · {first.categorie}{isMulti ? ` · ${group.length} lots` : ''}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 font-mono text-xs">{gQte}</td>
                              <td className="px-4 py-3 font-mono text-xs">
                                <div>{first.prixActuel.toLocaleString('fr-CH', { maximumFractionDigits: 2 })} {first.devise}</div>
                                {first.devise !== 'CHF' && <div className="text-[#9E9A93]">×{first.tauxActuelCHF.toFixed(4)}</div>}
                              </td>
                              <td className="px-4 py-3 font-mono">
                                <div>{chf(gVal)}</div>
                                <div className="text-xs text-[#9E9A93]">Coût: {chf(gCout)}</div>
                              </td>
                              <td className={`px-4 py-3 font-mono ${clr(gGain)}`}>{gGain >= 0 ? '+' : ''}{chf(gGain)}</td>
                              <td className={`px-4 py-3 font-mono font-semibold ${clr(gPerf)}`}>
                                <div>{pct(gPerf)}</div>
                                {(() => {
                                  const ttmEntry = tickerDivs[ticker.toUpperCase()]
                                  const divYield = ttmEntry && first.prixActuel > 0 ? (ttmEntry.dividendTTM / first.prixActuel) * 100 : null
                                  return divYield !== null ? <div className="text-xs text-[#2B6B5A] font-normal">{divYield.toFixed(2)} % div.</div> : null
                                })()}
                              </td>
                              <td className="px-4 py-3 text-xs text-[#9E9A93]">
                                {gMaj ? new Date(gMaj).toLocaleString('fr-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex gap-2">
                                  <button onClick={() => openEdit(first)} className="text-xs text-[#2B6B5A] hover:underline">Modifier</button>
                                  <button onClick={() => openDeleteModal(first)} className="text-xs text-red-400 hover:underline">Supprimer</button>
                                </div>
                              </td>
                            </tr>
                            {isMulti && isExpanded && (() => {
                              const _fifo: Map<string, number> = new Map()
                              const _longs = [...group].filter(q => q.quantite > 0).sort((a,b) => new Date(a.dateAchat).getTime()-new Date(b.dateAchat).getTime())
                              let _sold = group.filter(q => q.quantite < 0 && q.prixVente != null).reduce((s,q)=>s+Math.abs(q.quantite),0)
                              for (const _l of _longs){const _r=Math.min(_l.quantite,_sold);_fifo.set(_l.id,_l.quantite-_r);_sold=Math.max(0,_sold-_r)}
                              return group.filter(p => p.quantite > 0 && (_fifo.get(p.id) ?? p.quantite) > 0).map(p => {
                                const _dQty    = p.quantite > 0 ? (_fifo.get(p.id) ?? p.quantite) : p.quantite
                                const _dVal    = p.quantite > 0 ? _dQty * p.prixActuel * p.tauxActuelCHF : p.valeurCHF
                                const _dCout   = p.quantite > 0 ? _dQty * p.prixAchat * p.tauxAchatCHF : p.coutCHF
                                const _dGain   = _dVal - _dCout
                                const _dGainPct = _dCout > 0 ? (_dGain / _dCout) * 100 : 0
                                return (
                              <tr key={p.id} className="bg-[#F5F3EF]/60 dark:bg-[#1B2D3E]/60 text-[#5C6880] dark:text-[#7B8DA6]">
                                <td className="px-4 py-2 pl-9">
                                  <div className="text-xs font-medium flex items-center gap-1.5">
                                    {p.quantite < 0 ? '⇘ Vente du' : 'Lot du'} {fmtDate(p.dateAchat)}
                                  </div>
                                  <div className="text-xs text-[#9E9A93]">
                                    {p.quantite < 0
                                      ? p.prixVente
                                        ? <>Achat : {p.prixAchat.toLocaleString('fr-CH', { maximumFractionDigits: 2 })} → vente : {p.prixVente.toLocaleString('fr-CH', { maximumFractionDigits: 2 })} {p.devise}</>
                                        : <>Px achat : {p.prixAchat.toLocaleString('fr-CH', { maximumFractionDigits: 2 })} {p.devise}</>
                                      : <>Px achat : {p.prixAchat.toLocaleString('fr-CH', { maximumFractionDigits: 2 })} {p.devise}</>
                                    }
                                  </div>
                                </td>
                                <td className={`px-4 py-2 font-mono text-xs ${p.quantite < 0 ? 'text-red-400' : ''}`}>{_dQty}</td>
                                <td className="px-4 py-2 text-xs text-[#9E9A93]">—</td>
                                <td className="px-4 py-2 font-mono text-xs">
                                  <div>
                                    <div>{chf(_dVal)}</div>
                                    <div className="text-[#9E9A93] text-[10px]">coût : {chf(_dCout)}</div>
                                  </div>
                                </td>
                                <td className={`px-4 py-2 font-mono text-xs ${clr(_dGain)}`}>
                                  {(_dGain >= 0 ? '+' : '') + chf(_dGain)}
                                  {p.quantite < 0 && <div className="text-[#9E9A93] text-[10px]">réalisé</div>}
                                </td>
                                <td className={`px-4 py-2 font-mono text-xs font-semibold ${clr(_dGainPct)}`}>
                                  {pct(_dGainPct)}
                                </td>
                                <td className="px-4 py-2 text-xs text-[#9E9A93]">—</td>
                                <td className="px-4 py-2">
                                  <div className="flex gap-2">
                                    <button onClick={() => openDeleteModal(p)} className="text-xs text-red-400 hover:underline">Supprimer</button>
                                  </div>
                                </td>
                              </tr>
                                )
                              })
                            })()
                            }
                          </React.Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'analyse' && (
              <div className="bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] overflow-hidden">
                <div className="px-5 py-3 border-b border-[#F5F3EF] dark:border-[#1e3347] flex gap-6 text-xs text-[#9E9A93]">
                  <span><strong className="text-[#1B3050] dark:text-[#E8E4DC]">CHF nominal</strong> — gain total en CHF</span>
                  <span><strong className="text-[#2B6B5A]">FX uniquement</strong> — part due au change</span>
                  <span><strong className="text-[#B5820F]">Réel</strong> — après inflation suisse (IPC OFS)</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#DDD9D1] dark:border-[#1e3347]">
                        {['Position', 'Perf. devise', 'Perf. CHF', 'Impact FX', 'Perf. réelle', 'Dividendes / an'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#5C6880] uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F5F3EF] dark:divide-[#1e3347]">
                      {groupOrder.map(ticker => {
                        const group = groupedPositions[ticker]
                        const isMulti = group.length > 1
                        const isExpanded = expandedTickers.has(ticker)
                        const first = group[0]
                        const toggle = () => setExpandedTickers(s => { const n = new Set(s); n.has(ticker) ? n.delete(ticker) : n.add(ticker); return n })
                        // Métriques basées sur positions ouvertes uniquement (FIFO net)
                        const longsA      = group.filter(p => p.quantite > 0)
                        // FIFO : calculer les quantités résiduelles par lot
                        const _fifoA: Map<string, number> = new Map()
                        const _longsSort = [...longsA].sort((a,b) => new Date(a.dateAchat).getTime()-new Date(b.dateAchat).getTime())
                        let _soldA = group.filter(q => q.quantite < 0 && q.prixVente != null).reduce((s,q)=>s+Math.abs(q.quantite),0)
                        for (const _l of _longsSort){const _r=Math.min(_l.quantite,_soldA);_fifoA.set(_l.id,_l.quantite-_r);_soldA=Math.max(0,_soldA-_r)}
                        const longsAActive = longsA.filter(p => (_fifoA.get(p.id) ?? p.quantite) > 0)
                        // Référence de prix = lot le plus récemment rafraîchi (même actif = même prix courant)
                        const priceRef    = longsA.reduce(
                          (best, p) => ((p.derniereMaj ?? '') >= (best.derniereMaj ?? '') ? p : best),
                          longsA[0] ?? first
                        )
                        // Quantité nette restante et valeur au prix actuel
                        const gQteNetA    = group.reduce((s, p) => s + p.quantite, 0)
                        const gVal        = gQteNetA * priceRef.prixActuel * priceRef.tauxActuelCHF
                        // Coût net en CHF (longs − réductions)
                        const gCout       = group.reduce((s, p) => s + (p.quantite > 0 ? p.coutCHF : -p.coutCHF), 0)
                        const gGainCHF    = gVal - gCout
                        // Gain en devise et FX sur la position nette ouverte uniquement
                        // Coût en devise basé sur les quantités FIFO restantes (évite le double-comptage des lots de réduction)
                        const gCoutDevise = longsAActive.reduce((s, p) => s + (_fifoA.get(p.id) ?? p.quantite) * p.prixAchat, 0)
                        const gGainDevise = gQteNetA * priceRef.prixActuel - gCoutDevise
                        // Impact FX : taux moyen pondéré à l'achat = gCout / gCoutDevise
                        const gWgtBuyRate = first.devise !== 'CHF' && gCoutDevise > 0 ? gCout / gCoutDevise : first.tauxAchatCHF
                        const gImpactFX   = first.devise === 'CHF' ? 0 : gQteNetA * priceRef.prixActuel * (priceRef.tauxActuelCHF - gWgtBuyRate)
                        // Gain réel = gain CHF − inflation sur coût net (depuis premier achat)
                        const gGainReel   = gGainCHF - gCout * inflationCumulee(first.dateAchat)
                        const gPerfCHF    = gCout > 0 ? (gGainCHF / gCout) * 100 : 0
                        const gPerfDevise = gCoutDevise > 0 ? (gGainDevise / gCoutDevise) * 100 : 0
                        const gPerfReel   = gCout > 0 ? (gGainReel / gCout) * 100 : 0
                        const tickerEntry = tickerDivs[ticker]
                        // Dividendes sur quantité nette ouverte uniquement
                        const gDivCHF = tickerEntry ? gQteNetA * tickerEntry.dividendTTM * priceRef.tauxActuelCHF : 0
                        const gDivYld = gVal > 0 && gDivCHF > 0 ? (gDivCHF / gVal) * 100 : 0
                        return (
                          <React.Fragment key={ticker}>
                            <tr className={`hover:bg-[#F5F3EF]/50 dark:hover:bg-[#1B2D3E]/50 transition-colors ${isExpanded ? 'bg-[#F5F3EF]/30 dark:bg-[#1B2D3E]/30' : ''}`}>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5">
                                  {longsAActive.length > 1 && (
                                    <button onClick={toggle} className="text-[#5C6880] hover:text-[#1B3050] dark:hover:text-white text-xs flex-shrink-0 w-4">
                                      {isExpanded ? '▾' : '▸'}
                                    </button>
                                  )}
                                  <div>
                                    <div className="font-medium">{first.nom}</div>
                                    <div className="text-xs text-[#9E9A93]">{first.ticker}{longsAActive.length > 1 ? ` · ${longsAActive.length} lots` : ` · ${fmtDate(first.dateAchat)}`}</div>
                                  </div>
                                </div>
                              </td>
                              <td className={`px-4 py-3 font-mono ${clr(gPerfDevise)}`}>
                                <div>{pct(gPerfDevise)}</div>
                                <div className="text-xs text-[#9E9A93]">{gGainDevise >= 0 ? '+' : ''}{gGainDevise.toFixed(2)} {first.devise}</div>
                              </td>
                              <td className={`px-4 py-3 font-mono ${clr(gPerfCHF)}`}>
                                <div>{pct(gPerfCHF)}</div>
                                <div className="text-xs text-[#9E9A93]">{gGainCHF >= 0 ? '+' : ''}{chf(gGainCHF)}</div>
                              </td>
                              <td className={`px-4 py-3 font-mono ${clr(gImpactFX)}`}>
                                {first.devise === 'CHF' ? <span className="text-[#9E9A93]">—</span> : <>{gImpactFX >= 0 ? '+' : ''}{chf(gImpactFX)}</>}
                              </td>
                              <td className={`px-4 py-3 font-mono font-semibold ${clr(gPerfReel)}`}>
                                <div>{pct(gPerfReel)}</div>
                                <div className="text-xs text-[#9E9A93]">{gGainReel >= 0 ? '+' : ''}{chf(gGainReel)}</div>
                              </td>
                              <td className="px-4 py-3 font-mono">
                                {gDivCHF > 0 ? (
                                  <>
                                    <div className="text-[#2B6B5A] font-semibold">+{chf(gDivCHF)}</div>
                                    <div className="text-xs text-[#9E9A93]">{gDivYld.toFixed(2)} %</div>
                                  </>
                                ) : <span className="text-[#9E9A93]">—</span>}
                              </td>
                            </tr>
                            {longsAActive.length > 1 && isExpanded && longsAActive.map(p => {
                              // Quantité FIFO résiduelle pour ce lot (peut être < p.quantite si une partie a été vendue)
                              const qFifo = _fifoA.get(p.id) ?? p.quantite
                              // Ratio pour mettre à l'échelle les montants absolus (les % restent identiques)
                              const scale = p.quantite > 0 ? qFifo / p.quantite : 1
                              const pGainDevise = p.gainDevise * scale
                              const pGainCHF    = p.gainCHF    * scale
                              const pImpactFX   = p.impactFX   * scale
                              const pGainReel   = p.gainReel   * scale
                              const pValCHF     = p.valeurCHF  * scale
                              const pDivCHF = tickerEntry ? qFifo * tickerEntry.dividendTTM * p.tauxActuelCHF : 0
                              const pDivYld = pValCHF > 0 && pDivCHF > 0 ? (pDivCHF / pValCHF) * 100 : 0
                              return (
                                <tr key={p.id} className="bg-[#F5F3EF]/60 dark:bg-[#1B2D3E]/60 text-[#5C6880] dark:text-[#7B8DA6]">
                                  <td className="px-4 py-2 pl-9">
                                    <div className="text-xs font-medium">Lot du {fmtDate(p.dateAchat)}</div>
                                    <div className="text-xs text-[#9E9A93]">Px achat : {p.prixAchat.toLocaleString('fr-CH', { maximumFractionDigits: 2 })} {p.devise}</div>
                                  </td>
                                  <td className={`px-4 py-2 font-mono text-xs ${clr(p.gainPctDevise)}`}>
                                    <div>{pct(p.gainPctDevise)}</div>
                                    <div className="text-xs text-[#9E9A93]">{pGainDevise >= 0 ? '+' : ''}{pGainDevise.toFixed(2)} {p.devise}</div>
                                  </td>
                                  <td className={`px-4 py-2 font-mono text-xs ${clr(p.gainPctCHF)}`}>
                                    <div>{pct(p.gainPctCHF)}</div>
                                    <div className="text-xs text-[#9E9A93]">{pGainCHF >= 0 ? '+' : ''}{chf(pGainCHF)}</div>
                                  </td>
                                  <td className={`px-4 py-2 font-mono text-xs ${clr(pImpactFX)}`}>
                                    {p.devise === 'CHF' ? <span className="text-[#9E9A93]">—</span> : <>{pImpactFX >= 0 ? '+' : ''}{chf(pImpactFX)}</>}
                                  </td>
                                  <td className={`px-4 py-2 font-mono text-xs font-semibold ${clr(p.gainPctReel)}`}>
                                    <div>{pct(p.gainPctReel)}</div>
                                    <div className="text-xs text-[#9E9A93]">{pGainReel >= 0 ? '+' : ''}{chf(pGainReel)}</div>
                                  </td>
                                  <td className="px-4 py-2 font-mono text-xs">
                                    {pDivCHF > 0 ? (
                                      <>
                                        <div className="text-[#2B6B5A]">+{chf(pDivCHF)}</div>
                                        <div className="text-xs text-[#9E9A93]">{pDivYld.toFixed(2)} %</div>
                                      </>
                                    ) : <span className="text-[#9E9A93]">—</span>}
                                  </td>
                                </tr>
                              )
                            })}
                          </React.Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {activeTab === 'cloturees' && (
              <div className="bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] overflow-hidden">
                <div className="px-5 py-3 border-b border-[#F5F3EF] dark:border-[#1e3347]">
                  <p className="text-xs text-[#9E9A93]">
                    Gains et pertes <strong className="text-[#1B3050] dark:text-[#E8E4DC]">réalisés</strong> lors des réductions ou clôtures de positions — calculés au prix effectif de vente.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#DDD9D1] dark:border-[#1e3347]">
                        {['Position', 'Date opération', 'Qté vendue', 'Px achat', 'Taux achat', 'Px vente', 'Taux vente', 'Gain CHF', 'Perf.', ''].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#5C6880] uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F5F3EF] dark:divide-[#1e3347]">
                      {(() => {
                        // ── FIFO split display for cloturées ──────────────────────────────
                        // Build mutable remaining-qty map for long lots, per ticker
                        type LongWithRem = (typeof positions)[0] & { _remaining: number }
                        const longsByTicker = new Map<string, LongWithRem[]>()
                        positions
                          .filter(p => p.quantite > 0 && !p.dateVente)
                          .sort((a, b) => a.dateAchat.localeCompare(b.dateAchat))
                          .forEach(p => {
                            if (!longsByTicker.has(p.ticker)) longsByTicker.set(p.ticker, [])
                            longsByTicker.get(p.ticker)!.push({ ...p, _remaining: p.quantite })
                          })

                        type SplitRow = {
                          key: string
                          sale: (typeof positions)[0]
                          longLot: LongWithRem | null
                          splitQty: number
                          dateDebut: string | null
                          dateOp: string
                        }
                        const splitRows: SplitRow[] = []

                        // Process delta (sale) lots in chronological order → FIFO split
                        const sortedSales = positions
                          .filter(p => p.quantite < 0 && p.prixVente !== undefined)
                          .sort((a, b) => a.dateAchat.localeCompare(b.dateAchat))

                        for (const sale of sortedSales) {
                          let rem = Math.abs(sale.quantite)
                          const longs = longsByTicker.get(sale.ticker) ?? []
                          for (const ll of longs) {
                            if (rem <= 0) break
                            if (ll._remaining <= 0) continue
                            const consumed = Math.min(ll._remaining, rem)
                            splitRows.push({ key: `${sale.id}-${ll.id}`, sale, longLot: ll, splitQty: consumed, dateDebut: ll.dateAchat, dateOp: sale.dateAchat })
                            ll._remaining -= consumed
                            rem -= consumed
                          }
                          if (rem > 0) {
                            // orphan: no long lot found (data inconsistency)
                            splitRows.push({ key: `${sale.id}-orphan`, sale, longLot: null, splitQty: rem, dateDebut: null, dateOp: sale.dateAchat })
                          }
                        }

                        // Classic closed rows (dateVente + quantite > 0)
                        const closedRows = positions
                          .filter(p => p.dateVente && p.quantite > 0)
                          .sort((a, b) => (b.dateVente ?? '').localeCompare(a.dateVente ?? ''))

                        // Check if anything to show
                        if (splitRows.length === 0 && closedRows.length === 0) {
                          return (
                            <tr>
                              <td colSpan={10} className="px-4 py-10 text-center text-sm text-[#9E9A93]">
                                Aucune position clôturée ou réduite pour l&apos;instant.
                              </td>
                            </tr>
                          )
                        }

                        // Render FIFO split rows (delta sales)
                        const splitElements = splitRows
                          .sort((a, b) => b.dateOp.localeCompare(a.dateOp))
                          .map(({ key, sale, longLot, splitQty, dateDebut, dateOp }) => {
                            const pxAchat = longLot?.prixAchat ?? sale.prixAchat
                            const txAchat = longLot?.tauxAchatCHF ?? sale.tauxAchatCHF
                            const pxVente = sale.prixVente ?? 0
                            const txVente = sale.tauxVenteCHF ?? 1
                            const coutCHF = splitQty * pxAchat * txAchat
                            const venteCHF = splitQty * pxVente * txVente
                            const gainCHF = venteCHF - coutCHF
                            const gainPct = coutCHF > 0 ? (gainCHF / coutCHF) * 100 : 0
                            return (
                              <tr key={key} className="hover:bg-[#F9F8F5] dark:hover:bg-[#1e3347]/40 transition-colors">
                                <td className="px-4 py-3">
                                  <div className="font-medium text-[#1B3050] dark:text-[#E8E4DC] text-sm">{sale.ticker}</div>
                                  <div className="text-xs text-[#9E9A93]">{sale.nom}</div>
                                  <div className="text-xs text-[#9E9A93] mt-0.5">⇘ Réduction</div>
                                </td>
                                <td className="px-4 py-3 font-mono text-xs text-[#5C6880]">
                                  <div>{fmtDate(dateOp)}</div>
                                  {dateDebut && <div className="text-[#9E9A93] text-[10px] mt-0.5">depuis {fmtDate(dateDebut)}</div>}
                                </td>
                                <td className="px-4 py-3 font-mono text-xs">{splitQty.toLocaleString('fr-CH', { maximumFractionDigits: 4 })}</td>
                                <td className="px-4 py-3 font-mono text-xs text-[#9E9A93]">
                                  <div>{pxAchat.toLocaleString('fr-CH', { maximumFractionDigits: 2 })} {sale.devise}</div>
                                </td>
                                <td className="px-4 py-3 font-mono text-xs text-[#9E9A93]">
                                  {sale.devise === 'CHF'
                                    ? <span className="text-[#9E9A93]">—</span>
                                    : <div>
                                        <div>{txAchat.toFixed(4)}</div>
                                        <div className="text-[#9E9A93] text-[10px]">{sale.devise}/CHF</div>
                                      </div>}
                                </td>
                                <td className="px-4 py-3 font-mono text-xs text-[#5C6880]">
                                  {pxVente > 0
                                    ? <div>{pxVente.toLocaleString('fr-CH', { maximumFractionDigits: 2 })} {sale.devise}</div>
                                    : <span className="text-[#9E9A93]">—</span>}
                                </td>
                                <td className="px-4 py-3 font-mono text-xs text-[#5C6880]">
                                  {sale.devise === 'CHF'
                                    ? <span className="text-[#9E9A93]">—</span>
                                    : txVente > 0
                                      ? <div>
                                          <div>{txVente.toFixed(4)}</div>
                                          <div className="text-[#9E9A93] text-[10px]">{sale.devise}/CHF</div>
                                        </div>
                                      : <span className="text-[#9E9A93]">—</span>}
                                </td>
                                <td className={`px-4 py-3 font-mono text-xs font-semibold ${gainCHF >= 0 ? 'text-[#2B6B5A]' : 'text-red-500'}`}>
                                  {(gainCHF >= 0 ? '+' : '') + chf(gainCHF)}
                                </td>
                                <td className={`px-4 py-3 font-mono text-xs font-semibold ${gainPct >= 0 ? 'text-[#2B6B5A]' : 'text-red-500'}`}>
                                  {pct(gainPct)}
                                </td>
                                <td className="px-4 py-3">
                                  <button
                                    onClick={async () => {
                                      setPositions(ps => ps.filter(x => x.id !== sale.id))
                                      if (userId) {
                                        const supabase = createClient()
                                        await supabase.from('portfolio_positions').delete().eq('id', sale.id).eq('user_id', userId)
                                      }
                                    }}
                                    className="text-xs text-red-400 hover:text-red-600 hover:underline transition-colors"
                                  >
                                    Annuler
                                  </button>
                                </td>
                              </tr>
                            )
                          })

                        // Render classic closed rows (quantite > 0, dateVente set)
                        const closedElements = closedRows.map(p => {
                          const pxVente = p.prixVente ?? p.prixActuel
                          const txVente = p.tauxVenteCHF ?? p.tauxActuelCHF
                          const coutCHF = p.quantite * p.prixAchat * p.tauxAchatCHF
                          const venteCHF = p.quantite * pxVente * txVente
                          const gainCHF = venteCHF - coutCHF
                          const gainPct = coutCHF > 0 ? (gainCHF / coutCHF) * 100 : 0
                          return (
                            <tr key={p.id} className="hover:bg-[#F9F8F5] dark:hover:bg-[#1e3347]/40 transition-colors">
                              <td className="px-4 py-3">
                                <div className="font-medium text-[#1B3050] dark:text-[#E8E4DC] text-sm">{p.ticker}</div>
                                <div className="text-xs text-[#9E9A93]">{p.nom}</div>
                                <div className="text-xs text-[#9E9A93] mt-0.5">✓ Clôture</div>
                              </td>
                              <td className="px-4 py-3 font-mono text-xs text-[#5C6880]">
                                <div>{fmtDate(p.dateVente ?? '—')}</div>
                                <div className="text-[#9E9A93] text-[10px] mt-0.5">depuis {fmtDate(p.dateAchat)}</div>
                              </td>
                              <td className="px-4 py-3 font-mono text-xs">{p.quantite.toLocaleString('fr-CH', { maximumFractionDigits: 4 })}</td>
                              <td className="px-4 py-3 font-mono text-xs text-[#9E9A93]">
                                <div>{p.prixAchat.toLocaleString('fr-CH', { maximumFractionDigits: 2 })} {p.devise}</div>
                              </td>
                              <td className="px-4 py-3 font-mono text-xs text-[#9E9A93]">
                                {p.devise === 'CHF'
                                  ? <span className="text-[#9E9A93]">—</span>
                                  : <div>
                                      <div>{p.tauxAchatCHF.toFixed(4)}</div>
                                      <div className="text-[#9E9A93] text-[10px]">{p.devise}/CHF</div>
                                    </div>}
                              </td>
                              <td className="px-4 py-3 font-mono text-xs text-[#5C6880]">
                                {pxVente > 0
                                  ? <div>{pxVente.toLocaleString('fr-CH', { maximumFractionDigits: 2 })} {p.devise}</div>
                                  : <span className="text-[#9E9A93]">—</span>}
                              </td>
                              <td className="px-4 py-3 font-mono text-xs text-[#5C6880]">
                                {p.devise === 'CHF'
                                  ? <span className="text-[#9E9A93]">—</span>
                                  : txVente > 0
                                    ? <div>
                                        <div>{txVente.toFixed(4)}</div>
                                        <div className="text-[#9E9A93] text-[10px]">{p.devise}/CHF</div>
                                      </div>
                                    : <span className="text-[#9E9A93]">—</span>}
                              </td>
                              <td className={`px-4 py-3 font-mono text-xs font-semibold ${gainCHF >= 0 ? 'text-[#2B6B5A]' : 'text-red-500'}`}>
                                {(gainCHF >= 0 ? '+' : '') + chf(gainCHF)}
                              </td>
                              <td className={`px-4 py-3 font-mono text-xs font-semibold ${gainPct >= 0 ? 'text-[#2B6B5A]' : 'text-red-500'}`}>
                                {pct(gainPct)}
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={async () => {
                                    setPositions(ps => ps.filter(x => x.id !== p.id))
                                    if (userId) {
                                      const supabase = createClient()
                                      await supabase.from('portfolio_positions').delete().eq('id', p.id).eq('user_id', userId)
                                    }
                                  }}
                                  className="text-xs text-red-400 hover:text-red-600 hover:underline transition-colors"
                                >
                                  Annuler
                                </button>
                              </td>
                            </tr>
                          )
                        })

                        return [...splitElements, ...closedElements]
                      })()}
                    </tbody>
                    <tfoot>
                      {(() => {
                        const deltaRows = positions.filter(p => p.quantite < 0 && p.prixVente !== undefined)
                        const closedRows = positions.filter(p => p.dateVente && p.quantite > 0)
                        const allRows = [...deltaRows, ...closedRows]
                        if (allRows.length === 0) return null
                        const totalGain = allRows.reduce((s, p) => {
                          const isDelta = p.quantite < 0
                          const qteVendue = Math.abs(p.quantite)
                          const pxVente = isDelta ? (p.prixVente ?? 0) : (p.prixVente ?? p.prixActuel)
                          const txVente = isDelta ? (p.tauxVenteCHF ?? 1) : (p.tauxVenteCHF ?? p.tauxActuelCHF)
                          const coutCHF = qteVendue * p.prixAchat * p.tauxAchatCHF
                          const venteCHF = qteVendue * pxVente * txVente
                          return s + (venteCHF - coutCHF)
                        }, 0)
                        return (
                          <tr className="border-t-2 border-[#DDD9D1] dark:border-[#2a3f52] bg-[#F9F8F5] dark:bg-[#1a2d3d]">
                            <td colSpan={8} className="px-4 py-3 text-xs font-semibold text-[#5C6880] uppercase tracking-wider">
                              Total réalisé
                            </td>
                            <td colSpan={2} className={`px-4 py-3 font-mono text-sm font-bold ${totalGain >= 0 ? 'text-[#2B6B5A]' : 'text-red-500'}`}>
                              {(totalGain >= 0 ? '+' : '') + chf(totalGain)}
                            </td>
                          </tr>
                        )
                      })()}
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            <InvestorProfileSection data={positionsCalc} profile={profile} />
          </>
        )}
      </div>

      {/* Modale de suppression */}
      {showDeleteModal && deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#DDD9D1] dark:border-[#1e3347]">
              <h2 className="font-semibold text-[#1B3050] dark:text-[#E8E4DC]">Supprimer la position</h2>
              <button onClick={() => setShowDeleteModal(false)} className="text-[#9E9A93] hover:text-[#1B3050] dark:hover:text-white text-xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-[#5C6880] dark:text-[#A8B8C8]">
                <span className="font-medium text-[#1B3050] dark:text-[#E8E4DC]">{deleteTarget.nom || deleteTarget.ticker}</span>
                {' '}— comment souhaitez-vous supprimer cette position ?
              </p>

              <div className="space-y-3">
                <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${deleteMode === 'permanent' ? 'border-[#2B6B5A] bg-[#2B6B5A]/5' : 'border-[#DDD9D1] dark:border-[#2a3f52] hover:border-[#2B6B5A]/50'}`}>
                  <input type="radio" name="deleteMode" value="permanent" checked={deleteMode === 'permanent'}
                    onChange={() => setDeleteMode('permanent')} className="mt-0.5 accent-[#2B6B5A]" />
                  <div>
                    <p className="text-sm font-medium text-[#1B3050] dark:text-[#E8E4DC]">Supprimer définitivement</p>
                    <p className="text-xs text-[#9E9A93] mt-0.5">La position est supprimée de toutes les données.</p>
                  </div>
                </label>

                <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${deleteMode === 'close' ? 'border-[#2B6B5A] bg-[#2B6B5A]/5' : 'border-[#DDD9D1] dark:border-[#2a3f52] hover:border-[#2B6B5A]/50'}`}>
                  <input type="radio" name="deleteMode" value="close" checked={deleteMode === 'close'}
                    onChange={() => setDeleteMode('close')} className="mt-0.5 accent-[#2B6B5A]" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#1B3050] dark:text-[#E8E4DC]">Clôturer à une date</p>
                    <p className="text-xs text-[#9E9A93] mt-0.5">La position reste dans l'historique mais disparaît du portefeuille actuel à partir de la date choisie.</p>
                    {deleteMode === 'close' && (
                      <div className="mt-2 space-y-2">
                        <input
                          className={`w-full bg-white dark:bg-[#1B2D3E] border border-[#DDD9D1] dark:border-[#2a3f52] rounded-lg px-3 py-2 text-sm text-[#1B3050] dark:text-[#E8E4DC] focus:outline-none focus:ring-2 focus:ring-[#2B6B5A]`}
                          type="date"
                          value={deleteCloseDate}
                          onChange={e => { setDeleteCloseDate(e.target.value); setDeleteHistoPrice(null) }}
                        />
                        {deleteCloseDate && deleteHistoLoading && (
                          <p className="text-xs text-[#9E9A93] animate-pulse">Récupération du prix historique…</p>
                        )}
                        {deleteCloseDate && !deleteHistoLoading && deleteHistoPrice && (
                          <p className="text-xs text-[#2B6B5A]">
                            Prix au {deleteCloseDate} : <strong>{deleteHistoPrice.price.toLocaleString('fr-CH', { maximumFractionDigits: 2 })} {deleteTarget?.devise}</strong>
                            {deleteTarget?.devise !== 'CHF' && <> · Taux CHF : <strong>{deleteHistoPrice.fxRate.toFixed(4)}</strong></>}
                          </p>
                        )}
                        {deleteCloseDate && !deleteHistoLoading && !deleteHistoPrice && (
                          <p className="text-xs text-[#9E9A93]">Prix historique non disponible — prix actuel utilisé.</p>
                        )}
                      </div>
                    )}
                  </div>
                </label>
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowDeleteModal(false)}
                  className="flex-1 border border-[#DDD9D1] dark:border-[#2a3f52] text-[#5C6880] text-sm py-2 rounded-lg hover:bg-[#F5F3EF] dark:hover:bg-[#1B2D3E] transition-colors">
                  Annuler
                </button>
                <button onClick={confirmDelete}
                  disabled={deleteMode === 'close' && !deleteCloseDate}
                  className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white text-sm py-2 rounded-lg transition-colors font-medium">
                  {deleteMode === 'permanent' ? 'Supprimer' : 'Clôturer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#DDD9D1] dark:border-[#1e3347]">
              <h2 className="font-semibold">{editId ? 'Modifier la position' : 'Ajouter une position'}</h2>
              <div className="flex items-center gap-2">
                <div className="relative group">
                  <button type="button" className="w-5 h-5 rounded-full border border-[#9E9A93] text-[#9E9A93] hover:border-[#1B3050] hover:text-[#1B3050] dark:hover:border-[#A8D8C8] dark:hover:text-[#A8D8C8] text-xs flex items-center justify-center transition-colors leading-none">?</button>
                  <div className="absolute right-0 top-7 w-72 bg-white dark:bg-[#1B2D3E] border border-[#DDD9D1] dark:border-[#2a3f52] rounded-lg shadow-lg p-3 text-xs text-[#5C6880] dark:text-[#A8B8C8] hidden group-hover:block z-10">
                    <p className="font-medium text-[#1B3050] dark:text-[#E8E4DC] mb-1">Catégorisation automatique</p>
                    <p>La catégorie est attribuée automatiquement selon le type retourné par Yahoo Finance, mais des erreurs peuvent survenir — notamment pour les ETF obligataires ou certains fonds.</p>
                    <p className="mt-1.5">Vous pouvez toujours <span className="font-medium text-[#1B3050] dark:text-[#E8E4DC]">modifier la catégorie manuellement</span> en cliquant sur les boutons ci-dessus.</p>
                  </div>
                </div>
                <button onClick={() => setShowModal(false)} className="text-[#9E9A93] hover:text-[#1B3050] dark:hover:text-white text-xl">×</button>
              </div>
            </div>
            <div className="p-6 space-y-5">

              {/* 1. Catégorie */}
              <div>
                <label className="block text-xs font-medium text-[#5C6880] mb-2">Catégorie</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(c => (
                    <button key={c} type="button"
                      onClick={() => setForm(f => ({ ...f, categorie: c }))}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        form.categorie === c
                          ? 'bg-[#2B6B5A] text-white border-[#2B6B5A]'
                          : 'border-[#DDD9D1] dark:border-[#2a3f52] text-[#5C6880] hover:border-[#2B6B5A] hover:text-[#2B6B5A]'
                      }`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Recherche actif */}
              <div>
                <label className="block text-xs font-medium text-[#5C6880] mb-1.5">Actif *</label>
                <TickerAutocomplete
                  placeholder={CATEGORY_PLACEHOLDER[form.categorie]}
                  value={{ ticker: form.ticker, nom: form.nom, devise: form.devise }}
                  filterTypes={effectiveTypes}
                  filterExch={brokerProfile?.exchKeywords}
                  categorySuggestions={CATEGORY_SUGGESTIONS[form.categorie]}
                  onChange={({ ticker, nom, devise, type }) => {
                    const TYPE_TO_CAT: Record<string, string> = {
                      'equity': 'Actions', 'etf': 'ETF',
                      'cryptocurrency': 'Crypto', 'future': 'Matières premières',
                      'futures': 'Matières premières', 'currency': 'Monnaies',
                      'mutual fund': 'ETF Oblig.', 'mutualfund': 'ETF Oblig.', 'bond': 'ETF Oblig.',
                    }
                    const categorie = TYPE_TO_CAT[type.toLowerCase()] ?? form.categorie
                    setForm(f => ({ ...f, ticker, nom, devise, categorie }))
                    setFetchModalError(null)
                    if (ticker) {
                      setManuel(true)
                      fetchPrixActuelFor(ticker, devise)
                      if (form.dateAchat) fetchPrixAchatFor(ticker, devise, form.dateAchat)
                    }
                  }}
                />
                {form.ticker && (
                  <p className="text-xs text-[#9E9A93] mt-1">
                    <span className="font-mono text-[#2B6B5A] font-medium">{form.ticker}</span>
                    {' '}· <span className="font-mono">{form.devise}</span>
                  </p>
                )}
              </div>

              {/* 3. Quantité + Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#5C6880] mb-1">Quantité</label>
                  <input className={inputCls} type="text" inputMode="decimal"
                    placeholder="ex: 0.00001" value={quantiteRaw}
                    onChange={e => {
                      const raw = e.target.value
                      if (raw === '' || /^[0-9]*[.,]?[0-9]*$/.test(raw)) {
                        setQuantiteRaw(raw)
                        const num = parseFloat(raw.replace(',', '.'))
                        if (!isNaN(num)) setForm(f => ({ ...f, quantite: num }))
                        else if (raw === '') setForm(f => ({ ...f, quantite: 0 }))
                      }
                    }} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5C6880] mb-1">Date d'achat</label>
                  <input className={inputCls} type="date" value={form.dateAchat}
                    onChange={e => {
                      const date = e.target.value
                      setForm(f => ({ ...f, dateAchat: date }))
                      if (form.ticker && date) {
                        setManuel(true)
                        fetchPrixAchatFor(form.ticker, form.devise, date)
                      }
                    }} />
                </div>
              </div>

              {/* Status des fetches automatiques */}
              {(fetchingAchat || fetchingModal) && (
                <div className="flex items-center gap-2 text-xs text-[#9E9A93]">
                  <span className="animate-spin inline-block">⟳</span>
                  {fetchingAchat && fetchingModal ? 'Récupération des prix…' : fetchingAchat ? 'Prix d\'achat en cours…' : 'Prix actuel en cours…'}
                </div>
              )}
              {fetchModalError && <p className="text-xs text-red-500">{fetchModalError}</p>}

              {/* Toggle manuel */}
              <button type="button" onClick={() => setManuel(m => !m)}
                className="text-xs text-[#9E9A93] hover:text-[#5C6880] underline underline-offset-2 transition-colors">
                {manuel ? '▲ Masquer les champs manuels' : '▼ Remplir manuellement'}
              </button>

              {/* Champs manuels */}
              {manuel && (
                <div className="border border-[#DDD9D1] dark:border-[#2a3f52] rounded-xl p-4 space-y-4 bg-[#F5F3EF]/50 dark:bg-[#0F1E2C]/50">
                  <p className="text-xs text-[#9E9A93]">Ces champs sont remplis automatiquement. Modifiez-les si nécessaire ou si l'actif n'est pas trouvé.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[#5C6880] mb-1">Prix d'achat ({form.devise})</label>
                      <input className={inputCls} type="number" step="any" placeholder="150.00" value={form.prixAchat || ''} onChange={fld('prixAchat')} />
                    </div>
                    {form.devise !== 'CHF' && (
                      <div>
                        <label className="block text-xs font-medium text-[#5C6880] mb-1">Taux CHF/{form.devise} à l'achat</label>
                        <input className={inputCls} type="number" step="0.0001" placeholder="0.9200" value={form.tauxAchatCHF || ''} onChange={fld('tauxAchatCHF')} />
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-medium text-[#5C6880] mb-1">Prix actuel ({form.devise})</label>
                      <input className={inputCls} type="number" step="any" placeholder="185.00" value={form.prixActuel || ''} onChange={fld('prixActuel')} />
                    </div>
                    {form.devise !== 'CHF' && (
                      <div>
                        <label className="block text-xs font-medium text-[#5C6880] mb-1">Taux CHF/{form.devise} actuel</label>
                        <input className={inputCls} type="number" step="0.0001" placeholder="0.8800" value={form.tauxActuelCHF || ''} onChange={fld('tauxActuelCHF')} />
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-medium text-[#5C6880] mb-1">Nom de l'actif</label>
                      <input className={inputCls} type="text" placeholder="Apple Inc." value={form.nom} onChange={fld('nom')} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#5C6880] mb-1">Ticker</label>
                      <input className={inputCls} type="text" placeholder="AAPL" value={form.ticker} onChange={fld('ticker')} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#5C6880] mb-1">Devise</label>
                      <select className={inputCls} value={form.devise} onChange={e => {
                        const devise = e.target.value
                        setForm(f => ({ ...f, devise }))
                        if (form.ticker) {
                          fetchPrixActuelFor(form.ticker, devise)
                          if (form.dateAchat) fetchPrixAchatFor(form.ticker, devise, form.dateAchat)
                        }
                      }}>
                        {DEVISES.map(d => <option key={d}>{d}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Tranche (mode édition uniquement) */}
              {editId && (
                <div className="border border-[#DDD9D1] dark:border-[#2a3f52] rounded-xl p-4 bg-[#F5F3EF]/30 dark:bg-[#0F1E2C]/30 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={sliceMode} onChange={e => setSliceMode(e.target.checked)}
                      className="w-4 h-4 accent-[#2B6B5A]" />
                    <span className="text-xs font-medium text-[#5C6880] dark:text-[#A8B8C8]">
                      Ajouter un lot / Ajuster la quantité
                      <span className="ml-1 font-normal text-[#9E9A93]">(historique conservé, performance par lot)</span>
                    </span>
                  </label>
                  {sliceMode && (
                    <div className="space-y-3 pt-1">
                      <p className="text-xs text-[#9E9A93]">
                        {sliceQuantite > 0 && sliceQuantite > sliceGroupTotal
                          ? `Un nouveau lot (+${(sliceQuantite - sliceGroupTotal).toFixed(sliceGroupTotal % 1 === 0 ? 0 : 4)} ${form.ticker}) sera ajouté avec son propre prix d'achat. La performance sera calculée depuis sa date d'achat.`
                          : "Une entrée de réduction sera ajoutée pour que le total du groupe reflète la nouvelle quantité. L'entrée originale reste inchangée."
                        }
                      </p>
                      <div className="grid grid-cols-2 gap-3 items-start">
                        <div>
                          <label className="block text-xs font-medium text-[#5C6880] mb-1">Date du changement</label>
                          <input className={inputCls} type="date" value={sliceDate}
                            min={form.dateAchat}
                            onChange={e => setSliceDate(e.target.value)} />
                          {form.dateAchat && sliceDate && sliceDate < form.dateAchat ? (
                            <p className="text-xs mt-1 text-red-500 font-medium">La date ne peut pas être antérieure à l'ouverture ({form.dateAchat})</p>
                          ) : form.dateAchat ? (
                            <p className="text-xs mt-1 text-[#9E9A93]">≥ date d'ouverture ({form.dateAchat})</p>
                          ) : null}
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#5C6880] mb-1">Nouvelle quantité totale</label>
                          <input
                            className={inputCls}
                            type="text"
                            inputMode="decimal"
                            placeholder={String(sliceGroupTotal)}
                            value={sliceQuantiteRaw}
                            onChange={e => {
                              const raw = e.target.value
                              if (raw === '' || /^[0-9]*[.,]?[0-9]*$/.test(raw)) {
                                setSliceQuantiteRaw(raw)
                                const num = parseFloat(raw.replace(',', '.'))
                                if (!isNaN(num)) setSliceQuantite(num)
                                else if (raw === '') setSliceQuantite(0)
                              }
                            }}
                          />
                          <p className="text-xs mt-1 text-[#9E9A93]">Total groupe actuel : {sliceGroupTotal}</p>
                          {sliceQuantite > 0 && sliceQuantite !== sliceGroupTotal && (
                            <p className="text-xs mt-1 text-[#2B6B5A]">
                              {sliceQuantite > sliceGroupTotal ? `Nouveau lot : +${sliceQuantite - sliceGroupTotal} ${form.ticker}` : `Réduction : ${sliceQuantite - sliceGroupTotal} ${form.ticker}`}
                            </p>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#5C6880] mb-1">
                          {sliceQuantite > sliceGroupTotal ? "Prix d'achat du lot" : "Prix de vente effectif"}
                          <span className="ml-1 text-[#9E9A93] font-normal">({form.devise})</span>
                        </label>
                        <div className="relative">
                          <input
                            className={inputCls}
                            type="text"
                            inputMode="decimal"
                            placeholder={
                              sliceHistoLoading ? 'Chargement...' :
                              sliceHistoPrice ? sliceHistoPrice.price.toLocaleString('fr-CH', { maximumFractionDigits: 2 }) :
                              sliceDate ? 'Introuvable' :
                              form.prixActuel.toLocaleString('fr-CH', { maximumFractionDigits: 2 })
                            }
                            value={slicePrixVenteRaw}
                            onChange={e => {
                              const raw = e.target.value
                              if (raw === '' || /^[0-9]*[.,]?[0-9]*$/.test(raw)) {
                                setSlicePrixVenteRaw(raw)
                                const num = parseFloat(raw.replace(',', '.'))
                                if (!isNaN(num) && num > 0) setSlicePrixVente(num)
                                else setSlicePrixVente(undefined)
                              }
                            }}
                          />
                          {sliceHistoLoading && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#9E9A93] animate-pulse">…</span>
                          )}
                        </div>
                        {sliceHistoPrice && !sliceHistoLoading && (
                          <p className="text-xs mt-1 text-[#2B6B5A]">
                            {sliceQuantite > sliceGroupTotal ? "Prix d'achat suggéré" : "Prix de vente"} au {sliceDate} : {sliceHistoPrice.price.toLocaleString('fr-CH', { maximumFractionDigits: 2 })} {form.devise}
                            {form.devise !== 'CHF' && ` · Taux CHF : ${sliceHistoPrice.fxRate.toFixed(4)}`}
                          </p>
                        )}
                        {!sliceHistoPrice && !sliceHistoLoading && sliceDate && (
                          <p className="text-xs mt-1 text-[#9E9A93]">Prix historique non disponible — saisir manuellement.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowModal(false)}
                  className="flex-1 border border-[#DDD9D1] dark:border-[#2a3f52] text-[#5C6880] text-sm py-2 rounded-lg hover:bg-[#F5F3EF] dark:hover:bg-[#1B2D3E] transition-colors">
                  Annuler
                </button>
                <button onClick={saveForm} disabled={(!form.ticker && !form.nom) || (sliceMode && !!sliceDate && !!form.dateAchat && sliceDate < form.dateAchat)}
                  className="flex-1 bg-[#2B6B5A] hover:bg-[#225549] disabled:opacity-40 text-white text-sm py-2 rounded-lg transition-colors font-medium">
                  {editId ? (sliceMode ? "Créer l'ajustement" : 'Enregistrer') : 'Ajouter'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
