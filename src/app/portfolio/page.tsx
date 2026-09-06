'use client'

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'

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
}
interface PositionCalc extends Position {
  coutCHF: number; valeurCHF: number; gainCHF: number; gainPctCHF: number
  gainDevise: number; gainPctDevise: number; impactFX: number; gainReel: number; gainPctReel: number
}
interface SearchResult { ticker: string; nom: string; bourse: string; type: string; devise: string; pays?: string }

const TYPE_ICON: Record<string, string> = {
  'Equity': '📈', 'Equities': '📈',
  'ETF': '🗂️',
  'Cryptocurrency': '₿',
  'Future': '⏱️', 'Futures': '⏱️',
  'Mutual Fund': '📦', 'Mutualfund': '📦',
  'Currency': '💱',
}

const CATEGORY_PLACEHOLDER: Record<string, string> = {
  'Actions':           'Rechercher une action… (ex: Apple, Nestlé, AAPL)',
  'ETF':               'Rechercher un ETF… (ex: MSCI World, SPY, VT)',
  'Obligations':       'Rechercher une obligation… (ex: TLT, IBTE.L)',
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
const CATEGORIES = ['Tout', 'Actions', 'ETF', 'Obligations', 'Matières premières', 'Crypto', 'Monnaies']

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
const CAT_COLOR: Record<string, string> = {
  'Actions': '#2B6B5A', 'ETF': '#1B3050', 'Obligations': '#B5820F',
  'Matières premières': '#7C4F2A', 'Crypto': '#5C3080', 'Monnaies': '#1B5C80', 'Tout': '#5C6880',
}
const EMPTY_FORM: Omit<Position, 'id'> = {
  nom: '', ticker: '', categorie: 'Tout', devise: 'USD',
  quantite: 0, prixAchat: 0, tauxAchatCHF: 1,
  dateAchat: new Date().toISOString().slice(0, 10),
  prixActuel: 0, tauxActuelCHF: 1, courtier: '',
}

// ─── Autocomplete ticker ──────────────────────────────────────────────────────
function TickerAutocomplete({
  value, onChange, placeholder, filterTypes, filterExch
}: {
  value: { ticker: string; nom: string; devise: string }
  onChange: (r: { ticker: string; nom: string; devise: string; type: string }) => void
  placeholder?: string
  filterTypes?: string[]   // quoteTypes autorisés (undefined = tous, [] = impossible)
  filterExch?: string[]    // mots-clés exchange (vide = tous)
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
        // Filtrage par profil courtier
        // r.type est un label affichage Yahoo (ex: "Equity", "ETF", "Cryptocurrency")
        const TYPE_DISPLAY_MAP: Record<string, string> = {
          'equity': 'EQUITY', 'etf': 'ETF', 'cryptocurrency': 'CRYPTOCURRENCY',
          'future': 'FUTURE', 'futures': 'FUTURE', 'mutual fund': 'MUTUALFUND', 'currency': 'CURRENCY',
          'mutualfund': 'MUTUALFUND',
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
        setResults(raw)
        setOpen(true)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [filterTypes, filterExch])

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
    setSelected(false)
    search(e.target.value)
  }

  function handleSelect(r: SearchResult) {
    setQuery(`${r.nom} (${r.ticker})`)
    setSelected(true)
    setOpen(false)
    setResults([])
    onChange({ ticker: r.ticker, nom: r.nom, devise: r.devise, type: r.type })
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
          onFocus={() => { if (results.length > 0) setOpen(true) }}
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
              {/* Icône type */}
              <span className="text-lg flex-shrink-0 w-6 text-center">
                {TYPE_ICON[r.type] ?? '📊'}
              </span>
              {/* Nom + détails */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[#1B3050] dark:text-[#E8E4DC] truncate">{r.nom}</div>
                <div className="text-xs text-[#9E9A93] flex items-center gap-1.5 mt-0.5">
                  <span className="font-mono font-semibold text-[#2B6B5A]">{r.ticker}</span>
                  {r.bourse && <><span>·</span><span>{r.bourse}</span></>}
                  {r.type && <><span>·</span><span>{r.type}</span></>}
                </div>
              </div>
              {/* Devise */}
              <span className="text-xs font-mono text-[#9E9A93] flex-shrink-0">{r.devise}</span>
            </button>
          ))}
        </div>
      )}

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

// ─── Chart: Evolution ─────────────────────────────────────────────────────────
function EvolChart({ data }: { data: PositionCalc[] }) {
  const W = 600, H = 220, PAD = { t: 16, r: 16, b: 36, l: 64 }
  const iW = W - PAD.l - PAD.r, iH = H - PAD.t - PAD.b

  const [monthlyPts, setMonthlyPts] = useState<{ x: number; cost: number; value: number; label: string }[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const { months, firstDate, totalMs } = useMemo(() => {
    if (data.length === 0) return { months: [] as string[], firstDate: new Date(), totalMs: 1 }
    const sorted = [...data].sort((a, b) => new Date(a.dateAchat).getTime() - new Date(b.dateAchat).getTime())
    const first = new Date(sorted[0].dateAchat)
    const today = new Date()
    const ms = today.getTime() - first.getTime()
    const list: string[] = []
    let d = new Date(first.getFullYear(), first.getMonth(), 1)
    while (d <= today) {
      list.push(d.toISOString().slice(0, 10))
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    }
    return { months: list, firstDate: first, totalMs: ms || 1 }
  }, [data])

  const dataKey = useMemo(() => data.map(p => p.ticker + p.dateAchat + p.quantite).join(','), [data])

  useEffect(() => {
    if (data.length === 0 || months.length === 0) return
    let cancelled = false
    setLoading(true); setProgress(0); setMonthlyPts(null)

    async function fetchAll() {
      const today = new Date().toISOString().slice(0, 10)
      const result: { x: number; cost: number; value: number; label: string }[] = []

      for (let i = 0; i < months.length; i++) {
        if (cancelled) return
        const monthDate = months[i]
        const isToday = monthDate >= today
        const activePosns = data.filter(p => p.dateAchat <= monthDate)
        if (activePosns.length === 0) { setProgress(Math.round((i + 1) / months.length * 100)); continue }

        const prices = await Promise.all(activePosns.map(async p => {
          const d = await fetchPriceCached(p.ticker, p.devise, isToday ? undefined : monthDate)
          return d ?? { price: p.prixActuel, fxRate: p.tauxActuelCHF }
        }))

        const cumCost = activePosns.reduce((s, p) => s + p.coutCHF, 0)
        const value = activePosns.reduce((s, p, j) => s + p.quantite * prices[j].price * prices[j].fxRate, 0)
        const t = (new Date(monthDate).getTime() - firstDate.getTime()) / totalMs
        result.push({ x: isToday ? 1 : Math.min(t, 0.98), cost: cumCost, value, label: monthDate.slice(0, 7) })
        setProgress(Math.round((i + 1) / months.length * 100))
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
      <p className="text-xs text-[#9E9A93]">Chargement des données mensuelles… {progress}%</p>
    </div>
  )

  const points = monthlyPts

  if (!points || points.length < 2) return (
    <div className="flex items-center justify-center h-36 text-sm text-[#9E9A93]">
      Ajoutez au moins 2 positions pour voir le graphique
    </div>
  )

  const lastVal = points[points.length - 1].value
  const allValues = points.flatMap(p => [p.cost, p.value])
  const maxV = Math.max(...allValues) * 1.08, minV = Math.min(0, ...allValues), span = maxV - minV || 1
  const px = (t: number) => PAD.l + t * iW
  const py = (v: number) => PAD.t + iH - ((v - minV) / span) * iH
  const tickVals = Array.from({ length: 5 }, (_, i) => minV + (span * i) / 4)
  const costPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${px(p.x)} ${py(p.cost)}`).join(' ')

  const { gainD, lossD } = buildColoredAreas(
    points.map(p => ({ x: p.x, val: p.value, base: p.cost })),
    px, py
  )

  const hovered = hoverIdx !== null ? points[hoverIdx] : null

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}
      onMouseLeave={() => setHoverIdx(null)}
      onMouseMove={e => {
        const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
        const mx = (e.clientX - rect.left) / rect.width * W
        const t = (mx - PAD.l) / iW
        let best = 0, bd = Infinity
        points.forEach((p, i) => { const d = Math.abs(p.x - t); if (d < bd) { bd = d; best = i } })
        setHoverIdx(best)
      }}
    >
      <defs>
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
            {v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)}
          </text>
        </g>
      ))}
      <path d={`${costPath} L ${px(points[points.length-1].x)} ${py(minV)} L ${px(points[0].x)} ${py(minV)} Z`} fill="url(#eg-cost)" />
      {gainD && <path d={gainD} fill="url(#eg-gain)" />}
      {lossD && <path d={lossD} fill="url(#eg-loss)" />}
      <path d={costPath} fill="none" stroke="#9E9A93" strokeWidth="1.5" strokeDasharray="4 3" />
      {points.slice(0, -1).map((p0, i) => {
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
      {hovered && (
        <g>
          <line x1={px(hovered.x)} y1={PAD.t} x2={px(hovered.x)} y2={H - PAD.b} stroke="#9E9A93" strokeWidth="0.8" strokeDasharray="3 2" />
          <circle cx={px(hovered.x)} cy={py(hovered.value)} r="3.5" fill={hovered.value >= hovered.cost ? '#2B6B5A' : '#DC2626'} />
          <circle cx={px(hovered.x)} cy={py(hovered.cost)} r="3" fill="#9E9A93" />
          {(() => {
            const tx = Math.min(Math.max(px(hovered.x), PAD.l + 60), W - PAD.r - 60)
            const ty = py(hovered.value) - 10
            const g = hovered.value - hovered.cost
            return (
              <g transform={`translate(${tx}, ${ty < PAD.t + 40 ? PAD.t + 40 : ty})`}>
                <rect x="-58" y="-30" width="116" height="34" rx="4" fill="#1C2B22" opacity="0.92" />
                <text x="0" y="-14" textAnchor="middle" fontSize="10" fill="#9E9A93">{hovered.label}</text>
                <text x="-2" y="0" textAnchor="end" fontSize="10" fill="#9E9A93">{hovered.cost >= 1000 ? `${(hovered.cost/1000).toFixed(1)}k` : hovered.cost.toFixed(0)} CHF</text>
                <text x="2" y="0" textAnchor="start" fontSize="10" fill={g >= 0 ? '#4ADE80' : '#F87171'}>{g >= 0 ? '+' : ''}{g >= 1000 || g <= -1000 ? `${(g/1000).toFixed(1)}k` : g.toFixed(0)} CHF</text>
              </g>
            )
          })()}
        </g>
      )}
      <circle cx={px(points[points.length-1].x)} cy={py(lastVal)} r="4" fill={lastVal >= points[points.length-1].cost ? '#2B6B5A' : '#DC2626'} />
      <text x={px(points[0].x)} y={H - 6} textAnchor="middle" fontSize="10" fill="#9E9A93">{points[0].label}</text>
      <text x={px(points[points.length-1].x)} y={H - 6} textAnchor="middle" fontSize="10" fill="#9E9A93">Auj.</text>
      <g transform={`translate(${PAD.l + 8}, ${PAD.t + 8})`}>
        <line x1="0" y1="6" x2="18" y2="6" stroke="#9E9A93" strokeWidth="1.5" strokeDasharray="4 3" />
        <text x="22" y="10" fontSize="10" fill="#9E9A93">Investi</text>
        <line x1="60" y1="6" x2="69" y2="6" stroke="#2B6B5A" strokeWidth="2" />
        <line x1="69" y1="6" x2="78" y2="6" stroke="#DC2626" strokeWidth="2" />
        <text x="82" y="10" fontSize="10" fill="#9E9A93">Valeur actuelle</text>
      </g>
    </svg>
  )
}


// ─── Chart: PnL ──────────────────────────────────────────────────────────────
function inflationBetween(dateAchat: string, dateTo: string): number {
  return cpiAt(dateTo) / cpiAt(dateAchat) - 1
}

function PnLChart({ data, showNominal, showReel }: { data: PositionCalc[]; showNominal: boolean; showReel: boolean }) {
  const W = 600, H = 220, PAD = { t: 16, r: 16, b: 36, l: 64 }
  const iW = W - PAD.l - PAD.r, iH = H - PAD.t - PAD.b

  const [monthlyPts, setMonthlyPts] = useState<{ x: number; nominal: number; reel: number; label: string }[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)

  const { months, firstDate, totalMs } = useMemo(() => {
    if (data.length === 0) return { months: [] as string[], firstDate: new Date(), totalMs: 1 }
    const sorted = [...data].sort((a, b) => new Date(a.dateAchat).getTime() - new Date(b.dateAchat).getTime())
    const first = new Date(sorted[0].dateAchat)
    const today = new Date()
    const ms = today.getTime() - first.getTime()
    const list: string[] = []
    let d = new Date(first.getFullYear(), first.getMonth(), 1)
    while (d <= today) {
      list.push(d.toISOString().slice(0, 10))
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    }
    return { months: list, firstDate: first, totalMs: ms || 1 }
  }, [data])

  const dataKey = useMemo(() => data.map(p => p.ticker + p.dateAchat + p.quantite).join(','), [data])

  useEffect(() => {
    if (data.length === 0 || months.length === 0) return
    let cancelled = false
    setLoading(true); setProgress(0); setMonthlyPts(null)

    async function fetchAll() {
      const today = new Date().toISOString().slice(0, 10)
      const result: { x: number; nominal: number; reel: number; label: string }[] = []

      for (let i = 0; i < months.length; i++) {
        if (cancelled) return
        const monthDate = months[i]
        const isToday = monthDate >= today
        const activePosns = data.filter(p => p.dateAchat <= monthDate)
        if (activePosns.length === 0) { setProgress(Math.round((i + 1) / months.length * 100)); continue }

        const prices = await Promise.all(activePosns.map(async p => {
          const d = await fetchPriceCached(p.ticker, p.devise, isToday ? undefined : monthDate)
          return d ?? { price: p.prixActuel, fxRate: p.tauxActuelCHF }
        }))

        let nominal = 0, reel = 0
        for (let j = 0; j < activePosns.length; j++) {
          const p = activePosns[j]
          const valCHF = p.quantite * prices[j].price * prices[j].fxRate
          const infAdj = p.coutCHF * (1 + inflationBetween(p.dateAchat, monthDate))
          nominal += valCHF - p.coutCHF
          reel    += valCHF - infAdj
        }

        const t = (new Date(monthDate).getTime() - firstDate.getTime()) / totalMs
        result.push({ x: isToday ? 1 : Math.min(t, 0.98), nominal, reel, label: monthDate.slice(0, 7) })
        setProgress(Math.round((i + 1) / months.length * 100))
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
      <p className="text-xs text-[#9E9A93]">Chargement des données mensuelles… {progress}%</p>
    </div>
  )

  if (!points || points.length < 2) return (
    <div className="flex items-center justify-center h-36 text-sm text-[#9E9A93]">
      Ajoutez au moins 2 positions pour voir le graphique
    </div>
  )

  const allVals = points.flatMap(p => {
    const arr: number[] = []
    if (showNominal) arr.push(p.nominal)
    if (showReel) arr.push(p.reel)
    return arr
  })
  if (allVals.length === 0) return null
  const maxV = Math.max(...allVals, 0) * 1.12
  const minV = Math.min(...allVals, 0) * 1.12
  const span = maxV - minV || 1
  const px = (t: number) => PAD.l + t * iW
  const py = (v: number) => PAD.t + iH - ((v - minV) / span) * iH
  const tickVals = Array.from({ length: 5 }, (_, i) => minV + (span * i) / 4)
  const zeroY = py(0)

  const nomAreas = showNominal ? buildColoredAreas(points.map(p => ({ x: p.x, val: p.nominal, base: 0 })), px, py) : { gainD: '', lossD: '' }
  const reelAreas = showReel ? buildColoredAreas(points.map(p => ({ x: p.x, val: p.reel, base: 0 })), px, py) : { gainD: '', lossD: '' }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      <defs>
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
      <text x={px(0)} y={H - 6} textAnchor="middle" fontSize="10" fill="#9E9A93">{points[0].label}</text>
      <text x={px(1)} y={H - 6} textAnchor="middle" fontSize="10" fill="#9E9A93">Auj.</text>
      <g transform={`translate(${PAD.l + 8}, ${PAD.t + 6})`}>
        {showNominal && <><line x1="0" y1="6" x2="9" y2="6" stroke="#2B6B5A" strokeWidth="2" /><line x1="9" y1="6" x2="18" y2="6" stroke="#DC2626" strokeWidth="2" /><text x="22" y="10" fontSize="10" fill="#9E9A93">Gain nominal</text></>}
        {showReel && <><line x1={showNominal ? 104 : 0} y1="6" x2={showNominal ? 113 : 9} y2="6" stroke="#1B5C80" strokeWidth="1.5" strokeDasharray="5 3" /><line x1={showNominal ? 113 : 9} y1="6" x2={showNominal ? 122 : 18} y2="6" stroke="#DC2626" strokeWidth="1.5" strokeDasharray="5 3" /><text x={showNominal ? 126 : 22} y="10" fontSize="10" fill="#9E9A93">Gain réel</text></>}
      </g>
    </svg>
  )
}


// ─── Portfolio Health Score ───────────────────────────────────────────────────
const RISK_SCORE: Record<string, number> = {
  'Obligations': 1, 'ETF': 3, 'Actions': 5,
  'Matières premières': 6, 'Monnaies': 4, 'Crypto': 9,
}
const CONC_THRESHOLD: Record<string, number> = {
  'Obligations': 0.55, 'ETF': 0.45, 'Actions': 0.22,
  'Matières premières': 0.25, 'Monnaies': 0.30, 'Crypto': 0.10,
}
const DIV_UNITS: Record<string, number> = {
  'ETF': 10, 'Obligations': 3, 'Matières premières': 2,
  'Monnaies': 2, 'Actions': 1, 'Crypto': 0.5,
}
// Drawdown max historique sur 20 ans par catégorie (pire scénario documenté)
// Sources : crise 2008-2009 (S&P -57%), crypto 2018 (BTC -84%), Covid -34%,
//           crise obligataire 2022 (AGG -18%), matières 2008 (-70%)
const MAX_DRAWDOWN: Record<string, number> = {
  'Obligations':       0.20,  // obligations d'État courtes à longues durée 2022
  'ETF':               0.57,  // S&P 500 crise 2008-2009 (indice large)
  'Actions':           0.75,  // action individuelle — peut atteindre 100 %
  'Matières premières':0.70,  // commodities index 2008, pétrole 2020
  'Monnaies':          0.35,  // paires majeures, défauts exotiques
  'Crypto':            0.85,  // BTC nov. 2021 → déc. 2022 ; altcoins > 95 %
}

const CATS = ['Obligations', 'ETF', 'Actions', 'Matières premières', 'Monnaies', 'Crypto']
const CAT_VOL: Record<string, number> = {
  'Obligations': 0.08, 'ETF': 0.15, 'Actions': 0.25,
  'Matières premières': 0.20, 'Monnaies': 0.12, 'Crypto': 0.70,
}
// Matrice de corrélation inter-catégories (estimations académiques long terme)
const CORR: Record<string, Record<string, number>> = {
  'Obligations':        { 'Obligations': 1.00, 'ETF': -0.10, 'Actions': -0.05, 'Matières premières':  0.05, 'Monnaies': -0.15, 'Crypto':  0.00 },
  'ETF':                { 'Obligations': -0.10, 'ETF': 1.00, 'Actions':  0.80, 'Matières premières':  0.30, 'Monnaies':  0.10, 'Crypto':  0.20 },
  'Actions':            { 'Obligations': -0.05, 'ETF': 0.80, 'Actions':  1.00, 'Matières premières':  0.20, 'Monnaies':  0.05, 'Crypto':  0.25 },
  'Matières premières': { 'Obligations':  0.05, 'ETF': 0.30, 'Actions':  0.20, 'Matières premières':  1.00, 'Monnaies':  0.15, 'Crypto':  0.10 },
  'Monnaies':           { 'Obligations': -0.15, 'ETF': 0.10, 'Actions':  0.05, 'Matières premières':  0.15, 'Monnaies':  1.00, 'Crypto':  0.05 },
  'Crypto':             { 'Obligations':  0.00, 'ETF': 0.20, 'Actions':  0.25, 'Matières premières':  0.10, 'Monnaies':  0.05, 'Crypto':  1.00 },
}

function computeHealth(data: PositionCalc[]) {
  const total = data.reduce((s, p) => s + p.valeurCHF, 0)
  if (total <= 0 || data.length === 0) return null

  // ── 1. Concentration ajustée au risque (20 pts) ──
  let concPenalty = 0
  const posDetails: { nom: string; ticker: string; cat: string; w: number; riskW: number }[] = []
  for (const p of data) {
    const w = p.valeurCHF / total
    const risk = RISK_SCORE[p.categorie] ?? 5
    const thresh = CONC_THRESHOLD[p.categorie] ?? 0.25
    const overweight = Math.max(0, w - thresh)
    const penalty = overweight > 0 ? (overweight / (1 - thresh)) * risk * 20 / 9 : 0
    concPenalty += penalty
    posDetails.push({ nom: p.nom, ticker: p.ticker, cat: p.categorie, w, riskW: w * risk })
  }
  const scoreConc = Math.max(0, Math.round(20 - concPenalty))

  // ── 2. Diversification effective (10 pts) ──
  let divUnits = 0
  for (const p of data) divUnits += (DIV_UNITS[p.categorie] ?? 1) * (p.valeurCHF / total)
  const scoreDiv = Math.min(10, Math.round((divUnits / 6) * 10))

  // ── 3. Volatilité du portefeuille — matrice de corrélation (20 pts) ──
  // Poids par catégorie agrégés, puis σ_p = √(ΣᵢΣⱼ wᵢwⱼσᵢσⱼρᵢⱼ)
  const catW: Record<string, number> = {}
  for (const p of data) catW[p.categorie] = (catW[p.categorie] ?? 0) + p.valeurCHF / total
  let variance = 0
  for (const ci of CATS) {
    for (const cj of CATS) {
      const wi = catW[ci] ?? 0; const wj = catW[cj] ?? 0
      variance += wi * wj * (CAT_VOL[ci] ?? 0.15) * (CAT_VOL[cj] ?? 0.15) * (CORR[ci]?.[cj] ?? 0)
    }
  }
  const sigmaAnnual = Math.sqrt(Math.max(0, variance))
  const sigmaMonthly = sigmaAnnual / Math.sqrt(12)
  const var95Monthly = Math.round(sigmaMonthly * 1.645 * 100) // % de la valeur du portefeuille
  const scoreVol = sigmaAnnual < 0.07 ? 20 : sigmaAnnual < 0.12 ? 17 : sigmaAnnual < 0.18 ? 13
    : sigmaAnnual < 0.25 ? 8 : sigmaAnnual < 0.40 ? 3 : 0

  // ── 4. Corrélation inter-actifs (15 pts) ──
  // ρ_portfolio = corrélation moyenne pondérée entre toutes les paires de catégories
  // Un portefeuille décorrélé (obligations + actions + crypto) score mieux
  let corrNum = 0; let corrDen = 0
  for (const ci of CATS) {
    for (const cj of CATS) {
      if (ci === cj) continue
      const wi = catW[ci] ?? 0; const wj = catW[cj] ?? 0
      const sisj = (CAT_VOL[ci] ?? 0.15) * (CAT_VOL[cj] ?? 0.15)
      corrNum += wi * wj * sisj * (CORR[ci]?.[cj] ?? 0)
      corrDen += wi * wj * sisj
    }
  }
  const rhoAvg = corrDen > 0.0001 ? corrNum / corrDen : 0
  const scoreCorr = rhoAvg < 0 ? 15 : rhoAvg < 0.15 ? 13 : rhoAvg < 0.30 ? 10 : rhoAvg < 0.50 ? 6 : rhoAvg < 0.70 ? 2 : 0

  // ── 5. Résistance aux crises — drawdown max estimé (20 pts) ──
  let drawdownEst = 0
  for (const p of data) drawdownEst += (p.valeurCHF / total) * (MAX_DRAWDOWN[p.categorie] ?? 0.60)
  const drawdownPct = Math.round(drawdownEst * 100)
  const scoreDd = drawdownEst < 0.25 ? 20 : drawdownEst < 0.40 ? 16 : drawdownEst < 0.55 ? 11 : drawdownEst < 0.68 ? 5 : 0

  // ── 6. Sharpe ratio (15 pts) ──
  // Rendement annualisé depuis le premier achat vs. taux sans risque CHF (~0.8 %)
  const totalCost = data.reduce((s, p) => s + p.coutCHF, 0)
  const totalReturn = totalCost > 0 ? (total - totalCost) / totalCost : 0
  const oldestDate = data.reduce((m, p) => p.dateAchat < m ? p.dateAchat : m, data[0].dateAchat)
  const yearsHeld = (Date.now() - new Date(oldestDate).getTime()) / (365.25 * 24 * 3600 * 1000)
  const annualReturn = yearsHeld >= 0.25 ? Math.pow(1 + totalReturn, 1 / yearsHeld) - 1 : null
  const sharpe = annualReturn !== null && sigmaAnnual > 0 ? (annualReturn - 0.008) / sigmaAnnual : null
  const scoreSharpe = sharpe === null ? 7
    : sharpe > 2.0 ? 15 : sharpe > 1.5 ? 12 : sharpe > 1.0 ? 9 : sharpe > 0.5 ? 5 : sharpe > 0 ? 2 : 0

  const total100 = scoreConc + scoreDiv + scoreVol + scoreCorr + scoreDd + scoreSharpe

  // ── Niveau de risque global (informatif) ──
  const riskAvg = posDetails.reduce((s, p) => s + p.riskW, 0)

  // ── Exposition devise (informatif uniquement) ──
  const devises = new Map<string, number>()
  for (const p of data) devises.set(p.devise, (devises.get(p.devise) ?? 0) + p.valeurCHF / total)

  // ── Recommandations ──
  const recs: string[] = []
  const topRisk = [...posDetails].sort((a, b) => b.riskW - a.riskW)[0]
  if (topRisk && topRisk.riskW > 0.18)
    recs.push(`${topRisk.nom} (${(topRisk.w * 100).toFixed(0)} %) représente une exposition au risque élevée — pensez à réduire ou couvrir.`)
  const cryptoW = posDetails.filter(p => p.cat === 'Crypto').reduce((s, p) => s + p.w, 0)
  if (cryptoW > 0.12)
    recs.push(`Vos crypto-actifs totalisent ${(cryptoW * 100).toFixed(0)} % — en cas de crise, un drawdown de ~85 % est historiquement documenté sur cette classe.`)
  if (drawdownEst >= 0.55)
    recs.push(`Drawdown estimé élevé (${drawdownPct} %) — votre portefeuille pourrait perdre plus de la moitié de sa valeur en scénario de crise simultanée.`)
  if (sigmaAnnual > 0.25)
    recs.push(`Volatilité annuelle estimée à ${Math.round(sigmaAnnual * 100)} % — votre portefeuille est exposé à des fluctuations importantes.`)
  const hasETF = data.some(p => p.categorie === 'ETF')
  if (!hasETF && data.length > 0)
    recs.push('Aucun ETF dans votre portefeuille — un ETF indiciel (MSCI World, S&P 500) apporte une diversification immédiate.')
  const hasBond = data.some(p => p.categorie === 'Obligations')
  if (!hasBond && riskAvg > 4)
    recs.push('Ajoutez des obligations pour réduire la volatilité et le drawdown maximal du portefeuille.')
  if (sharpe !== null && sharpe < 0.5)
    recs.push(`Sharpe ratio faible (${sharpe.toFixed(2)}) — le rendement obtenu ne compense pas suffisamment le risque pris.`)
  if (recs.length === 0)
    recs.push('Votre portefeuille est bien structuré. Continuez à surveiller la concentration et à rééquilibrer régulièrement.')

  return { total100, scoreConc, scoreDiv, scoreVol, scoreCorr, scoreDd, scoreSharpe, riskAvg, drawdownEst, drawdownPct, sigmaAnnual, var95Monthly, rhoAvg, sharpe, annualReturn, recs, posDetails, devises }
}

function PortfolioHealth({ data }: { data: PositionCalc[] }) {
  const h = computeHealth(data)
  if (!h) return null

  const { total100, scoreConc, scoreDiv, scoreVol, scoreCorr, scoreDd, scoreSharpe, riskAvg, drawdownEst, drawdownPct, sigmaAnnual, var95Monthly, rhoAvg, sharpe, annualReturn, recs, devises } = h

  const grade = total100 >= 85 ? 'A' : total100 >= 70 ? 'B' : total100 >= 50 ? 'C' : total100 >= 30 ? 'D' : 'E'
  const gradeColor = grade === 'A' ? '#2B6B5A' : grade === 'B' ? '#1B5C80' : grade === 'C' ? '#B5820F' : grade === 'D' ? '#DC6B2B' : '#DC2626'
  const gradeBg = grade === 'A' ? 'bg-[#2B6B5A]/10' : grade === 'B' ? 'bg-[#1B5C80]/10' : grade === 'C' ? 'bg-[#B5820F]/10' : grade === 'D' ? 'bg-[#DC6B2B]/10' : 'bg-red-50 dark:bg-red-900/10'

  const riskLabel = riskAvg < 2 ? 'Très défensif' : riskAvg < 3.5 ? 'Défensif' : riskAvg < 5.5 ? 'Équilibré' : riskAvg < 7 ? 'Dynamique' : 'Agressif'
  const riskPct = Math.round((riskAvg / 9) * 100)

  const ddColor = drawdownEst < 0.25 ? '#2B6B5A' : drawdownEst < 0.40 ? '#1B5C80' : drawdownEst < 0.55 ? '#B5820F' : drawdownEst < 0.68 ? '#DC6B2B' : '#DC2626'
  const ddLabel = drawdownEst < 0.25 ? 'Faible' : drawdownEst < 0.40 ? 'Modéré' : drawdownEst < 0.55 ? 'Élevé' : drawdownEst < 0.68 ? 'Très élevé' : 'Extrême'
  const volColor = sigmaAnnual < 0.07 ? '#2B6B5A' : sigmaAnnual < 0.12 ? '#1B5C80' : sigmaAnnual < 0.18 ? '#B5820F' : sigmaAnnual < 0.25 ? '#DC6B2B' : '#DC2626'
  const volLabel = sigmaAnnual < 0.07 ? 'Très faible' : sigmaAnnual < 0.12 ? 'Faible' : sigmaAnnual < 0.18 ? 'Modérée' : sigmaAnnual < 0.25 ? 'Élevée' : 'Très élevée'
  const sharpeLabel = sharpe === null ? 'N/A (< 3 mois)' : sharpe > 2 ? 'Excellent' : sharpe > 1 ? 'Bon' : sharpe > 0.5 ? 'Passable' : sharpe > 0 ? 'Faible' : 'Négatif'
  const sharpeColor = sharpe === null ? '#9E9A93' : sharpe > 1.5 ? '#2B6B5A' : sharpe > 0.5 ? '#1B5C80' : sharpe > 0 ? '#B5820F' : '#DC2626'
  const corrColor = rhoAvg < 0 ? '#2B6B5A' : rhoAvg < 0.30 ? '#1B5C80' : rhoAvg < 0.50 ? '#B5820F' : '#DC2626'
  const corrLabel = rhoAvg < 0 ? 'Décorrélé' : rhoAvg < 0.15 ? 'Faible' : rhoAvg < 0.30 ? 'Modérée' : rhoAvg < 0.50 ? 'Élevée' : 'Forte'

  // Currency disclaimer text
  const deviseList = [...devises.entries()].sort((a, b) => b[1] - a[1])
  const deviseText = deviseList.map(([d, w]) => `${d} ${(w * 100).toFixed(0)} %`).join(' · ')

  const dims = [
    { label: 'Concentration', sub: 'Risque par position', score: scoreConc, max: 20 },
    { label: 'Diversification effective', sub: 'ETF > Actions > Crypto', score: scoreDiv, max: 10 },
    { label: 'Volatilité portefeuille', sub: `σ ~${Math.round(sigmaAnnual * 100)} % · VaR 95 % : ${var95Monthly} %/mois (${volLabel})`, score: scoreVol, max: 20, accent: volColor },
    { label: 'Corrélation inter-actifs', sub: `ρ moyen : ${rhoAvg.toFixed(2)} — ${corrLabel}`, score: scoreCorr, max: 15, accent: corrColor },
    { label: 'Résistance aux crises', sub: `Drawdown max estimé : ${drawdownPct} % (${ddLabel})`, score: scoreDd, max: 20, accent: ddColor },
    { label: 'Sharpe ratio', sub: sharpe !== null ? `${sharpe.toFixed(2)} — ${sharpeLabel}` : sharpeLabel, score: scoreSharpe, max: 15, accent: sharpeColor },
  ]

  return (
    <div className="bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-5 mb-6">
      <div className="flex items-start gap-5">
        {/* Grade */}
        <div className={`flex-shrink-0 w-20 h-20 rounded-2xl ${gradeBg} flex flex-col items-center justify-center`}>
          <span className="text-3xl font-bold" style={{ color: gradeColor }}>{grade}</span>
          <span className="text-xs font-semibold" style={{ color: gradeColor }}>{total100}/100</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-[#1B3050] dark:text-[#E8E4DC]">Santé du portefeuille</h3>
              <p className="text-xs text-[#9E9A93] mt-0.5">Concentration · Diversification · Volatilité · Corrélation · Drawdown · Sharpe</p>
            </div>
            {/* Risk gauge */}
            <div className="text-right">
              <p className="text-xs text-[#9E9A93] mb-1">Niveau de risque global</p>
              <div className="flex items-center gap-2 justify-end">
                <div className="w-28 h-1.5 rounded-full bg-gradient-to-r from-[#2B6B5A] via-[#B5820F] to-[#DC2626] relative">
                  <div className="absolute -top-0.5 w-2.5 h-2.5 rounded-full bg-white border-2 border-[#1B3050] dark:border-[#E8E4DC] shadow"
                    style={{ left: `calc(${riskPct}% - 5px)` }} />
                </div>
                <span className="text-xs font-semibold text-[#5C6880]">{riskLabel}</span>
              </div>
            </div>
          </div>

          {/* Dimension bars */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
            {dims.map(d => {
              const pct = Math.round((d.score / d.max) * 100)
              const barColor = (d as {accent?: string}).accent ?? (pct >= 75 ? '#2B6B5A' : pct >= 45 ? '#B5820F' : '#DC2626')
              return (
                <div key={d.label}>
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-xs font-medium text-[#1B3050] dark:text-[#E8E4DC]">{d.label}</span>
                    <span className="text-xs font-mono text-[#9E9A93]">{d.score}/{d.max}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#F5F3EF] dark:bg-[#0F1E2C]">
                    <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                  </div>
                  <p className="text-[10px] text-[#9E9A93] mt-0.5">{d.sub}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Currency disclaimer */}
      <div className="mt-3 px-3 py-2 rounded-lg bg-[#F5F3EF] dark:bg-[#0F1E2C] flex items-start gap-2">
        <span className="text-[10px] text-[#9E9A93] flex-shrink-0 mt-0.5">ⓘ</span>
        <p className="text-[10px] text-[#9E9A93] leading-relaxed">
          <span className="font-medium">Exposition devises :</span> {deviseText || '—'}. Le risque de change n'est pas inclus dans le score — il dépend de votre domicile fiscal et de votre horizon d'investissement.
        </p>
      </div>

      {/* Recommendations */}
      {recs.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[#DDD9D1] dark:border-[#1e3347] space-y-1.5">
          {recs.map((r, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-[#5C6880]">
              <span className="mt-0.5 flex-shrink-0 text-[#B5820F]">›</span>
              <span>{r}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Chart: Allocation ────────────────────────────────────────────────────────
function AllocChart({ data }: { data: PositionCalc[] }) {
  const totalVal = data.reduce((s, p) => s + p.valeurCHF, 0)
  if (totalVal <= 0) return null
  const byCategory = CATEGORIES
    .map(cat => ({ cat, val: data.filter(p => p.categorie === cat).reduce((s, p) => s + p.valeurCHF, 0), color: CAT_COLOR[cat] }))
    .filter(c => c.val > 0).sort((a, b) => b.val - a.val)
  return (
    <div className="space-y-2.5">
      {byCategory.map(({ cat, val, color }) => {
        const pct = (val / totalVal) * 100
        return (
          <div key={cat}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[#5C6880]">{cat}</span>
              <span className="font-mono text-[#1B3050] dark:text-[#E8E4DC]">
                {val.toLocaleString('fr-CH', { maximumFractionDigits: 0 })} CHF
                <span className="text-[#9E9A93] ml-1">({pct.toFixed(0)}%)</span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-[#F5F3EF] dark:bg-[#0F1E2C]">
              <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function PortfolioPage() {
  const [positions, setPositions] = useState<Position[]>([])
  const [activeTab, setActiveTab] = useState<'positions' | 'analyse'>('positions')
  const [chartMode, setChartMode] = useState<'evol' | 'pnl'>('evol')
  const [pnlShowNominal, setPnlShowNominal] = useState(true)
  const [pnlShowReel, setPnlShowReel] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<Position, 'id'>>(EMPTY_FORM)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [fetchingModal, setFetchingModal] = useState(false)
  const [fetchModalError, setFetchModalError] = useState<string | null>(null)
  const [fetchingAchat, setFetchingAchat] = useState(false)
  const [manuel, setManuel] = useState(false)

  // Profil courtier actif (basé sur form.courtier)
  const brokerProfile = form.courtier ? BROKER_PROFILES[form.courtier] : null

  // Types Yahoo Finance par catégorie
  const CATEGORY_TYPES: Record<string, string[]> = {
    'Actions':            ['EQUITY'],
    'ETF':                ['ETF'],
    'Obligations':        ['ETF', 'MUTUALFUND'],
    'Matières premières': ['FUTURE', 'ETF'],
    'Crypto':             ['CRYPTOCURRENCY'],
    'Monnaies':          ['CURRENCY'],
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

  useEffect(() => {
    try { const raw = localStorage.getItem('finveria_portfolio'); if (raw) setPositions(JSON.parse(raw)) } catch {}
  }, [])
  useEffect(() => {
    try { localStorage.setItem('finveria_portfolio', JSON.stringify(positions)) } catch {}
  }, [positions])

  // ── Refresh global ──────────────────────────────────────────────────────────
  async function refreshPrices() {
    setRefreshing(true); setRefreshError(null)
    const results = await Promise.allSettled(positions.map(async (p) => {
      if (!p.ticker.trim()) return p
      const res = await fetch(`/api/prices?ticker=${encodeURIComponent(p.ticker)}&devise=${p.devise}`)
      if (!res.ok) return p
      const data = await res.json()
      return { ...p, ...(data.price != null ? { prixActuel: data.price } : {}), ...(data.fxRate != null ? { tauxActuelCHF: data.fxRate } : {}), derniereMaj: new Date().toISOString() }
    }))
    setPositions(results.map((r, i) => r.status === 'fulfilled' ? r.value : positions[i]))
    const errCount = results.filter(r => r.status === 'rejected').length
    if (errCount > 0) setRefreshError(`${errCount} position(s) non mises à jour.`)
    setRefreshing(false)
  }

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
  const positionsCalc: PositionCalc[] = useMemo(() => positions.map(p => {
    const coutCHF = p.quantite * p.prixAchat * p.tauxAchatCHF
    const valeurCHF = p.quantite * p.prixActuel * p.tauxActuelCHF
    const gainCHF = valeurCHF - coutCHF
    const gainPctCHF = coutCHF > 0 ? (gainCHF / coutCHF) * 100 : 0
    const gainDevise = p.quantite * (p.prixActuel - p.prixAchat)
    const gainPctDevise = p.prixAchat > 0 ? ((p.prixActuel - p.prixAchat) / p.prixAchat) * 100 : 0
    const impactFX = p.devise === 'CHF' ? 0 : p.quantite * p.prixActuel * (p.tauxActuelCHF - p.tauxAchatCHF)
    const inflation = inflationCumulee(p.dateAchat)
    const gainReel = valeurCHF - coutCHF * (1 + inflation)
    const gainPctReel = coutCHF > 0 ? (gainReel / coutCHF) * 100 : 0
    return { ...p, coutCHF, valeurCHF, gainCHF, gainPctCHF, gainDevise, gainPctDevise, impactFX, gainReel, gainPctReel }
  }), [positions])

  const totals = useMemo(() => {
    const coutTotal = positionsCalc.reduce((s, p) => s + p.coutCHF, 0)
    const valeurTotal = positionsCalc.reduce((s, p) => s + p.valeurCHF, 0)
    const gainTotal = valeurTotal - coutTotal
    const gainPct = coutTotal > 0 ? (gainTotal / coutTotal) * 100 : 0
    const fxTotal = positionsCalc.reduce((s, p) => s + p.impactFX, 0)
    const gainReelTotal = positionsCalc.reduce((s, p) => s + p.gainReel, 0)
    const gainReelPct = coutTotal > 0 ? (gainReelTotal / coutTotal) * 100 : 0
    return { coutTotal, valeurTotal, gainTotal, gainPct, fxTotal, gainReelTotal, gainReelPct }
  }, [positionsCalc])

  // ── Modal ───────────────────────────────────────────────────────────────────
  function openAdd() { setEditId(null); setForm(EMPTY_FORM); setFetchModalError(null); setManuel(false); setShowModal(true) }
  function openEdit(p: Position) { setEditId(p.id); setForm({ ...p }); setFetchModalError(null); setManuel(true); setShowModal(true) }
  function saveForm() {
    if (!form.ticker) return
    if (editId) setPositions(ps => ps.map(p => p.id === editId ? { ...form, id: editId } : p))
    else setPositions(ps => [...ps, { ...form, id: crypto.randomUUID() }])
    setShowModal(false)
  }
  function deletePosition(id: string) {
    if (!confirm('Supprimer cette position ?')) return
    setPositions(ps => ps.filter(p => p.id !== id))
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
  const isEmpty = positions.length === 0
  const lastMaj = positions.map(p => p.derniereMaj).filter(Boolean).sort().pop()

  const inputCls = `w-full bg-white dark:bg-[#1B2D3E] border border-[#DDD9D1] dark:border-[#2a3f52]
    rounded-lg px-3 py-2 text-sm text-[#1B3050] dark:text-[#E8E4DC]
    focus:outline-none focus:ring-2 focus:ring-[#2B6B5A] focus:border-transparent placeholder-[#9E9A93]`

  return (
    <div className="min-h-screen bg-[#F5F3EF] dark:bg-[#0F1E2C] text-[#1B3050] dark:text-[#E8E4DC]">
      <nav className="border-b border-[#DDD9D1] dark:border-[#1e3347] bg-white dark:bg-[#162534] px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-lg font-semibold tracking-tight text-[#1B3050] dark:text-white">
          fin<span className="text-[#2B6B5A]">veria</span>
        </Link>
        <div className="flex gap-4 text-sm">
          <Link href="/comparateur" className="text-[#5C6880] hover:text-[#1B3050] dark:hover:text-white transition-colors">Comparateur</Link>
          <Link href="/simulateur" className="text-[#5C6880] hover:text-[#1B3050] dark:hover:text-white transition-colors">Simulateur</Link>
          <Link href="/portfolio" className="text-[#2B6B5A] font-medium">Portfolio</Link>
        </div>
      </nav>

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
                          <p className="text-white/70 leading-relaxed">Différence entre la valeur actuelle et le coût d'achat, tout converti en CHF. Inclut à la fois la performance de l'actif et l'effet des variations de taux de change.</p>
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
                    <p className="text-xs font-semibold text-[#5C6880] uppercase tracking-wider">Gain réel (inflation)</p>
                    <div className="relative group">
                      <span className="w-4 h-4 rounded-full bg-[#DDD9D1] dark:bg-[#2a3f52] text-[#5C6880] text-[10px] font-bold flex items-center justify-center cursor-default select-none">?</span>
                      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 z-50 hidden group-hover:block pointer-events-none">
                        <div className="bg-[#1B3050] dark:bg-[#0F1E2C] text-white text-xs rounded-xl p-3 shadow-xl space-y-2">
                          <p className="font-semibold text-white/90">Gain réel après inflation</p>
                          <p className="text-white/70 leading-relaxed">Le gain nominal diminué de l'inflation estimée (2 % annuel). Reflète le vrai pouvoir d'achat gagné ou perdu depuis l'achat.</p>
                          <div className="border-t border-white/20 pt-2">
                            <p className="text-white/60 text-[11px] mb-1">Dont érosion par l'inflation :</p>
                            <p className="font-mono font-semibold text-orange-400">
                              -{chf(Math.abs(totals.gainTotal - totals.gainReelTotal))}{' '}
                              <span className="text-[11px] opacity-80">({totals.gainTotal !== 0 ? (Math.abs(totals.gainTotal - totals.gainReelTotal) / Math.abs(totals.gainTotal) * 100).toFixed(2) : '0.00'} %)</span>
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
              </div>

              <div className="lg:col-span-2 space-y-4">
                <div className="bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold">{chartMode === 'evol' ? 'Évolution du portefeuille' : 'PnL cumulé'}</h3>
                    <div className="flex items-center gap-2">
                      {chartMode === 'pnl' && (
                        <div className="flex items-center gap-3 mr-2">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={pnlShowNominal} onChange={e => setPnlShowNominal(e.target.checked)}
                              className="w-3.5 h-3.5 accent-[#2B6B5A] rounded" />
                            <span className="text-xs text-[#2B6B5A] font-medium">Nominal</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={pnlShowReel} onChange={e => setPnlShowReel(e.target.checked)}
                              className="w-3.5 h-3.5 accent-[#1B5C80] rounded" />
                            <span className="text-xs text-[#1B5C80] font-medium">Réel</span>
                          </label>
                        </div>
                      )}
                      <div className="flex bg-[#F5F3EF] dark:bg-[#1B2D3E] rounded-lg p-0.5 gap-0.5">
                        {(['evol', 'pnl'] as const).map(m => (
                          <button key={m} onClick={() => setChartMode(m)}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${chartMode === m ? 'bg-white dark:bg-[#162534] text-[#1B3050] dark:text-white shadow-sm' : 'text-[#9E9A93] hover:text-[#5C6880]'}`}>
                            {m === 'evol' ? 'Évolution' : 'PnL'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {chartMode === 'evol'
                    ? <EvolChart data={positionsCalc} />
                    : <PnLChart data={positionsCalc} showNominal={pnlShowNominal} showReel={pnlShowReel} />
                  }
                  <p className="text-xs text-[#9E9A93] mt-2">
                    {chartMode === 'evol' ? 'Valeur mensuelle réelle du portefeuille depuis le premier achat.' : 'Gain mensuel cumulé basé sur les prix historiques réels.'}
                  </p>
                </div>
                <div className="bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-5">
                  <h3 className="text-sm font-semibold mb-4">Allocation par catégorie</h3>
                  <AllocChart data={positionsCalc} />
                </div>
              </div>
            </div>

            <PortfolioHealth data={positionsCalc} />
            <div className="flex gap-1 mb-4 bg-white dark:bg-[#162534] p-1 rounded-lg border border-[#DDD9D1] dark:border-[#1e3347] w-fit">
              {(['positions', 'analyse'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-[#2B6B5A] text-white' : 'text-[#5C6880] hover:text-[#1B3050] dark:hover:text-white'}`}>
                  {tab === 'positions' ? 'Positions' : 'Analyse FX & Inflation'}
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
                      {positionsCalc.map(p => (
                        <tr key={p.id} className="hover:bg-[#F5F3EF]/50 dark:hover:bg-[#1B2D3E]/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-medium">{p.nom}</div>
                            <div className="text-xs text-[#9E9A93]">{p.ticker} · {p.categorie}</div>
                          </td>

                          <td className="px-4 py-3 font-mono text-xs">{p.quantite}</td>
                          <td className="px-4 py-3 font-mono text-xs">
                            <div>{p.prixActuel.toLocaleString('fr-CH', { maximumFractionDigits: 2 })} {p.devise}</div>
                            {p.devise !== 'CHF' && <div className="text-[#9E9A93]">×{p.tauxActuelCHF.toFixed(4)}</div>}
                          </td>
                          <td className="px-4 py-3 font-mono">
                            <div>{chf(p.valeurCHF)}</div>
                            <div className="text-xs text-[#9E9A93]">Coût: {chf(p.coutCHF)}</div>
                          </td>
                          <td className={`px-4 py-3 font-mono ${clr(p.gainCHF)}`}>{p.gainCHF >= 0 ? '+' : ''}{chf(p.gainCHF)}</td>
                          <td className={`px-4 py-3 font-mono font-semibold ${clr(p.gainPctCHF)}`}>{pct(p.gainPctCHF)}</td>
                          <td className="px-4 py-3 text-xs text-[#9E9A93]">
                            {p.derniereMaj ? new Date(p.derniereMaj).toLocaleString('fr-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button onClick={() => openEdit(p)} className="text-xs text-[#2B6B5A] hover:underline">Modifier</button>
                              <button onClick={() => deletePosition(p.id)} className="text-xs text-red-400 hover:underline">Supprimer</button>
                            </div>
                          </td>
                        </tr>
                      ))}
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
                        {['Position', 'Perf. devise', 'Perf. CHF', 'Impact FX', 'Perf. réelle'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#5C6880] uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F5F3EF] dark:divide-[#1e3347]">
                      {positionsCalc.map(p => (
                        <tr key={p.id} className="hover:bg-[#F5F3EF]/50 dark:hover:bg-[#1B2D3E]/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-medium">{p.nom}</div>
                            <div className="text-xs text-[#9E9A93]">{p.ticker} · {p.dateAchat}</div>
                          </td>
                          <td className={`px-4 py-3 font-mono ${clr(p.gainPctDevise)}`}>
                            <div>{pct(p.gainPctDevise)}</div>
                            <div className="text-xs text-[#9E9A93]">{p.gainDevise >= 0 ? '+' : ''}{p.gainDevise.toFixed(2)} {p.devise}</div>
                          </td>
                          <td className={`px-4 py-3 font-mono ${clr(p.gainPctCHF)}`}>
                            <div>{pct(p.gainPctCHF)}</div>
                            <div className="text-xs text-[#9E9A93]">{p.gainCHF >= 0 ? '+' : ''}{chf(p.gainCHF)}</div>
                          </td>
                          <td className={`px-4 py-3 font-mono ${clr(p.impactFX)}`}>
                            {p.devise === 'CHF' ? <span className="text-[#9E9A93]">—</span> : <>{p.impactFX >= 0 ? '+' : ''}{chf(p.impactFX)}</>}
                          </td>
                          <td className={`px-4 py-3 font-mono font-semibold ${clr(p.gainPctReel)}`}>
                            <div>{pct(p.gainPctReel)}</div>
                            <div className="text-xs text-[#9E9A93]">{p.gainReel >= 0 ? '+' : ''}{chf(p.gainReel)}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#DDD9D1] dark:border-[#1e3347]">
              <h2 className="font-semibold">{editId ? 'Modifier la position' : 'Ajouter une position'}</h2>
              <button onClick={() => setShowModal(false)} className="text-[#9E9A93] hover:text-[#1B3050] dark:hover:text-white text-xl">×</button>
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
                  onChange={({ ticker, nom, devise, type }) => {
                    const TYPE_TO_CAT: Record<string, string> = {
                      'equity': 'Actions', 'etf': 'ETF',
                      'cryptocurrency': 'Crypto', 'future': 'Matières premières',
                      'futures': 'Matières premières', 'currency': 'Monnaies',
                      'mutual fund': 'Obligations', 'mutualfund': 'Obligations',
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
                  <input className={inputCls} type="number" step="0.0000000001" min="0"
                    placeholder="ex: 0.00000050" value={form.quantite || ''} onChange={fld('quantite')} />
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

              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowModal(false)}
                  className="flex-1 border border-[#DDD9D1] dark:border-[#2a3f52] text-[#5C6880] text-sm py-2 rounded-lg hover:bg-[#F5F3EF] dark:hover:bg-[#1B2D3E] transition-colors">
                  Annuler
                </button>
                <button onClick={saveForm} disabled={!form.ticker && !form.nom}
                  className="flex-1 bg-[#2B6B5A] hover:bg-[#225549] disabled:opacity-40 text-white text-sm py-2 rounded-lg transition-colors font-medium">
                  {editId ? 'Enregistrer' : 'Ajouter'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
