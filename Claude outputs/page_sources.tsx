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
function EvolChart({ data, onData }: { data: PositionCalc[]; onData?: (pts: { value: number; cost: number; label: string }[]) => void }) {
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
      if (!cancelled) { setMonthlyPts(result); setLoading(false); if (onData) onData(result) }
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

// ─── Chart: Drawdown ──────────────────────────────────────────────────────────
function DrawdownChart({ pts }: { pts: { x: number; cost: number; value: number; label: string }[] }) {
  const W = 600, H = 220, PAD = { t: 16, r: 16, b: 36, l: 64 }
  const iW = W - PAD.l - PAD.r, iH = H - PAD.t - PAD.b
  const [hoverIdx, setHoverIdx] = React.useState<number | null>(null)

  // Calcul de la série de drawdown
  const ddPts = React.useMemo(() => {
    let peak = pts[0]?.value ?? 0
    return pts.map(p => {
      if (p.value > peak) peak = p.value
      const dd = peak > 0 ? (p.value - peak) / peak * 100 : 0
      return { x: p.x, dd, label: p.label }
    })
  }, [pts])

  if (ddPts.length < 2) return null

  const minDD = Math.min(...ddPts.map(p => p.dd), -0.1)
  const span = Math.abs(minDD) || 1
  const px = (t: number) => PAD.l + t * iW
  const py = (v: number) => PAD.t + iH - ((v - minDD) / (0 - minDD)) * iH

  const pathD = ddPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${px(p.x)} ${py(p.dd)}`).join(' ')
  const areaD = `${pathD} L ${px(ddPts[ddPts.length - 1].x)} ${PAD.t + iH} L ${px(ddPts[0].x)} ${PAD.t + iH} Z`
  const tickVals = [0, minDD * 0.25, minDD * 0.5, minDD * 0.75, minDD]
  const hovered = hoverIdx !== null ? ddPts[hoverIdx] : null

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}
      onMouseLeave={() => setHoverIdx(null)}
      onMouseMove={e => {
        const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
        const mx = (e.clientX - rect.left) / rect.width * W
        const t = (mx - PAD.l) / iW
        let best = 0, bd = Infinity
        ddPts.forEach((p, i) => { const d = Math.abs(p.x - t); if (d < bd) { bd = d; best = i } })
        setHoverIdx(best)
      }}>
      {tickVals.map((v, i) => (
        <g key={i}>
          <line x1={PAD.l} x2={W - PAD.r} y1={py(v)} y2={py(v)} stroke="#DDD9D1" strokeWidth="0.5" strokeDasharray={v === 0 ? '' : '4 3'} className="dark:stroke-[#1e3347]"/>
          <text x={PAD.l - 4} y={py(v) + 4} textAnchor="end" fontSize="9" fill="#8899AA">{v.toFixed(1)}%</text>
        </g>
      ))}
      <path d={areaD} fill="#EF4444" fillOpacity="0.15"/>
      <path d={pathD} fill="none" stroke="#EF4444" strokeWidth="1.5"/>
      {/* Ligne zéro */}
      <line x1={PAD.l} x2={W - PAD.r} y1={py(0)} y2={py(0)} stroke="#EF4444" strokeWidth="0.5" strokeOpacity="0.4"/>
      {hovered && (
        <g>
          <line x1={px(hovered.x)} x2={px(hovered.x)} y1={PAD.t} y2={PAD.t + iH} stroke="#8899AA" strokeWidth="0.8" strokeDasharray="4 3"/>
          <circle cx={px(hovered.x)} cy={py(hovered.dd)} r="3" fill="#EF4444" stroke="white" strokeWidth="1.5"/>
          <rect x={Math.min(px(hovered.x) + 6, W - 110)} y={py(hovered.dd) - 22} width="104" height="18" rx="4" fill="#1B3050" fillOpacity="0.9"/>
          <text x={Math.min(px(hovered.x) + 58, W - 58)} y={py(hovered.dd) - 10} textAnchor="middle" fontSize="10" fill="white">{hovered.label} : {hovered.dd.toFixed(2)} %</text>
        </g>
      )}
      <text x={px(0)} y={H - 6} textAnchor="middle" fontSize="10" fill="#9E9A93">{pts[0]?.label}</text>
      <text x={px(1)} y={H - 6} textAnchor="middle" fontSize="10" fill="#9E9A93">Auj.</text>
    </svg>
  )
}

function PnLChart({ data, showNominal, showReel, showDividends, dividendHistory }: {
  data: PositionCalc[]
  showNominal: boolean
  showReel: boolean
  showDividends?: boolean
  dividendHistory?: Record<string, { ts: number; amount: number }[]>
}) {
  const W = 600, H = 220, PAD = { t: 16, r: 16, b: 36, l: 64 }
  const iW = W - PAD.l - PAD.r, iH = H - PAD.t - PAD.b

  const [monthlyPts, setMonthlyPts] = useState<{ x: number; nominal: number; reel: number; divCumul: number; label: string }[] | null>(null)
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
      const result: { x: number; nominal: number; reel: number; divCumul: number; label: string }[] = []

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

        let nominal = 0, reel = 0, divCumul = 0
        const monthTs = new Date(monthDate).getTime() / 1000
        for (let j = 0; j < activePosns.length; j++) {
          const p = activePosns[j]
          const valCHF = p.quantite * prices[j].price * prices[j].fxRate
          const infAdj = p.coutCHF * (1 + inflationBetween(p.dateAchat, monthDate))
          nominal += valCHF - p.coutCHF
          reel    += valCHF - infAdj
          // Cumul dividendes depuis dateAchat jusqu'à monthDate
          const purchaseTs = new Date(p.dateAchat).getTime() / 1000
          const divs = dividendHistory?.[p.ticker] ?? []
          const divSum = divs
            .filter(d => d.ts >= purchaseTs && d.ts <= monthTs)
            .reduce((s, d) => s + d.amount, 0)
          divCumul += p.quantite * divSum * p.tauxActuelCHF
        }

        const t = (new Date(monthDate).getTime() - firstDate.getTime()) / totalMs
        result.push({ x: isToday ? 1 : Math.min(t, 0.98), nominal, reel, divCumul, label: monthDate.slice(0, 7) })
        setProgress(Math.round((i + 1) / months.length * 100))
      }
      if (!cancelled) { setMonthlyPts(result); setLoading(false) }
    }
    fetchAll()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey, dividendHistory])

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
    if (showDividends) arr.push(p.divCumul)
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
      {showDividends && points.length >= 2 && (
        <>
          {points.slice(0, -1).map((p0, i) => {
            const p1 = points[i + 1]
            return <line key={i} x1={px(p0.x)} y1={py(p0.divCumul)} x2={px(p1.x)} y2={py(p1.divCumul)} stroke="#B5820F" strokeWidth="1.5" strokeLinecap="round" />
          })}
          <circle cx={px(points[points.length-1].x)} cy={py(points[points.length-1].divCumul)} r="3.5" fill="#B5820F" />
        </>
      )}
      <text x={px(0)} y={H - 6} textAnchor="middle" fontSize="10" fill="#9E9A93">{points[0].label}</text>
      <text x={px(1)} y={H - 6} textAnchor="middle" fontSize="10" fill="#9E9A93">Auj.</text>
      <g transform={`translate(${PAD.l + 8}, ${PAD.t + 6})`}>
        {showNominal && <><line x1="0" y1="6" x2="9" y2="6" stroke="#2B6B5A" strokeWidth="2" /><line x1="9" y1="6" x2="18" y2="6" stroke="#DC2626" strokeWidth="2" /><text x="22" y="10" fontSize="10" fill="#9E9A93">Gain nominal</text></>}
        {showReel && <><line x1={showNominal ? 104 : 0} y1="6" x2={showNominal ? 113 : 9} y2="6" stroke="#1B5C80" strokeWidth="1.5" strokeDasharray="5 3" /><line x1={showNominal ? 113 : 9} y1="6" x2={showNominal ? 122 : 18} y2="6" stroke="#DC2626" strokeWidth="1.5" strokeDasharray="5 3" /><text x={showNominal ? 126 : 22} y="10" fontSize="10" fill="#9E9A93">Gain réel</text></>}
        {showDividends && (() => { const xOff = (showNominal ? 104 : 0) + (showReel ? 90 : 0); return <><line x1={xOff} y1="6" x2={xOff + 18} y2="6" stroke="#B5820F" strokeWidth="1.5" /><text x={xOff + 22} y="10" fontSize="10" fill="#9E9A93">Dividendes</text></> })()}
      </g>
    </svg>
  )
}


const CATS = ['Obligations', 'ETF', 'Actions', 'Matières premières', 'Monnaies', 'Crypto']
const CAT_VOL: Record<string, number> = {
  'Obligations': 0.08, 'ETF': 0.15, 'Actions': 0.25,
  'Matières premières': 0.20, 'Monnaies': 0.12, 'Crypto': 0.70,
}
const CORR: Record<string, Record<string, number>> = {
  'Obligations':        { 'Obligations': 1.00, 'ETF': -0.10, 'Actions': -0.05, 'Matières premières':  0.05, 'Monnaies': -0.15, 'Crypto':  0.00 },
  'ETF':                { 'Obligations': -0.10, 'ETF': 1.00, 'Actions':  0.80, 'Matières premières':  0.30, 'Monnaies':  0.10, 'Crypto':  0.20 },
  'Actions':            { 'Obligations': -0.05, 'ETF': 0.80, 'Actions':  1.00, 'Matières premières':  0.20, 'Monnaies':  0.05, 'Crypto':  0.25 },
  'Matières premières': { 'Obligations':  0.05, 'ETF': 0.30, 'Actions':  0.20, 'Matières premières':  1.00, 'Monnaies':  0.15, 'Crypto':  0.10 },
  'Monnaies':           { 'Obligations': -0.15, 'ETF': 0.10, 'Actions':  0.05, 'Matières premières':  0.15, 'Monnaies':  1.00, 'Crypto':  0.05 },
  'Crypto':             { 'Obligations':  0.00, 'ETF': 0.20, 'Actions':  0.25, 'Matières premières':  0.10, 'Monnaies':  0.05, 'Crypto':  1.00 },
}

// ─── Chart: Allocation (donut) ───────────────────────────────────
function AllocChart({ data }: { data: PositionCalc[] }) {
  const [hovered, setHovered] = React.useState<string | null>(null)
  const totalVal = data.reduce((s, p) => s + p.valeurCHF, 0)
  if (totalVal <= 0) return null

  const byCategory = CATEGORIES
    .map(cat => ({ cat, val: data.filter(p => p.categorie === cat).reduce((s, p) => s + p.valeurCHF, 0), color: CAT_COLOR[cat] }))
    .filter(c => c.val > 0).sort((a, b) => b.val - a.val)

  // Construit les arcs du donut
  const R = 80, r = 50, cx = 100, cy = 100
  const gap = 0.018 // gap en radians entre segments
  let cumAngle = -Math.PI / 2

  const segments = byCategory.map(({ cat, val, color }) => {
    const pct = val / totalVal
    const angle = pct * 2 * Math.PI - gap
    const startAngle = cumAngle + gap / 2
    const endAngle = startAngle + angle
    cumAngle += pct * 2 * Math.PI

    const x1 = cx + R * Math.cos(startAngle), y1 = cy + R * Math.sin(startAngle)
    const x2 = cx + R * Math.cos(endAngle),   y2 = cy + R * Math.sin(endAngle)
    const x3 = cx + r * Math.cos(endAngle),   y3 = cy + r * Math.sin(endAngle)
    const x4 = cx + r * Math.cos(startAngle), y4 = cy + r * Math.sin(startAngle)
    const large = angle > Math.PI ? 1 : 0
    const d = `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${r} ${r} 0 ${large} 0 ${x4} ${y4} Z`

    return { cat, val, pct, color, d, startAngle, endAngle }
  })

  const hov = hovered ? segments.find(s => s.cat === hovered) : null

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Donut SVG */}
      <div className="relative">
        <svg width="200" height="200" viewBox="0 0 200 200">
          {segments.map(seg => (
            <path
              key={seg.cat}
              d={seg.d}
              fill={seg.color}
              opacity={hovered && hovered !== seg.cat ? 0.35 : 1}
              style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
              onMouseEnter={() => setHovered(seg.cat)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
          {/* Centre : label survolé ou total */}
          <text x="100" y="94" textAnchor="middle" fontSize="11" fill="currentColor" opacity="0.5">
            {hov ? hov.cat : 'Total'}
          </text>
          <text x="100" y="110" textAnchor="middle" fontSize="13" fontWeight="600" fill="currentColor">
            {hov
              ? `${(hov.pct * 100).toFixed(1)}%`
              : `${totalVal.toLocaleString('fr-CH', { maximumFractionDigits: 0 })}`
            }
          </text>
          {!hov && (
            <text x="100" y="122" textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.4">CHF</text>
          )}
        </svg>
      </div>

      {/* Légende */}
      <div className="w-full space-y-1.5">
        {byCategory.map(({ cat, val, color }) => {
          const pct = (val / totalVal) * 100
          const isHov = hovered === cat
          return (
            <div
              key={cat}
              className="flex items-center justify-between text-xs cursor-pointer"
              style={{ opacity: hovered && !isHov ? 0.4 : 1, transition: 'opacity 0.15s' }}
              onMouseEnter={() => setHovered(cat)}
              onMouseLeave={() => setHovered(null)}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <span className="text-[#5C6880] dark:text-[#7B8DA6] truncate">{cat}</span>
              </div>
              <span className="font-mono text-[#1B3050] dark:text-[#E8E4DC] ml-2 whitespace-nowrap">
                {val.toLocaleString('fr-CH', { maximumFractionDigits: 0 })} CHF
                <span className="text-[#9E9A93] ml-1">({pct.toFixed(0)}%)</span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Investor Profile ────────────────────────────────────────────────────────
const RF_RATE = 0.008
const MKT_ER  = 0.095
const BETA: Record<string, number> = {
  'Obligations': 0.05, 'ETF': 1.00, 'Actions': 1.25,
  'Matières premières': 0.55, 'Monnaies': 0.15, 'Crypto': 1.80,
}
const EXPECTED_RETURN: Record<string, number> = Object.fromEntries(
  Object.entries(BETA).map(([k, b]) => [k, RF_RATE + b * (MKT_ER - RF_RATE)])
)
const STRESS: { label: string; shocks: Record<string, number> }[] = [
  { label: 'Grande Crise Financière 2008', shocks: { 'Obligations': -0.03, 'ETF': -0.57, 'Actions': -0.75, 'Matières premières': -0.70, 'Monnaies': -0.10, 'Crypto': 0 } },
  { label: 'COVID-19 Mars 2020',           shocks: { 'Obligations':  0.05, 'ETF': -0.34, 'Actions': -0.45, 'Matières premières': -0.32, 'Monnaies':  0.00, 'Crypto': -0.50 } },
  { label: 'Choc taux 2022',               shocks: { 'Obligations': -0.20, 'ETF': -0.19, 'Actions': -0.25, 'Matières premières':  0.25, 'Monnaies':  0.08, 'Crypto': -0.75 } },
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

function InvestorProfileSection({
  data, profile, setProfile, onDividends, onDividendHistory, onMaxDrawdown,
}: {
  data: PositionCalc[]
  profile: InvProfile
  setProfile: React.Dispatch<React.SetStateAction<InvProfile>>
  onDividends?: (yields: Record<string, number>) => void
  onDividendHistory?: (h: Record<string, { ts: number; amount: number }[]>) => void
  onMaxDrawdown?: (dd: { pct: number; valueCHF: number; startDate: string; endDate: string } | null) => void
}) {
  const [tab, setTab] = React.useState<'stats' | 'montecarlo' | 'stress' | 'frontier' | 'sources'>('stats')
  const [mcFX,       setMcFX]       = React.useState(false)
  const [frontierFX, setFrontierFX] = React.useState(false)
  const [stressFX,   setStressFX]   = React.useState(false)

  const hasPositions = data.length > 0
  const total = data.reduce((s, p) => s + p.valeurCHF, 0)

  // ── Poids par catégorie ──
  const catWeights = React.useMemo(() => {
    const w: Record<string, number> = {}
    if (total <= 0) return w
    for (const p of data) w[p.categorie] = (w[p.categorie] ?? 0) + p.valeurCHF / total
    return w
  }, [data, total])

  // ── Métriques historiques (Yahoo Finance) ──────────────────────────────────
  const [histStats, setHistStats] = React.useState<{
    sigma: number; er: number; var95: number; cvar95: number; var95m: number; sharpe: number
    period: string; months: number
    assetPeriods: Record<string, { start: string; end: string; months: number }>
    excluded: { ticker: string; nom: string; months: number }[]
    reducing: { ticker: string; nom: string; start: string; reducedBy: number }[]
    tickerStats: Record<string, { er: number; sigma: number; weight: number; nom: string; categorie: string }>
    corrMatrix: Record<string, Record<string, number>>
    chf?: {
      sigma: number; er: number; var95: number; cvar95: number; var95m: number; sharpe: number
      tickerStats: Record<string, { er: number; sigma: number; weight: number; nom: string; categorie: string }>
      corrMatrix: Record<string, Record<string, number>>
    }
  } | null>(null)
  const [histLoading, setHistLoading] = React.useState(false)
  const [divYields, setDivYields] = React.useState<Record<string, number>>({})
  const [expSrcTickers, setExpSrcTickers] = React.useState<Set<string>>(new Set())
  const toggleSrcTicker = (ticker: string) => setExpSrcTickers(prev => {
    const n = new Set(prev); n.has(ticker) ? n.delete(ticker) : n.add(ticker); return n
  })
  const [showQuestionnaire, setShowQuestionnaire] = React.useState(true)

  const _histKey = React.useMemo(
    () => data.map(p => p.ticker + '|' + p.valeurCHF.toFixed(2)).join(','),
    [data]
  )

  React.useEffect(() => {
    if (!hasPositions) return
    const tickers = [...new Set(data.map(p => p.ticker))].filter(Boolean)
    if (!tickers.length) return
    setHistLoading(true)
    const fxTickers = ['USDCHF=X', 'EURCHF=X']
    fetch(`/api/history?tickers=${[...tickers, ...fxTickers].join(',')}`)
      .then(r => r.json())
      .then((raw: Record<string, { dates: string[]; closes: number[]; dividendTTM?: number }>) => {
        // ── Dividend yields par ticker ─────────────────────────────────────────
        const ylds: Record<string, number> = {}
        for (const p of data) {
          const entry = raw[p.ticker]
          if (!entry || !entry.dividendTTM || entry.dividendTTM <= 0) continue
          const lastClose = entry.closes[entry.closes.length - 1]
          if (lastClose > 0) ylds[p.ticker] = entry.dividendTTM / lastClose
        }
        setDivYields(ylds)
        if (onDividends) onDividends(ylds)
        if (onDividendHistory) {
          const histMap: Record<string, { ts: number; amount: number }[]> = {}
          for (const t of Object.keys(raw)) {
            const divs = (raw[t] as any).dividends
            if (Array.isArray(divs) && divs.length > 0) histMap[t] = divs
          }
          onDividendHistory(histMap)
        }

        // Poids par ticker (valeur CHF)
        const weights: Record<string, number> = {}
        if (total > 0) for (const p of data) {
          weights[p.ticker] = (weights[p.ticker] ?? 0) + p.valeurCHF / total
        }
        const allActive = Object.keys(weights).filter(t => raw[t])
        if (!allActive.length) return

        // Retours mensuels par ticker + longueur historique
        const rets: Record<string, Record<string, number>> = {}
        const tickerMonths: Record<string, number> = {}
        const tickerStart: Record<string, string> = {}
        for (const t of allActive) {
          const { dates, closes } = raw[t]
          const r: Record<string, number> = {}
          for (let i = 1; i < dates.length; i++) {
            if (closes[i] > 0 && closes[i - 1] > 0)
              r[dates[i]] = closes[i] / closes[i - 1] - 1
          }
          rets[t] = r
          const vd = Object.keys(r).sort()
          tickerMonths[t] = vd.length
          if (vd.length) tickerStart[t] = vd[0]
        }

        // Exclure les actifs avec < 10 ans (120 mois) d'historique
        const MIN_MONTHS = 120
        const excluded = allActive
          .filter(t => tickerMonths[t] < MIN_MONTHS)
          .map(t => {
            const pos = data.find(p => p.ticker === t)
            return { ticker: t, nom: pos?.nom ?? t, months: tickerMonths[t] ?? 0 }
          })
        const active = allActive.filter(t => tickerMonths[t] >= MIN_MONTHS)
        if (!active.length) return

        // Dates communes à tous les actifs inclus
        const sets = active.map(t => new Set(Object.keys(rets[t])))
        const common = [...sets[0]].filter(d => sets.every(s => s.has(d))).sort()
        if (common.length < 12) return

        const commonStart = common[0]
        // L'actif le plus ancien parmi les inclus
        const earliestPossible = active.map(t => tickerStart[t]).filter(Boolean).sort()[0]
        // Actifs qui réduisent la période (leur début = commonStart et ils limitent les autres)
        const reducing = active
          .filter(t => tickerStart[t] === commonStart && commonStart > earliestPossible)
          .map(t => {
            const pos = data.find(p => p.ticker === t)
            const reducedByMonths = Math.round(
              (new Date(commonStart).getTime() - new Date(earliestPossible).getTime()) / (30.44 * 24 * 3600 * 1000)
            )
            return { ticker: t, nom: pos?.nom ?? t, start: commonStart, reducedBy: reducedByMonths }
          })
          .filter(r => r.reducedBy >= 24) // significatif si >= 2 ans

        // Renormaliser les poids sur les actifs inclus uniquement
        const inclTotal = active.reduce((s, t) => s + (weights[t] ?? 0), 0)
        const normW: Record<string, number> = {}
        for (const t of active) normW[t] = (weights[t] ?? 0) / inclTotal

        // Retours portefeuille pondérés (poids constants = allocation actuelle normalisée)
        const portR = common.map(d =>
          active.reduce((s, t) => s + normW[t] * (rets[t]?.[d] ?? 0), 0)
        )
        const n = portR.length
        const meanM = portR.reduce((s, r) => s + r, 0) / n
        const erAnn = Math.pow(1 + meanM, 12) - 1
        const stdM  = Math.sqrt(portR.reduce((s, r) => s + (r - meanM) ** 2, 0) / (n - 1))
        const sigAnn = stdM * Math.sqrt(12)

        // VaR / CVaR historiques (simulation historique)
        const sorted = [...portR].sort((a, b) => a - b)
        const idx5  = Math.max(0, Math.floor(n * 0.05) - 1)
        const v95m  = sorted[idx5]
        const cv95m = sorted.slice(0, idx5 + 1).reduce((s, r) => s + r, 0) / (idx5 + 1)
        const v95Ann  = v95m  * Math.sqrt(12)
        const cv95Ann = cv95m * Math.sqrt(12)

        const sh = sigAnn > 0 ? (erAnn - RF_RATE) / sigAnn : 0
        const fmtM = (m: string) => {
          const [y, mo] = m.split('-')
          return `${mo}/${y}`
        }

        // Statistiques par ticker (période commune)
        const tickerStats: Record<string, { er: number; sigma: number; weight: number; nom: string; categorie: string }> = {}
        for (const t of active) {
          const trets = common.map(d => rets[t][d] ?? 0)
          const tMean = trets.reduce((s, r) => s + r, 0) / n
          const tStd  = Math.sqrt(trets.reduce((s, r) => s + (r - tMean) ** 2, 0) / Math.max(1, n - 1))
          const pos   = data.find(p => p.ticker === t)
          tickerStats[t] = {
            er: Math.pow(1 + tMean, 12) - 1,
            sigma: tStd * Math.sqrt(12),
            weight: normW[t] ?? 0,
            nom: pos?.nom ?? t,
            categorie: pos?.categorie ?? '',
          }
        }

        // Matrice de corrélations par paires (retours mensuels, période commune)
        const corrMatrix: Record<string, Record<string, number>> = {}
        for (const t1 of active) {
          corrMatrix[t1] = {}
          const r1 = common.map(d => rets[t1][d] ?? 0)
          const m1 = r1.reduce((s, r) => s + r, 0) / n
          const v1 = r1.reduce((s, r) => s + (r - m1) ** 2, 0) / Math.max(1, n - 1)
          for (const t2 of active) {
            if (t1 === t2) { corrMatrix[t1][t2] = 1; continue }
            const r2 = common.map(d => rets[t2][d] ?? 0)
            const m2 = r2.reduce((s, r) => s + r, 0) / n
            const v2 = r2.reduce((s, r) => s + (r - m2) ** 2, 0) / Math.max(1, n - 1)
            const cov = r1.reduce((s, r, i) => s + (r - m1) * (r2[i] - m2), 0) / Math.max(1, n - 1)
            corrMatrix[t1][t2] = v1 > 0 && v2 > 0 ? cov / Math.sqrt(v1 * v2) : 0
          }
        }

        // ── Ajustement taux de change CHF ────────────────────────────────
        const usdchfR: Record<string, number> = {}
        const eurchfR: Record<string, number> = {}
        const extractFXRets = (t: string, dest: Record<string, number>) => {
          if (!raw[t]) return
          const { dates: fd, closes: fc } = raw[t]
          for (let i = 1; i < fd.length; i++)
            if (fc[i] > 0 && fc[i - 1] > 0) dest[fd[i]] = fc[i] / fc[i - 1] - 1
        }
        extractFXRets('USDCHF=X', usdchfR)
        extractFXRets('EURCHF=X', eurchfR)
        const getCurrency = (t: string): 'CHF' | 'EUR' | 'USD' => {
          if (/\.(SW|VX)$/i.test(t)) return 'CHF'
          if (/\.(PA|DE|MI|AS|BR|LS|MC|F|HE|CO|ST|OL|AT|VIE)$/i.test(t)) return 'EUR'
          return 'USD'
        }
        const retsCHF: Record<string, Record<string, number>> = {}
        for (const t of active) {
          const curr = getCurrency(t)
          if (curr === 'CHF') { retsCHF[t] = rets[t]; continue }
          const fxR = curr === 'EUR' ? eurchfR : usdchfR
          retsCHF[t] = {}
          for (const d of common) {
            const r = rets[t][d] ?? 0, fx = fxR[d] ?? 0
            retsCHF[t][d] = (1 + r) * (1 + fx) - 1
          }
        }
        const portRCHF = common.map(d =>
          active.reduce((s, t) => s + normW[t] * (retsCHF[t]?.[d] ?? 0), 0)
        )
        const meanMC = portRCHF.reduce((s, r) => s + r, 0) / n
        const erAnnC = Math.pow(1 + meanMC, 12) - 1
        const stdMC  = Math.sqrt(portRCHF.reduce((s, r) => s + (r - meanMC) ** 2, 0) / Math.max(1, n - 1))
        const sigAnnC = stdMC * Math.sqrt(12)
        const sortedC = [...portRCHF].sort((a, b) => a - b)
        const v95mC  = sortedC[idx5]
        const cv95mC = sortedC.slice(0, idx5 + 1).reduce((s, r) => s + r, 0) / (idx5 + 1)
        const v95AnnC  = v95mC  * Math.sqrt(12)
        const cv95AnnC = cv95mC * Math.sqrt(12)
        const shC = sigAnnC > 0 ? (erAnnC - RF_RATE) / sigAnnC : 0
        const tickerStatsCHF: Record<string, { er: number; sigma: number; weight: number; nom: string; categorie: string }> = {}
        for (const t of active) {
          const tr = common.map(d => retsCHF[t][d] ?? 0)
          const tM = tr.reduce((s, r) => s + r, 0) / n
          const tS = Math.sqrt(tr.reduce((s, r) => s + (r - tM) ** 2, 0) / Math.max(1, n - 1))
          const pos = data.find(p => p.ticker === t)
          tickerStatsCHF[t] = { er: Math.pow(1 + tM, 12) - 1, sigma: tS * Math.sqrt(12), weight: normW[t] ?? 0, nom: pos?.nom ?? t, categorie: pos?.categorie ?? '' }
        }
        const corrMatrixCHF: Record<string, Record<string, number>> = {}
        for (const t1 of active) {
          corrMatrixCHF[t1] = {}
          const r1c = common.map(d => retsCHF[t1][d] ?? 0)
          const m1c = r1c.reduce((s, r) => s + r, 0) / n
          const v1c = r1c.reduce((s, r) => s + (r - m1c) ** 2, 0) / Math.max(1, n - 1)
          for (const t2 of active) {
            if (t1 === t2) { corrMatrixCHF[t1][t2] = 1; continue }
            const r2c = common.map(d => retsCHF[t2][d] ?? 0)
            const m2c = r2c.reduce((s, r) => s + r, 0) / n
            const v2c = r2c.reduce((s, r) => s + (r - m2c) ** 2, 0) / Math.max(1, n - 1)
            const covc = r1c.reduce((s, r, i) => s + (r - m1c) * (r2c[i] - m2c), 0) / Math.max(1, n - 1)
            corrMatrixCHF[t1][t2] = v1c > 0 && v2c > 0 ? covc / Math.sqrt(v1c * v2c) : 0
          }
        }

        setHistStats({
          sigma: sigAnn, er: erAnn,
          var95: v95Ann, cvar95: cv95Ann, var95m: v95m,
          sharpe: sh,
          period: `${fmtM(common[0])} → ${fmtM(common[common.length - 1])}`,
          months: n,
          assetPeriods: {},
          excluded,
          reducing,
          tickerStats,
          corrMatrix,
          chf: {
            sigma: sigAnnC, er: erAnnC,
            var95: v95AnnC, cvar95: cv95AnnC, var95m: v95mC,
            sharpe: shC,
            tickerStats: tickerStatsCHF,
            corrMatrix: corrMatrixCHF,
          },
        })
      })
      .catch(() => {})
      .finally(() => setHistLoading(false))
  }, [_histKey, hasPositions])

  // ── Métriques de base (modèle, fallback si historique indisponible) ─────────
  const sigmaModel = React.useMemo(() => portfolioSigma(catWeights), [catWeights])
  const erModel    = React.useMemo(() => portfolioER(catWeights), [catWeights])
  const sigma   = histStats?.sigma  ?? sigmaModel
  const er      = histStats?.er     ?? erModel
  const sharpe  = histStats?.sharpe ?? (sigma > 0 ? (er - RF_RATE) / sigma : 0)
  const var95   = histStats?.var95  ?? (er - 1.645 * sigma)
  const cvar95  = histStats?.cvar95 ?? (er - 2.063 * sigma)
  const hhi     = Object.values(catWeights).reduce((s, w) => s + w * w, 0)
  const effN    = hhi > 0 ? 1 / hhi : 0
  // Métriques CHF-ajustées
  const sigma_chf  = histStats?.chf?.sigma  ?? sigma
  const er_chf     = histStats?.chf?.er     ?? er
  const sharpe_chf = histStats?.chf?.sharpe ?? (sigma_chf > 0 ? (er_chf - RF_RATE) / sigma_chf : 0)
  const var95_chf  = histStats?.chf?.var95  ?? (er_chf - 1.645 * sigma_chf)
  const cvar95_chf = histStats?.chf?.cvar95 ?? (er_chf - 2.063 * sigma_chf)
  const var95m_chf = histStats?.chf?.var95m ?? (er_chf / 12 - 1.645 * sigma_chf / Math.sqrt(12))
  const var95m  = histStats?.var95m ?? (er / 12 - 1.645 * sigma / Math.sqrt(12))

  // ── Score d'adéquation portefeuille ──
  const portfolioScore = React.useMemo(() => {
    if (!hasPositions) return null
    // Q4 — Objectif de rendement (25 pts)
    const targetReturn: Record<string, number> = { inflation: 0.03, 'modéré': 0.06, croissance: 0.10, agressif: 0.13 }
    const rt = targetReturn[profile.objective] ?? 0.06
    const sRendement = er >= rt ? 25 : er >= rt * 0.75 ? 18 : er >= rt * 0.5 ? 10 : 4

    // Q2 — Tolérance aux pertes (25 pts) : VaR + CVaR + Sharpe
    const tolLoss    = profile.loss / 100
    const actualLoss = -var95            // VaR 95% annuelle (perte positive)
    const actualCVaR = -cvar95           // CVaR 95% annuelle
    const sVaR    = actualLoss <= tolLoss ? 12 : actualLoss <= tolLoss * 1.2 ? 8 : actualLoss <= tolLoss * 1.5 ? 4 : 1
    const sCVaR   = actualCVaR <= tolLoss * 1.3 ? 8 : actualCVaR <= tolLoss * 1.6 ? 5 : actualCVaR <= tolLoss * 2.0 ? 2 : 0
    const sSharpe = sharpe >= 1 ? 5 : sharpe >= 0.5 ? 3 : sharpe >= 0.1 ? 1 : 0
    const sRisque = sVaR + sCVaR + sSharpe

    // Q1 — Horizon temporel (25 pts) : σ + diversification (N effectif)
    // Long horizon → volatilité tolérée (poids faible), diversification primordiale (poids fort)
    // Court horizon → volatilité critique (poids fort), diversification secondaire (poids faible)
    const maxSigmaForHorizon = profile.horizon >= 20 ? 0.40 : profile.horizon >= 10 ? 0.28 : profile.horizon >= 5 ? 0.18 : 0.10
    const wSigma   = profile.horizon >= 20 ? 8 : profile.horizon >= 10 ? 12 : profile.horizon >= 5 ? 18 : 21
    const wEffN    = 25 - wSigma
    const rawSigma = sigma <= maxSigmaForHorizon ? 1.0 : sigma <= maxSigmaForHorizon * 1.2 ? 0.67 : sigma <= maxSigmaForHorizon * 1.5 ? 0.33 : 0.10
    const sSigma   = Math.round(rawSigma * wSigma)
    const minEffN  = profile.horizon >= 15 ? 4 : profile.horizon >= 7 ? 3 : profile.horizon >= 3 ? 2 : 1.5
    const rawEffN  = effN >= minEffN * 1.5 ? 1.0 : effN >= minEffN ? 0.70 : effN >= minEffN * 0.7 ? 0.30 : 0.08
    const sEffN    = Math.round(rawEffN * wEffN)
    const sHorizon = sSigma + sEffN

    // Q3 — Liquidité (25 pts) : VaR mensuelle + HHI concentration
    const monthlyThreshold = profile.liquidity === 'haute' ? 0.05 : profile.liquidity === 'moyenne' ? 0.10 : 0.20
    const actualVaRM = -var95m
    const sVaRM  = actualVaRM <= monthlyThreshold ? 13 : actualVaRM <= monthlyThreshold * 1.3 ? 8 : actualVaRM <= monthlyThreshold * 1.7 ? 4 : 1
    const hhiThreshold = profile.liquidity === 'haute' ? 0.20 : profile.liquidity === 'moyenne' ? 0.35 : 0.60
    const sHHI   = hhi <= hhiThreshold ? 12 : hhi <= hhiThreshold * 1.4 ? 7 : hhi <= hhiThreshold * 2.0 ? 3 : 1
    const sLiquidite = sVaRM + sHHI

    const total = sRendement + sRisque + sHorizon + sLiquidite
    const label = total >= 88 ? 'Excellent' : total >= 72 ? 'Très bon' : total >= 55 ? 'Bon' : total >= 38 ? 'Passable' : 'Insuffisant'
    const color = total >= 88 ? '#22C55E' : total >= 72 ? '#2B6B5A' : total >= 55 ? '#F59E0B' : total >= 38 ? '#F97316' : '#EF4444'
    const details = { sRendement, sRisque, sHorizon, sLiquidite }

    // ── Recommandations ───────────────────────────────────────────────────────
    const recommendations: { title: string; text: string; color: string }[] = []

    // Q4 — Rendement
    if (sRendement < 18) {
      recommendations.push({
        title: 'Rendement insuffisant',
        text: `Votre rendement attendu (${(er * 100).toFixed(1)} %) est inférieur à votre objectif "${profile.objective}" (${(rt * 100).toFixed(1)} %). Envisagez d'augmenter la part d'actions ou d'ETF de croissance.`,
        color: sRendement <= 10 ? '#EF4444' : '#F97316',
      })
    }

    // Q2 — VaR
    if (sVaR < 8) {
      recommendations.push({
        title: 'Risque de perte trop élevé',
        text: `Votre perte probable annuelle (VaR 95 % : ${(-var95 * 100).toFixed(1)} %) dépasse votre tolérance déclarée (${profile.loss} %). Réduisez la crypto ou les actions et augmentez la part d'obligations.`,
        color: sVaR <= 1 ? '#EF4444' : '#F97316',
      })
    }

    // Q2 — CVaR
    if (sCVaR < 5) {
      recommendations.push({
        title: 'Pertes extrêmes mal couvertes',
        text: `En cas de crise, la perte moyenne attendue (CVaR : ${(-cvar95 * 100).toFixed(1)} %) est très supérieure à votre tolérance. Ajoutez des actifs défensifs (obligations, monnaies) pour amortir les chocs.`,
        color: '#F97316',
      })
    }

    // Q2 — Sharpe
    if (sSharpe < 3) {
      recommendations.push({
        title: 'Efficience faible (Sharpe bas)',
        text: `Votre ratio de Sharpe (${sharpe.toFixed(2)}) indique que le risque pris est mal rémunéré. Orientez-vous vers des ETF diversifiés ou des obligations d'entreprise pour améliorer le rapport rendement/risque.`,
        color: '#F59E0B',
      })
    }

    // Q1 — Volatilité vs horizon
    if (sSigma < Math.round(wSigma * 0.4)) {
      recommendations.push({
        title: "Volatilité inadaptée à l'horizon",
        text: `σ = ${(sigma * 100).toFixed(1)} % pour un horizon de ${profile.horizon} an${profile.horizon > 1 ? 's' : ''} (max recommandé : ${(maxSigmaForHorizon * 100).toFixed(0)} %). Réduisez les actifs très volatils ou envisagez d'allonger votre horizon.`,
        color: '#F97316',
      })
    }

    // Q1 — Diversification vs horizon
    if (sEffN < Math.round(wEffN * 0.4)) {
      recommendations.push({
        title: 'Diversification insuffisante',
        text: `Avec ${effN.toFixed(1)} actif(s) effectif(s) pour un horizon de ${profile.horizon} an${profile.horizon > 1 ? 's' : ''}, votre portefeuille est trop concentré. Visez au moins ${minEffN} catégories bien réparties.`,
        color: '#F59E0B',
      })
    }

    // Q3 — VaR mensuelle vs liquidité
    if (sVaRM < 8) {
      recommendations.push({
        title: 'Risque de liquidité court terme',
        text: `Votre perte mensuelle probable (${(-var95m * 100).toFixed(1)} %) dépasse le seuil pour une liquidité ${profile.liquidity} (${(monthlyThreshold * 100).toFixed(0)} % max). Réduisez les actifs volatils ou abaissez votre besoin de liquidité.`,
        color: '#F97316',
      })
    }

    // Q3 — HHI vs liquidité
    if (sHHI < 7) {
      recommendations.push({
        title: 'Concentration excessive',
        text: `HHI = ${hhi.toFixed(2)} — portefeuille trop concentré pour une liquidité ${profile.liquidity} (seuil : ${hhiThreshold.toFixed(2)}). Répartissez sur davantage de catégories pour faciliter une sortie rapide.`,
        color: '#F59E0B',
      })
    }

    // ── Statuts par dimension (toujours affichés) ────────────────────────────
    const statuts: { dim: string; score: number; max: number; text: string }[] = [
      {
        dim: 'Q1 — Horizon temporel',
        score: sHorizon, max: 25,
        text: sHorizon >= 18
          ? `Volatilité (${(sigma * 100).toFixed(1)} %) et diversification (N effectif : ${effN.toFixed(1)}) adaptées à un horizon de ${profile.horizon} an${profile.horizon > 1 ? 's' : ''}.`
          : sSigma < Math.round(wSigma * 0.4)
            ? `Volatilité σ = ${(sigma * 100).toFixed(1)} % trop élevée pour ${profile.horizon} an${profile.horizon > 1 ? 's' : ''} (max ${(maxSigmaForHorizon * 100).toFixed(0)} %). Réduisez les actifs très volatils.`
            : `Diversification insuffisante (N effectif : ${effN.toFixed(1)}) pour ${profile.horizon} an${profile.horizon > 1 ? 's' : ''}. Visez au moins ${minEffN} catégories réparties.`,
      },
      {
        dim: 'Q2 — Tolérance aux pertes',
        score: sRisque, max: 25,
        text: sRisque >= 18
          ? `Perte probable (VaR ${(-var95 * 100).toFixed(1)} %) dans votre tolérance (${profile.loss} %). Ratio de Sharpe : ${sharpe.toFixed(2)}.`
          : sVaR < 8
            ? `Perte probable annuelle (${(-var95 * 100).toFixed(1)} %) dépasse votre tolérance (${profile.loss} %). Réduisez les actifs volatils et augmentez les obligations.`
            : sSharpe < 3
              ? `Risque correctement borné mais ratio de Sharpe faible (${sharpe.toFixed(2)}). Optimisez le rapport rendement/risque.`
              : `CVaR en cas de crise (${(-cvar95 * 100).toFixed(1)} %) à surveiller. Ajoutez des actifs défensifs.`,
      },
      {
        dim: 'Q3 — Liquidité',
        score: sLiquidite, max: 25,
        text: sLiquidite >= 18
          ? `Concentration (HHI ${hhi.toFixed(2)}) et VaR mensuelle (${(-var95m * 100).toFixed(1)} %) compatibles avec une liquidité ${profile.liquidity}.`
          : sVaRM < 8
            ? `VaR mensuelle (${(-var95m * 100).toFixed(1)} %) trop élevée pour une liquidité ${profile.liquidity} (max ${(monthlyThreshold * 100).toFixed(0)} %). Réduisez les actifs volatils.`
            : `Concentration (HHI ${hhi.toFixed(2)}) trop forte pour une liquidité ${profile.liquidity}. Diversifiez sur plus de catégories.`,
      },
      {
        dim: 'Q4 — Objectif de rendement',
        score: sRendement, max: 25,
        text: sRendement >= 18
          ? `Rendement attendu (${(er * 100).toFixed(1)} %) aligné avec l'objectif "${profile.objective}" (${(rt * 100).toFixed(1)} %).`
          : `Rendement attendu (${(er * 100).toFixed(1)} %) inférieur à l'objectif "${profile.objective}" (${(rt * 100).toFixed(1)} %). Augmentez la part d'actions ou d'ETF de croissance.`,
      },
    ]

    return { total, label, color, details, recommendations, statuts }
  }, [hasPositions, er, var95, cvar95, var95m, sigma, sharpe, effN, hhi, profile, catWeights])

  // ── Type de profil dérivé ──
  const profileType = React.useMemo(() => {
    let score = 0
    score += profile.horizon >= 20 ? 4 : profile.horizon >= 10 ? 3 : profile.horizon >= 5 ? 2 : 1
    score += profile.loss >= 40 ? 4 : profile.loss >= 25 ? 3 : profile.loss >= 15 ? 2 : 1
    score += profile.liquidity === 'faible' ? 3 : profile.liquidity === 'moyenne' ? 2 : 1
    score += profile.objective === 'agressif' ? 4 : profile.objective === 'croissance' ? 3 : profile.objective === 'modéré' ? 2 : 1
    if (score <= 5)  return { label: 'Prudent',    color: '#3B82F6', desc: 'Capital preservation, faible risque.' }
    if (score <= 8)  return { label: 'Défensif',   color: '#22C55E', desc: 'Rendement régulier, volatilité limitée.' }
    if (score <= 11) return { label: 'Équilibré',  color: '#F59E0B', desc: 'Équilibre croissance / sécurité.' }
    if (score <= 14) return { label: 'Dynamique',  color: '#F97316', desc: 'Croissance prioritaire, tolérance modérée.' }
    return                { label: 'Agressif',   color: '#EF4444', desc: 'Maximisation du rendement long terme.' }
  }, [profile])

  // ── Monte Carlo ──
  const mcPaths = React.useMemo(() => {
    if (!hasPositions || sigma === 0) return []
    const s = mcFX ? (histStats?.chf?.sigma ?? sigma) : sigma
    const e = mcFX ? (histStats?.chf?.er     ?? er)    : er
    if (s === 0) return []
    const N = 500, T = profile.horizon, dt = 1
    const paths: number[][] = []
    for (let i = 0; i < N; i++) {
      const path = [1.0]
      for (let t = 0; t < T; t++) {
        const prev = path[path.length - 1]
        path.push(prev * Math.exp((e - s * s / 2) * dt + s * Math.sqrt(dt) * normalRand()))
      }
      paths.push(path)
    }
    return paths
  }, [hasPositions, sigma, er, mcFX, histStats, profile.horizon])

  const mcBands = React.useMemo(() => {
    if (mcPaths.length === 0) return []
    const T = profile.horizon + 1
    return Array.from({ length: T }, (_, t) => {
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
    const erUse = stressFX ? (histStats?.chf?.er ?? er) : er
    return STRESS.map(sc => {
      const loss = CATS.reduce((s, c) => s + (catWeights[c] ?? 0) * (sc.shocks[c] ?? 0), 0)
      const recovery = loss < 0 ? Math.ceil(Math.log(1 / (1 + loss)) / Math.log(1 + erUse)) : 0
      return { ...sc, loss, recovery }
    })
  }, [catWeights, hasPositions, er, stressFX, histStats])

  // ── Frontière efficiente ──
  const frontier = React.useMemo(() => {
    if (!hasPositions) return { pts: [], current: null, maxSharpe: null, minSigma: null, maxSharpeWeights: null as Record<string,number>|null, minSigmaWeights: null as Record<string,number>|null }

    // ── Données historiques réelles (niveau ticker) ──
    const tsSource = frontierFX && histStats?.chf?.tickerStats ? histStats.chf : histStats
    if (tsSource?.tickerStats && Object.keys(tsSource.tickerStats).length >= 2) {
      const tickers = Object.keys(tsSource.tickerStats)
      type FPt = { r: number; s: number; sh: number; w: Record<string, number> }
      const fpts: FPt[] = []
      for (let i = 0; i < 2000; i++) {
        const raws = tickers.map(() => -Math.log(Math.random()))
        const sum  = raws.reduce((a, b) => a + b, 0)
        const w: Record<string, number> = {}
        tickers.forEach((t, j) => { w[t] = raws[j] / sum })
        // E(R) portefeuille
        const r = tickers.reduce((s, t) => s + w[t] * tsSource.tickerStats[t].er, 0)
        // Variance portefeuille = Σ_i Σ_j w_i w_j σ_i σ_j ρ_ij
        let variance = 0
        for (const t1 of tickers) {
          for (const t2 of tickers) {
            const rho = tsSource.corrMatrix?.[t1]?.[t2] ?? (t1 === t2 ? 1 : 0)
            variance += w[t1] * w[t2] * tsSource.tickerStats[t1].sigma * tsSource.tickerStats[t2].sigma * rho
          }
        }
        const s = Math.sqrt(Math.max(0, variance))
        fpts.push({ r, s, sh: s > 0 ? (r - RF_RATE) / s : 0, w })
      }
      const useChf = frontierFX && !!histStats?.chf?.tickerStats
      const curR  = useChf ? (histStats?.chf?.er     ?? er)     : er
      const curS  = useChf ? (histStats?.chf?.sigma  ?? sigma)  : sigma
      const curSh = useChf ? (histStats?.chf?.sharpe ?? sharpe) : sharpe
      const current    = { r: curR, s: curS, sh: curSh }
      const maxSharpeP = fpts.reduce((b, p) => p.sh > b.sh ? p : b, fpts[0])
      const minSigmaP  = fpts.reduce((b, p) => p.s  < b.s  ? p : b, fpts[0])
      return {
        pts: fpts.map(({ r, s, sh }) => ({ r, s, sh })),
        current,
        maxSharpe: { r: maxSharpeP.r, s: maxSharpeP.s, sh: maxSharpeP.sh },
        minSigma:  { r: minSigmaP.r,  s: minSigmaP.s,  sh: minSigmaP.sh  },
        maxSharpeWeights: maxSharpeP.w,
        minSigmaWeights:  minSigmaP.w,
        usingCHF: frontierFX && !!histStats?.chf?.tickerStats,
      }
    }

    // ── Fallback : paramètres modèles par catégorie ──
    const pts: { r: number; s: number; sh: number }[] = []
    for (let i = 0; i < 500; i++) {
      const raws = CATS.map(() => -Math.log(Math.random()))
      const sum  = raws.reduce((a, b) => a + b, 0)
      const w: Record<string, number> = {}
      CATS.forEach((c, j) => { w[c] = raws[j] / sum })
      const r = portfolioER(w), s = portfolioSigma(w)
      pts.push({ r, s, sh: s > 0 ? (r - RF_RATE) / s : 0 })
    }
    const fbR  = frontierFX ? (histStats?.chf?.er     ?? er)     : er
    const fbS  = frontierFX ? (histStats?.chf?.sigma  ?? sigma)  : sigma
    const fbSh = frontierFX ? (histStats?.chf?.sharpe ?? sharpe) : sharpe
    const current  = { r: fbR, s: fbS, sh: fbSh }
    const maxSharpe = pts.reduce((b, p) => p.sh > b.sh ? p : b, pts[0])
    const minSigma  = pts.reduce((b, p) => p.s < b.s  ? p : b, pts[0])
    return { pts, current, maxSharpe, minSigma, maxSharpeWeights: null, minSigmaWeights: null }
  }, [hasPositions, histStats, frontierFX, catWeights, er, sigma, sharpe])

  // ── SVG helpers ──
  const W = 560, H = 220, PAD = { t: 16, r: 16, b: 32, l: 52 }
  const PW = W - PAD.l - PAD.r, PH = H - PAD.t - PAD.b

  function mcSVG() {
    if (mcBands.length < 2) return null
    const T = mcBands.length
    const allVals = mcBands.flatMap(b => [b.p5, b.p95])
    const minY = Math.min(...allVals), maxY = Math.max(...allVals)
    const xS = (i: number) => PAD.l + (i / (T - 1)) * PW
    const yS = (v: number) => PAD.t + PH - ((v - minY) / (maxY - minY || 1)) * PH
    const line = (key: 'p5' | 'p25' | 'p50' | 'p75' | 'p95') =>
      mcBands.map((b, i) => `${i === 0 ? 'M' : 'L'}${xS(i).toFixed(1)},${yS(b[key]).toFixed(1)}`).join(' ')
    const area = (hi: 'p95' | 'p75', lo: 'p5' | 'p25') => {
      const fwd = mcBands.map((b, i) => `${i === 0 ? 'M' : 'L'}${xS(i).toFixed(1)},${yS(b[hi]).toFixed(1)}`).join(' ')
      const bwd = [...mcBands].reverse().map((b, i) => `L${xS(T - 1 - i).toFixed(1)},${yS(b[lo]).toFixed(1)}`).join(' ')
      return fwd + bwd + 'Z'
    }
    const ticks = Array.from({ length: 5 }, (_, i) => {
      const v = minY + (i / 4) * (maxY - minY)
      return { y: yS(v), label: `×${v.toFixed(2)}` }
    })
    const xTicks = Array.from({ length: Math.min(T, 6) }, (_, i) => {
      const idx = Math.round(i * (T - 1) / 5)
      return { x: xS(idx), label: `Y${idx}` }
    })
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 220 }}>
        <defs>
          <linearGradient id="mc-g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2B6B5A" stopOpacity="0.25"/><stop offset="100%" stopColor="#2B6B5A" stopOpacity="0.05"/></linearGradient>
          <linearGradient id="mc-g2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2B6B5A" stopOpacity="0.12"/><stop offset="100%" stopColor="#2B6B5A" stopOpacity="0.03"/></linearGradient>
        </defs>
        {ticks.map((tk, i) => (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={tk.y} y2={tk.y} stroke="#DDD9D1" strokeWidth="0.5" strokeDasharray="3,3"/>
            <text x={PAD.l - 4} y={tk.y + 4} textAnchor="end" fontSize="9" fill="#8899AA">{tk.label}</text>
          </g>
        ))}
        {xTicks.map((tk, i) => <text key={i} x={tk.x} y={H - 6} textAnchor="middle" fontSize="9" fill="#8899AA">{tk.label}</text>)}
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
    // Inclure le point courant pour que E(R) > max simulé reste visible
    const allX = [...xs, current.s], allY = [...ys, current.r]
    const minX = Math.min(...allX), maxX = Math.max(...allX)
    const minYv = Math.min(...allY), maxYv = Math.max(...allY)
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

  const tile = (label: string, value: string, tooltip?: string, color?: string, sub?: string) => (
    <div className="relative bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-4 flex flex-col gap-1">
      {tooltip && (
        <span className="group absolute top-2 right-2">
          <button className="w-4 h-4 rounded-full bg-[#E8E4DC] dark:bg-[#1e3347] text-[#5C6880] dark:text-[#7B8DA6] text-[9px] font-bold flex items-center justify-center leading-none hover:bg-[#2B6B5A] hover:text-white transition-colors focus:outline-none">?</button>
          <span className="pointer-events-none absolute right-0 bottom-6 z-20 w-64 rounded-lg bg-[#1B3050] dark:bg-[#0A1929] text-white text-[10px] leading-relaxed px-3 py-2 shadow-xl opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150">
            {tooltip}
          </span>
        </span>
      )}
      <p className="text-xs text-[#5C6880] dark:text-[#7B8DA6] pr-5">{label}</p>
      <p className="text-lg font-semibold" style={{ color: color ?? 'inherit' }}>{value}</p>
      {sub && <p className="text-[10px] text-[#8899AA] opacity-60 mt-0.5">&#127464;&#127469; {sub}</p>}
    </div>
  )

  const card = (label: string, active: boolean, onClick: () => void) => (
    <button onClick={onClick}
      className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${active
        ? 'bg-[#2B6B5A] text-white border-[#2B6B5A]'
        : 'bg-white dark:bg-[#162534] text-[#5C6880] dark:text-[#7B8DA6] border-[#DDD9D1] dark:border-[#1e3347] hover:border-[#2B6B5A]'}`}>
      {label}
    </button>
  )

  return (
    <div className="mt-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-1 h-6 rounded-full bg-[#2B6B5A]"/>
        <h2 className="text-lg font-semibold text-[#1B3050] dark:text-white">Profil d&apos;investisseur</h2>
      </div>

      {/* Profil card — always visible header + collapsible questionnaire */}
      <div className="bg-white dark:bg-[#162534] rounded-2xl border border-[#DDD9D1] dark:border-[#1e3347] overflow-hidden">

        {/* Always-visible: profile type selector */}
        <div className="p-6 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#8899AA] uppercase tracking-wider font-medium">Votre profil</p>
            <button
              onClick={() => setShowQuestionnaire(s => !s)}
              className="flex items-center gap-1.5 text-xs text-[#5C6880] dark:text-[#7B8DA6] hover:text-[#2B6B5A] dark:hover:text-[#2B6B5A] transition-colors px-2 py-1 rounded-lg hover:bg-[#F0F4F0] dark:hover:bg-[#1e3347]"
            >
              <span>{showQuestionnaire ? 'Réduire le questionnaire' : 'Modifier le questionnaire'}</span>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className={`transition-transform duration-200 ${showQuestionnaire ? 'rotate-180' : ''}`}>
                <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
          <div className="flex gap-2 flex-wrap">
            {([
              { label: 'Prudent',   color: '#3B82F6', desc: 'Capital preservation, faible risque.' },
              { label: 'Défensif',  color: '#22C55E', desc: 'Rendement régulier, volatilité limitée.' },
              { label: 'Équilibré', color: '#F59E0B', desc: 'Équilibre croissance / sécurité.' },
              { label: 'Dynamique', color: '#F97316', desc: 'Croissance prioritaire, tolérance modérée.' },
              { label: 'Agressif',  color: '#EF4444', desc: 'Maximisation du rendement long terme.' },
            ] as const).map(p => {
              const active = p.label === profileType.label
              return (
                <div key={p.label} className="flex items-center gap-2 px-3 py-2 rounded-xl border transition-all"
                  style={{
                    borderColor: active ? p.color : 'transparent',
                    background: active ? `${p.color}18` : 'var(--profile-pill-bg, rgba(0,0,0,0.04))',
                    opacity: active ? 1 : 0.38,
                  }}>
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }}/>
                  <div>
                    <p className="text-xs font-semibold leading-tight" style={{ color: active ? p.color : 'inherit' }}>{p.label}</p>
                    {active && <p className="text-[10px] text-[#5C6880] dark:text-[#7B8DA6] leading-tight mt-0.5">{p.desc}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Collapsible questionnaire */}
        {showQuestionnaire && (
          <div className="border-t border-[#DDD9D1] dark:border-[#1e3347] p-6 space-y-6">

            {/* Q1 – Horizon temporel */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-[#1B3050] dark:text-white">
                1. Horizon d&apos;investissement
                <span className="ml-2 text-[#2B6B5A] font-semibold">{profile.horizon} ans</span>
              </p>
              <input type="range" min="1" max="30" value={profile.horizon}
                onChange={e => setProfile(p => ({ ...p, horizon: +e.target.value }))}
                className="w-full accent-[#2B6B5A]"/>
              <div className="relative h-4 text-xs text-[#8899AA] mt-0.5">
                {([1, 5, 10, 20, 30] as const).map(v => {
                  const pct = (v - 1) / (30 - 1) * 100
                  return (
                    <span key={v} style={{
                      position: 'absolute',
                      left: `${pct}%`,
                      transform: pct === 0 ? 'none' : pct === 100 ? 'translateX(-100%)' : 'translateX(-50%)',
                    }}>
                      {v === 1 ? '1 an' : `${v} ans`}
                    </span>
                  )
                })}
              </div>
            </div>

            {/* Q2 – Tolérance aux pertes */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-[#1B3050] dark:text-white">2. Tolérance maximale à une perte temporaire</p>
              <div className="flex flex-wrap gap-2">
                {([10, 20, 30, 40, 50] as const).map(v => React.cloneElement(card(`-${v}%`, profile.loss === v, () => setProfile(p => ({ ...p, loss: v }))), { key: v }))}
              </div>
            </div>

            {/* Q3 – Liquidité */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-[#1B3050] dark:text-white">3. Besoin de liquidité (accès rapide aux fonds)</p>
              <div className="flex flex-wrap gap-2">
                {(['haute', 'moyenne', 'faible'] as const).map(v => React.cloneElement(card(
                  v === 'haute' ? 'Élevée – besoin possible à court terme' : v === 'moyenne' ? 'Moyenne – quelques mois' : 'Faible – engagement long terme',
                  profile.liquidity === v,
                  () => setProfile(p => ({ ...p, liquidity: v }))
                ), { key: v }))}
              </div>
            </div>

            {/* Q4 – Objectif */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-[#1B3050] dark:text-white">4. Objectif de rendement principal</p>
              <div className="flex flex-wrap gap-2">
                {([
                  ['inflation', 'Battre l\'inflation (~2–3%)'],
                  ['modéré',   'Rendement modéré (~5–7%)'],
                  ['croissance','Croissance (~8–12%)'],
                  ['agressif', 'Maximisation (>12%)'],
                ] as const).map(([v, lbl]) => React.cloneElement(card(lbl, profile.objective === v, () => setProfile(p => ({ ...p, objective: v }))), { key: v }))}
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Analyses quantitatives (uniquement si positions) */}
      {hasPositions && (
        <div className="bg-white dark:bg-[#162534] rounded-2xl border border-[#DDD9D1] dark:border-[#1e3347] overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-[#DDD9D1] dark:border-[#1e3347] overflow-x-auto">
            {([
              ['stats',      'Statistiques'],
              ['montecarlo', 'Monte Carlo'],
              ['stress',     'Stress Tests'],
              ['frontier',   'Frontière efficiente'],
              ['sources',    'Sources & Paramètres'],
            ] as const).map(([key, lbl]) => (
              <button key={key} onClick={() => setTab(key)}
                className={`px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === key
                  ? 'border-[#2B6B5A] text-[#2B6B5A]'
                  : 'border-transparent text-[#5C6880] dark:text-[#7B8DA6] hover:text-[#1B3050] dark:hover:text-white'}`}>
                {lbl}
              </button>
            ))}
          </div>

          <div className="p-6">

            {/* ── Statistiques ── */}
            {tab === 'stats' && (
              <div className="space-y-4">
                <p className="text-xs text-[#8899AA]">Statistiques estimées sur la composition actuelle du portefeuille, calculées à partir des données historiques réelles. 🇨🇭 = valeurs ajustées en tenant compte de l'évolution du taux de change CHF.</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {tile('Rendement annuel attendu', `${(er * 100).toFixed(2)} %`, 'CAPM : E(Ri) = Rf + β × [E(Rm) − Rf]. Rf = 0,8 % (taux sans risque CHF), E(Rm) = 9,5 % (prime de marché). Le β de chaque catégorie pondère sa contribution au rendement attendu.', '#2B6B5A', histStats?.chf ? `${(er_chf * 100).toFixed(2)} %` : undefined)}
                  {tile('Volatilité du portefeuille', `${(sigma * 100).toFixed(2)} %`, 'σ_p = √(ΣᵢΣⱼ wᵢwⱼσᵢσⱼρᵢⱼ). Calculé via la matrice de covariance 6×6 entre catégories. Une σ élevée = fortes fluctuations annuelles de la valeur.', undefined, histStats?.chf ? `${(sigma_chf * 100).toFixed(2)} %` : undefined)}
                  {tile('Ratio de Sharpe', sharpe.toFixed(3), `Sharpe = (E(Rp) − Rf) / σ. Mesure le rendement excédentaire par unité de risque. > 1 = excellent, 0,5–1 = correct, < 0,5 = faible. Rf = ${(RF_RATE * 100).toFixed(1)} %.`, sharpe >= 1 ? '#22C55E' : sharpe >= 0.5 ? '#F59E0B' : '#EF4444', histStats?.chf ? sharpe_chf.toFixed(3) : undefined)}
                  {tile('Perte max probable (1 an)', `${(var95 * 100).toFixed(2)} %`, 'VaR paramétrique 95 % annuelle : μ − 1,645 × σ. Sur 100 années, la perte dépassera ce seuil seulement 5 fois. Valeur négative = perte potentielle du portefeuille.', undefined, histStats?.chf ? `${(var95_chf * 100).toFixed(2)} %` : undefined)}
                  {tile('Perte moyenne en cas de crise', `${(cvar95 * 100).toFixed(2)} %`, 'CVaR (Expected Shortfall) 95 % : μ − 2,063 × σ. Perte moyenne observée dans les 5 % pires scénarios annuels. Mesure plus conservative que la VaR car elle intègre l\'amplitude des pertes extrêmes.', undefined, histStats?.chf ? `${(cvar95_chf * 100).toFixed(2)} %` : undefined)}
                  {tile('Perte max probable (1 mois)', `${(var95m * 100).toFixed(2)} %`, 'VaR mensuelle 95 % : μ/12 − 1,645 × σ/√12. Même principe que la VaR annuelle mais ramenée à un horizon mensuel. Utile pour suivre le risque à court terme.', undefined, histStats?.chf ? `${(var95m_chf * 100).toFixed(2)} %` : undefined)}
                  {tile('Indice de concentration (HHI)', hhi.toFixed(3), 'HHI = Σwᵢ². Varie de 0 (parfaitement diversifié) à 1 (mono-actif). < 0,15 = bien diversifié, 0,15–0,25 = modéré, > 0,25 = concentré. Un HHI élevé amplifie l\'impact d\'un choc sectoriel.', hhi > 0.4 ? '#EF4444' : hhi > 0.25 ? '#F59E0B' : '#22C55E')}
                  {tile('Nombre effectif d\'actifs', effN.toFixed(1), 'N effectif = 1 / HHI. Traduit l\'indice HHI en équivalent intuitif : un portefeuille avec N effectif = 3 se comporte comme s\'il était réparti équitablement entre 3 actifs décorrélés.')}
                  {portfolioScore ? tile(
                    'Score du portefeuille',
                    `${portfolioScore.total}/100 — ${portfolioScore.label}`,
                    `Score indicatif sur 100. Q1 Horizon (σ + N effectif) ${portfolioScore.details.sHorizon}/25 · Q2 Tolérance pertes (VaR + CVaR + Sharpe) ${portfolioScore.details.sRisque}/25 · Q3 Liquidité (VaR mensuelle + HHI) ${portfolioScore.details.sLiquidite}/25 · Q4 Objectif rendement ${portfolioScore.details.sRendement}/25. Les 9 statistiques sont prises en compte.`,
                    portfolioScore.color
                  ) : null}
                </div>
                {portfolioScore && (
                  <div className="mt-4 space-y-2">
                    <p className="text-[11px] font-semibold text-[#5C6880] dark:text-[#7B8DA6] uppercase tracking-wide">Analyse par dimension</p>
                    {portfolioScore.statuts.map((s, i) => {
                      const clr = s.score >= 20 ? '#22C55E' : s.score >= 14 ? '#F59E0B' : '#EF4444'
                      return (
                        <div key={i} className="flex gap-3 items-start rounded-lg border border-[#DDD9D1] dark:border-[#1e3347] bg-white dark:bg-[#162534] p-3" style={{ borderLeftWidth: '4px', borderLeftColor: clr }}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-semibold" style={{ color: clr }}>{s.dim}</p>
                              <span className="text-[10px] font-mono shrink-0" style={{ color: clr }}>{s.score}/{s.max}</span>
                            </div>
                            <p className="text-xs text-[#5C6880] dark:text-[#7B8DA6] mt-0.5 leading-relaxed">{s.text}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Monte Carlo ── */}
            {tab === 'montecarlo' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-[#8899AA]">500 scénarios simulés sur {profile.horizon} ans. La zone claire montre l'éventail des cas extrêmes (5 % des meilleurs et pires résultats), la zone moyenne les trajectoires les plus probables, et la ligne épaisse la trajectoire médiane.</p>
                  {histStats?.chf && (
                    <button onClick={() => setMcFX(f => !f)}
                      className={`shrink-0 ml-3 text-[11px] px-3 py-1 rounded-lg border transition-colors ${
                        mcFX ? 'bg-[#2B6B5A] text-white border-[#2B6B5A]' : 'bg-white dark:bg-[#162534] text-[#5C6880] dark:text-[#7B8DA6] border-[#DDD9D1] dark:border-[#1e3347] hover:border-[#2B6B5A]'
                      }`}>&#127464;&#127469; CHF</button>
                  )}
                </div>
                <div className="rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-3 bg-[#FAFAF8] dark:bg-[#0F1E2E]">
                  {mcSVG()}
                </div>
                {mcBands.length > 0 && (
                  <div className="grid grid-cols-3 gap-3">
                    {tile('Valeur médiane finale', `×${mcBands[mcBands.length - 1].p50.toFixed(2)}`, `Multiplicateur médian (P50) à l\'horizon de ${profile.horizon} ans. Dans 50 % des simulations, le portefeuille vaut au moins ×${mcBands[mcBands.length - 1].p50.toFixed(2)} la mise initiale.`, '#2B6B5A')}
                    {tile('Scénario favorable (P75)', `×${mcBands[mcBands.length - 1].p75.toFixed(2)}`, 'Percentile 75 des 500 simulations. Dans 25 % des cas, le portefeuille dépasse ce multiplicateur à l\'horizon fixé.')}
                    {tile('Scénario défavorable (P25)', `×${mcBands[mcBands.length - 1].p25.toFixed(2)}`, 'Percentile 25 des 500 simulations. Dans 25 % des cas, le portefeuille est en dessous de ce multiplicateur à l\'horizon fixé. Utile pour évaluer le risque de sous-performance.', '#F97316')}
                  </div>
                )}
              </div>
            )}

            {/* ── Stress Tests ── */}
            {tab === 'stress' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-[#8899AA]">Simulation de l'impact de grandes crises passées (2008, Covid…) sur votre portefeuille actuel. Chaque scénario estime la perte subie et le temps nécessaire pour retrouver le niveau initial.</p>
                  {histStats?.chf && (
                    <button onClick={() => setStressFX(f => !f)}
                      className={`shrink-0 ml-3 text-[11px] px-3 py-1 rounded-lg border transition-colors ${
                        stressFX ? 'bg-[#2B6B5A] text-white border-[#2B6B5A]' : 'bg-white dark:bg-[#162534] text-[#5C6880] dark:text-[#7B8DA6] border-[#DDD9D1] dark:border-[#1e3347] hover:border-[#2B6B5A]'
                      }`}>&#127464;&#127469; CHF</button>
                  )}
                </div>
                {stressResults.map((sc, i) => (
                  <div key={i} className="rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-4 space-y-2">
                    <div className="flex justify-between items-center">
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
                        ? `Récupération estimée : ~${sc.recovery} an${sc.recovery > 1 ? 's' : ''} (E(Rp) = ${((stressFX ? er_chf : er) * 100).toFixed(1)} %/an${stressFX ? ' CHF' : ''})`
                        : 'Gain net — aucune perte de capital.'}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* ── Frontière efficiente ── */}
            {tab === 'frontier' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-[#8899AA]">
                    {histStats?.tickerStats && Object.keys(histStats.tickerStats).length >= 2
                      ? `Des milliers de répartitions alternatives ont été testées à partir de vos actifs réels${frontierFX ? ' (ajusté CHF)' : ''} (${histStats.period}). Chaque point est un portefeuille possible — plus il est à gauche, moins il est risqué ; plus il est haut, plus il est rentable.`
                      : `Des milliers de répartitions alternatives ont été simulées. Chaque point est un portefeuille possible — plus il est à gauche, moins il est risqué ; plus il est haut, plus il est rentable.`}
                    {'  '}<span className="opacity-60">🔴 Votre portefeuille actuel · 🟠 Meilleur ratio rendement/risque · 🔵 Moins risqué possible.</span>
                  </p>
                  {histStats?.chf && (
                    <button onClick={() => setFrontierFX(f => !f)}
                      className={`shrink-0 ml-3 text-[11px] px-3 py-1 rounded-lg border transition-colors ${
                        frontierFX ? 'bg-[#2B6B5A] text-white border-[#2B6B5A]' : 'bg-white dark:bg-[#162534] text-[#5C6880] dark:text-[#7B8DA6] border-[#DDD9D1] dark:border-[#1e3347] hover:border-[#2B6B5A]'
                      }`}>&#127464;&#127469; CHF</button>
                  )}
                </div>
                <div className="rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-3 bg-[#FAFAF8] dark:bg-[#0F1E2E]">
                  {frontierSVG()}
                </div>
                {frontier.maxSharpe && frontier.minSigma && (
                  <div className="grid grid-cols-3 gap-3">
                    {tile('Votre Sharpe actuel', (frontierFX && histStats?.chf ? sharpe_chf : sharpe).toFixed(3), 'Ratio de Sharpe de votre portefeuille actuel = (E(Rp) − Rf) / σ. Comparez-le au max Sharpe théorique pour évaluer l\'efficience de votre allocation.', '#EF4444')}
                    {tile('Sharpe maximum théorique', frontier.maxSharpe.sh.toFixed(3), `Meilleur ratio rendement/risque parmi les portefeuilles simulés. E(R) = ${(frontier.maxSharpe.r * 100).toFixed(1)} % pour σ = ${(frontier.maxSharpe.s * 100).toFixed(1)} %. C\'est le portefeuille tangent de la frontière de Markowitz.`, '#F59E0B')}
                    {tile('Min σ', `${(frontier.minSigma.s * 100).toFixed(1)} %`, `E(R) ${(frontier.minSigma.r * 100).toFixed(1)} %`, '#3B82F6')}
                  </div>
                )}

                {/* Allocations optimales par actif */}
                {(frontier.maxSharpeWeights || frontier.minSigmaWeights) && histStats?.tickerStats && (
                  <div>
                    <p className="text-[11px] font-semibold text-[#5C6880] dark:text-[#7B8DA6] uppercase tracking-wide mb-2">Allocations optimales théoriques par actif</p>
                    <div className="rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-[#F3F0EA] dark:bg-[#1e3347] text-[#5C6880] dark:text-[#7B8DA6]">
                            <th className="text-left px-4 py-2 font-semibold">Actif</th>
                            <th className="text-right px-4 py-2 font-semibold">Poids actuel</th>
                            <th className="text-right px-4 py-2 font-semibold" style={{ color: '#F59E0B' }}>Max Sharpe</th>
                            <th className="text-right px-4 py-2 font-semibold" style={{ color: '#3B82F6' }}>Min σ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(histStats.tickerStats)
                            .sort((a, b) => b[1].weight - a[1].weight)
                            .map(([ticker, ts], i) => (
                            <tr key={ticker} className={i % 2 === 0 ? 'bg-white dark:bg-[#162534]' : 'bg-[#FAFAF8] dark:bg-[#0F1E2E]'}>
                              <td className="px-4 py-2">
                                <p className="font-medium text-[#1B3050] dark:text-white">{ts.nom}</p>
                                <p className="text-[10px] text-[#8899AA]">{ticker} · {ts.categorie}</p>
                              </td>
                              <td className="px-4 py-2 text-right font-mono">{(ts.weight * 100).toFixed(1)} %</td>
                              <td className="px-4 py-2 text-right font-mono" style={{ color: '#F59E0B' }}>
                                {frontier.maxSharpeWeights ? `${((frontier.maxSharpeWeights[ticker] ?? 0) * 100).toFixed(1)} %` : '—'}
                              </td>
                              <td className="px-4 py-2 text-right font-mono" style={{ color: '#3B82F6' }}>
                                {frontier.minSigmaWeights ? `${((frontier.minSigmaWeights[ticker] ?? 0) * 100).toFixed(1)} %` : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-[10px] text-[#8899AA] mt-1">
                      Allocations issues de 2 000 portefeuilles Dirichlet aléatoires — données historiques réelles. Résultats théoriques, non garantis.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── Sources & Paramètres ── */}
            {tab === 'sources' && (
              <div className="space-y-5">
                <div className="rounded-lg border border-[#DDD9D1] dark:border-[#1e3347] bg-[#FAFAF8] dark:bg-[#0F1E2E] p-4">
                  <p className="text-xs font-semibold text-[#1B3050] dark:text-white mb-1">Méthodologie</p>
                  {histLoading && (
                    <p className="text-xs text-[#5C6880] dark:text-[#7B8DA6] italic">Chargement des données historiques Yahoo Finance…</p>
                  )}
                  {histStats && (
                    <p className="text-xs text-[#5C6880] dark:text-[#7B8DA6] leading-relaxed">
                      Toutes les statistiques sont calculées sur <strong>{histStats.months} mois</strong> de données de marché réelles ({histStats.period}), issues de Yahoo Finance.
                      Les calculs utilisent la <strong>répartition actuelle</strong> de votre portefeuille, appliquée sur toute la période — comme si vous aviez toujours eu cette allocation.
                      Le risque de perte (VaR/CVaR) est estimé directement à partir des variations historiques observées. La volatilité et le rendement moyen sont exprimés en valeurs annuelles.
                    </p>
                  )}
                  {!histStats && !histLoading && (
                    <p className="text-xs text-[#5C6880] dark:text-[#7B8DA6] leading-relaxed">
                      Les données historiques ne sont pas encore disponibles — les statistiques affichées reposent sur des valeurs de référence estimées par catégorie d'actif (rendement, risque et corrélations moyens observés entre 2000 et 2024).
                    </p>
                  )}
                </div>

                {!histStats && (
                  <div>
                    <p className="text-[11px] font-semibold text-[#5C6880] dark:text-[#7B8DA6] uppercase tracking-wide mb-2">Paramètres modèles par catégorie (fallback)</p>
                    <div className="rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-[#F3F0EA] dark:bg-[#1e3347] text-[#5C6880] dark:text-[#7B8DA6]">
                            <th className="text-left px-4 py-2 font-semibold">Catégorie</th>
                            <th className="text-right px-4 py-2 font-semibold">β CAPM</th>
                            <th className="text-right px-4 py-2 font-semibold">E(R)</th>
                            <th className="text-right px-4 py-2 font-semibold">σ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {CATS.filter(cat => (catWeights[cat] ?? 0) > 0).map((cat, i) => (
                            <tr key={cat} className={i % 2 === 0 ? 'bg-white dark:bg-[#162534]' : 'bg-[#FAFAF8] dark:bg-[#0F1E2E]'}>
                              <td className="px-4 py-2 font-medium text-[#1B3050] dark:text-white">{cat}</td>
                              <td className="px-4 py-2 text-right font-mono">{BETA[cat]?.toFixed(2) ?? '—'}</td>
                              <td className="px-4 py-2 text-right font-mono text-[#2B6B5A]">{((EXPECTED_RETURN[cat] ?? 0) * 100).toFixed(1)} %</td>
                              <td className="px-4 py-2 text-right font-mono">{((CAT_VOL[cat] ?? 0) * 100).toFixed(0)} %</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-[10px] text-[#8899AA] mt-1">E(R) = Rf + β × (E(Rm) − Rf) — Rf = 0,8 % · E(Rm) = 9,5 %</p>
                  </div>
                )}

                {/* Avertissements actifs exclus / réducteurs */}
                {histStats && histStats.excluded.length > 0 && (
                  <div className="rounded-lg border border-[#EF444433] bg-[#EF44440D] p-3 space-y-1">
                    <p className="text-[11px] font-semibold text-[#EF4444] uppercase tracking-wide">Actifs exclus de l'analyse (historique {'<'} 10 ans)</p>
                    {histStats.excluded.map(e => (
                      <p key={e.ticker} className="text-xs text-[#5C6880] dark:text-[#7B8DA6]">
                        <span className="font-medium text-[#EF4444]">{e.nom} ({e.ticker})</span> — seulement {Math.round(e.months / 12 * 10) / 10} an{e.months >= 24 ? 's' : ''} de données disponibles. Non pris en compte dans les statistiques ; paramètre modèle utilisé comme substitut pour son poids.
                      </p>
                    ))}
                  </div>
                )}
                {histStats && histStats.reducing.length > 0 && (
                  <div className="rounded-lg border border-[#F9731633] bg-[#F973160D] p-3 space-y-1">
                    <p className="text-[11px] font-semibold text-[#F97316] uppercase tracking-wide">Actifs qui réduisent la période d'analyse</p>
                    {histStats.reducing.map(r => (
                      <p key={r.ticker} className="text-xs text-[#5C6880] dark:text-[#7B8DA6]">
                        <span className="font-medium text-[#F97316]">{r.nom} ({r.ticker})</span> — historique disponible depuis {r.start.slice(0, 7)}, ce qui raccourcit la période de calcul de <span className="font-medium">{Math.round(r.reducedBy / 12 * 10) / 10} an{r.reducedBy >= 24 ? 's' : ''}</span> pour l'ensemble du portefeuille.
                      </p>
                    ))}
                  </div>
                )}

                <div>
                  <p className="text-[11px] font-semibold text-[#5C6880] dark:text-[#7B8DA6] uppercase tracking-wide mb-2">Actifs du portefeuille</p>
                  <div className="rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-[#F3F0EA] dark:bg-[#1e3347] text-[#5C6880] dark:text-[#7B8DA6]">
                          <th className="text-left px-4 py-2 font-semibold">Actif</th>
                          <th className="text-left px-4 py-2 font-semibold">Catégorie</th>
                          <th className="text-right px-4 py-2 font-semibold">Poids</th>
                          <th className="text-right px-4 py-2 font-semibold">Statut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const map = new Map<string, typeof data>()
                          for (const p of data) { const arr = map.get(p.ticker) ?? []; arr.push(p); map.set(p.ticker, arr) }
                          return Array.from(map.entries()).map(([ticker, ps], i) => {
                            const valG = ps.reduce((s, p) => s + p.valeurCHF, 0)
                            const pctG = total > 0 ? (valG / total * 100) : 0
                            const isExcluded = histStats?.excluded.some(e => e.ticker === ticker)
                            const isReducing = histStats?.reducing.some(r => r.ticker === ticker)
                            const isMulti = ps.length > 1
                            const isExp   = expSrcTickers.has(ticker)
                            const bg = i % 2 === 0 ? 'bg-white dark:bg-[#162534]' : 'bg-[#FAFAF8] dark:bg-[#0F1E2E]'
                            return (
                              <React.Fragment key={ticker}>
                                <tr className={`${bg} ${isMulti ? 'cursor-pointer select-none' : ''}`}
                                    onClick={isMulti ? () => toggleSrcTicker(ticker) : undefined}>
                                  <td className="px-4 py-2">
                                    <div className="flex items-center gap-1.5">
                                      {isMulti && <span className={`text-[#9E9A93] text-[9px] inline-block ${isExp ? 'rotate-90' : ''}`}>▶</span>}
                                      <div>
                                        <p className="font-medium text-[#1B3050] dark:text-white">{ps[0].nom}</p>
                                        <p className="text-[10px] text-[#8899AA]">{ticker}{isMulti && <span className="ml-1 text-[#B5820F]">×{ps.length}</span>}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2 text-[#5C6880] dark:text-[#7B8DA6]">{ps[0].categorie}</td>
                                  <td className="px-4 py-2 text-right font-mono">{pctG.toFixed(1)} %</td>
                                  <td className="px-4 py-2 text-right">
                                    {!histStats ? <span className="text-[#8899AA]">—</span>
                                      : isExcluded ? <span className="text-[#EF4444] font-medium">Exclu</span>
                                      : isReducing ? <span className="text-[#F97316] font-medium">Réduit la période</span>
                                      : <span className="text-[#22C55E] font-medium">Inclus</span>}
                                  </td>
                                </tr>
                                {isMulti && isExp && ps.map((p, j) => (
                                  <tr key={p.id} className="bg-[#F5F3EF]/60 dark:bg-[#0F1E2E]/80 border-l-4 border-[#B5820F]/20">
                                    <td className="px-4 py-1.5 pl-9">
                                      <p className="text-[11px] text-[#5C6880]">Lot {j + 1} — {p.dateAchat}</p>
                                    </td>
                                    <td className="px-4 py-1.5 text-[11px] text-[#8899AA]">{p.categorie}</td>
                                    <td className="px-4 py-1.5 text-right font-mono text-[11px] text-[#8899AA]">{total > 0 ? (p.valeurCHF / total * 100).toFixed(1) : '0.0'} %</td>
                                    <td className="px-4 py-1.5 text-right text-[11px] text-[#8899AA]">—</td>
                                  </tr>
                                ))}
                              </React.Fragment>
                            )
                          })
                        })()}
                      </tbody>
                    </table>
                  </div>
                  {histStats && (
                    <p className="text-[10px] text-[#8899AA] mt-1">
                      Période retenue : <strong>{histStats.period}</strong> ({histStats.months} mois) — intersection des historiques de tous les actifs inclus.
                    </p>
                  )}
                </div>
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
  const [dividendYields, setDividendYields] = useState<Record<string, number>>({})
  const [dividendHistory, setDividendHistory] = useState<Record<string, { ts: number; amount: number }[]>>({})
  const [maxDrawdown, setMaxDrawdown] = useState<{ pct: number; startDate: string; endDate: string } | null>(null)
  const [evolMonthlyPts, setEvolMonthlyPts] = useState<{ x: number; cost: number; value: number; label: string }[] | null>(null)
  const [pnlShowDividends, setPnlShowDividends] = useState(false)
  const [activeTab, setActiveTab] = useState<'positions' | 'analyse'>('positions')
  const [expandedTickers, setExpandedTickers] = useState<Set<string>>(new Set())
  const toggleTicker = (ticker: string) => setExpandedTickers(prev => {
    const next = new Set(prev)
    if (next.has(ticker)) next.delete(ticker); else next.add(ticker)
    return next
  })
  const [chartMode, setChartMode] = useState<'evol' | 'pnl' | 'drawdown'>('evol')
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
  const [profile, setProfile] = useState<InvProfile>({
    horizon: 10,
    loss: 25,
    liquidity: 'moyenne',
    objective: 'modéré',
  })

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

  // ── Groupement par ticker ────────────────────────────────────────────────────
  const groupedCalc = useMemo(() => {
    const map = new Map<string, PositionCalc[]>()
    for (const p of positionsCalc) {
      const arr = map.get(p.ticker) ?? []
      arr.push(p)
      map.set(p.ticker, arr)
    }
    return Array.from(map.entries()).map(([ticker, ps]) => {
      const valeurCHF   = ps.reduce((s, p) => s + p.valeurCHF, 0)
      const coutCHF     = ps.reduce((s, p) => s + p.coutCHF, 0)
      const gainCHF     = ps.reduce((s, p) => s + p.gainCHF, 0)
      const gainPctCHF  = coutCHF > 0 ? (gainCHF / coutCHF) * 100 : 0
      const gainDevise  = ps.reduce((s, p) => s + p.gainDevise, 0)
      const coutDevise  = ps.reduce((s, p) => s + p.quantite * p.prixAchat, 0)
      const gainPctDevise = coutDevise > 0 ? (gainDevise / coutDevise) * 100 : 0
      const impactFX    = ps.reduce((s, p) => s + p.impactFX, 0)
      const gainReel    = ps.reduce((s, p) => s + p.gainReel, 0)
      const gainPctReel = coutCHF > 0 ? (gainReel / coutCHF) * 100 : 0
      const quantite    = ps.reduce((s, p) => s + p.quantite, 0)
      const derniereMaj = ps.reduce((lat, p) => (!p.derniereMaj ? lat : !lat ? p.derniereMaj : p.derniereMaj > lat ? p.derniereMaj : lat), null as string | null)
      return { ticker, nom: ps[0].nom, categorie: ps[0].categorie, devise: ps[0].devise,
        prixActuel: ps[0].prixActuel, tauxActuelCHF: ps[0].tauxActuelCHF,
        quantite, valeurCHF, coutCHF, gainCHF, gainPctCHF,
        gainDevise, gainPctDevise, impactFX, gainReel, gainPctReel, derniereMaj,
        positions: ps }
    })
  }, [positionsCalc])

  // ── Dividendes reçus depuis l'achat ─────────────────────────────────────────
  const totalDividendsReceived = useMemo(() => {
    const nowTs = Date.now() / 1000
    return positionsCalc.reduce((sum, p) => {
      const divs = dividendHistory[p.ticker] ?? []
      const purchaseTs = new Date(p.dateAchat).getTime() / 1000
      const divSum = divs
        .filter(d => d.ts >= purchaseTs && d.ts <= nowTs)
        .reduce((s, d) => s + d.amount, 0)
      return sum + p.quantite * divSum * p.tauxActuelCHF
    }, 0)
  }, [positionsCalc, dividendHistory])

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
            <p className="text-[#5C6880] text-sm">Suivi de vos positions avec performance nominale, ajustée à l&apos;évolution du taux du CHF et à l&apos;inflation réelle.</p>
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6 items-stretch">
              <div className="lg:col-span-1 flex flex-col gap-4">
                <div className="flex-1 bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-5">
                  <p className="text-xs font-semibold text-[#5C6880] uppercase tracking-wider mb-1">Valeur totale</p>
                  <p className="text-2xl font-bold font-mono" style={{ fontVariantNumeric: 'tabular-nums' }}>{chf(totals.valeurTotal)}</p>
                  <p className="text-xs text-[#9E9A93] mt-0.5">Investi: {chf(totals.coutTotal)}</p>
                </div>
                <div className="flex-1 bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-5">
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
                <div className="flex-1 bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-5">
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
                <div className="flex-1 bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <p className="text-xs font-semibold text-[#5C6880] uppercase tracking-wider">Dividendes reçus</p>
                    <div className="relative group">
                      <span className="w-4 h-4 rounded-full bg-[#DDD9D1] dark:bg-[#2a3f52] text-[#5C6880] text-[10px] font-bold flex items-center justify-center cursor-default select-none">?</span>
                      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 z-50 hidden group-hover:block pointer-events-none">
                        <div className="bg-[#1B3050] dark:bg-[#0F1E2C] text-white text-xs rounded-xl p-3 shadow-xl space-y-2">
                          <p className="font-semibold text-white/90">Dividendes reçus depuis l'achat</p>
                          <p className="text-white/70 leading-relaxed">Somme des dividendes (ou coupons) versés par chaque position depuis sa date d'achat, convertis en CHF au taux actuel. Source : Yahoo Finance.</p>
                          <div className="w-2 h-2 bg-[#1B3050] dark:bg-[#0F1E2C] rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {totalDividendsReceived > 0 ? (
                    <>
                      <p className="text-xl font-bold font-mono" style={{ color: '#B5820F' }}>+{chf(totalDividendsReceived)}</p>
                      <p className="text-xs text-[#9E9A93] mt-0.5">
                        {totals.coutTotal > 0 ? `Rendement effectif : ${(totalDividendsReceived / totals.coutTotal * 100).toFixed(2)} %` : ''}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-[#9E9A93] mt-1">{Object.keys(dividendHistory).length === 0 ? 'Chargement…' : 'Aucun dividende sur ce portefeuille'}</p>
                  )}
                </div>

                {/* Drawdown Max */}
                <div className="flex-1 bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <p className="text-xs font-semibold text-[#5C6880] uppercase tracking-wider">Drawdown Max</p>
                    <div className="relative group">
                      <span className="w-4 h-4 rounded-full bg-[#DDD9D1] dark:bg-[#2a3f52] text-[#5C6880] text-[10px] font-bold flex items-center justify-center cursor-default select-none">?</span>
                      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 z-50 hidden group-hover:block pointer-events-none">
                        <div className="bg-[#1B3050] dark:bg-[#0F1E2C] text-white text-xs rounded-xl p-3 shadow-xl space-y-2">
                          <p className="font-semibold text-white/90">Drawdown maximum historique</p>
                          <p className="text-white/70 leading-relaxed">Plus grande baisse pic-à-creux observée sur les retours mensuels historiques du portefeuille (ajustés CHF). Mesure le pire scénario de perte réalisée sur la période disponible.</p>
                          <div className="w-2 h-2 bg-[#1B3050] dark:bg-[#0F1E2C] rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {maxDrawdown ? (
                    <>
                      <p className="text-xl font-bold font-mono" style={{ color: '#EF4444' }}>{maxDrawdown.pct.toFixed(2)} %</p>
                      <p className="text-xs text-[#9E9A93] mt-0.5">{maxDrawdown.startDate} → {maxDrawdown.endDate}</p>
                    </>
                  ) : (
                    <p className="text-sm text-[#9E9A93] mt-1">{maxDrawdown === null && Object.keys(dividendHistory).length === 0 ? 'Chargement…' : 'Données insuffisantes'}</p>
                  )}
                </div>
              </div>

              <div className="lg:col-span-2 flex flex-col gap-4">
                <div className="flex-1 bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold">{chartMode === 'evol' ? 'Évolution du portefeuille' : chartMode === 'pnl' ? 'PnL cumulé' : 'Drawdown'}</h3>
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
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={pnlShowDividends} onChange={e => setPnlShowDividends(e.target.checked)}
                              className="w-3.5 h-3.5 rounded" style={{ accentColor: '#B5820F' }} />
                            <span className="text-xs font-medium" style={{ color: '#B5820F' }}>Dividendes</span>
                          </label>
                        </div>
                      )}
                      <div className="flex bg-[#F5F3EF] dark:bg-[#1B2D3E] rounded-lg p-0.5 gap-0.5">
                        {(['evol', 'pnl', 'drawdown'] as const).map(m => (
                          <button key={m} onClick={() => setChartMode(m)}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${chartMode === m ? 'bg-white dark:bg-[#162534] text-[#1B3050] dark:text-white shadow-sm' : 'text-[#9E9A93] hover:text-[#5C6880]'}`}>
                            {m === 'evol' ? 'Évolution' : m === 'pnl' ? 'PnL' : 'Drawdown'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {chartMode === 'evol'
                    ? <EvolChart data={positionsCalc} onData={pts => {
                        if (pts.length < 2) return
                        const fmtM = (ym: string) => {
                          const [y, mo] = ym.split('-')
                          const months = ['Jan.','Fév.','Mar.','Avr.','Mai','Juin','Juil.','Août','Sep.','Oct.','Nov.','Déc.']
                          return `${months[+mo - 1]} ${y}`
                        }
                        let peak = pts[0].value, peakLabel = pts[0].label
                        let maxDD = 0, ddStart = pts[0].label, ddEnd = pts[0].label
                        for (const pt of pts) {
                          if (pt.value > peak) { peak = pt.value; peakLabel = pt.label }
                          const dd = peak > 0 ? (peak - pt.value) / peak : 0
                          if (dd > maxDD) { maxDD = dd; ddStart = peakLabel; ddEnd = pt.label }
                        }
                        if (maxDD > 0.001) {
                          setMaxDrawdown({ pct: -maxDD * 100, startDate: fmtM(ddStart), endDate: fmtM(ddEnd) })
                        } else {
                          setMaxDrawdown(null)
                        }
                        setEvolMonthlyPts(pts)
                      }} />
                    : chartMode === 'pnl'
                    ? <PnLChart data={positionsCalc} showNominal={pnlShowNominal} showReel={pnlShowReel} showDividends={pnlShowDividends} dividendHistory={dividendHistory} />
                    : evolMonthlyPts && evolMonthlyPts.length > 1
                    ? <DrawdownChart pts={evolMonthlyPts} />
                    : <p className="text-sm text-[#9E9A93] mt-4 text-center">Chargez d'abord l'évolution pour afficher le drawdown.</p>
                  }
                  <p className="text-xs text-[#9E9A93] mt-2">
                    {chartMode === 'evol' ? 'Valeur mensuelle réelle du portefeuille depuis le premier achat.' : chartMode === 'pnl' ? 'Gain mensuel cumulé basé sur les prix historiques réels.' : 'Drawdown mensuel depuis le pic précédent.'}
                  </p>
                </div>
                <div className="bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-5">
                  <h3 className="text-sm font-semibold mb-4">Allocation par catégorie</h3>
                  <AllocChart data={positionsCalc} />
                </div>
              </div>
            </div>

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
                      {groupedCalc.map(g => {
                        const isMulti = g.positions.length > 1
                        const isExp   = expandedTickers.has(g.ticker)
                        const p0      = g.positions[0]
                        return (
                          <React.Fragment key={g.ticker}>
                            <tr className={`hover:bg-[#F5F3EF]/50 dark:hover:bg-[#1B2D3E]/50 transition-colors ${isMulti ? 'cursor-pointer select-none' : ''}`}
                                onClick={isMulti ? () => toggleTicker(g.ticker) : undefined}>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  {isMulti && (
                                    <span className={`text-[#9E9A93] text-[10px] transition-transform inline-block ${isExp ? 'rotate-90' : ''}`}>▶</span>
                                  )}
                                  <div>
                                    <div className="font-medium">{g.nom}</div>
                                    <div className="text-xs text-[#9E9A93]">
                                      {g.ticker} · {g.categorie}
                                      {isMulti && <span className="ml-1.5 text-[#B5820F]">{g.positions.length} achats</span>}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 font-mono text-xs">{g.quantite}</td>
                              <td className="px-4 py-3 font-mono text-xs">
                                <div>{g.prixActuel.toLocaleString('fr-CH', { maximumFractionDigits: 2 })} {g.devise}</div>
                                {g.devise !== 'CHF' && <div className="text-[#9E9A93]">×{g.tauxActuelCHF.toFixed(4)}</div>}
                              </td>
                              <td className="px-4 py-3 font-mono">
                                <div>{chf(g.valeurCHF)}</div>
                                <div className="text-xs text-[#9E9A93]">Coût: {chf(g.coutCHF)}</div>
                              </td>
                              <td className={`px-4 py-3 font-mono ${clr(g.gainCHF)}`}>{g.gainCHF >= 0 ? '+' : ''}{chf(g.gainCHF)}</td>
                              <td className={`px-4 py-3 font-mono font-semibold ${clr(g.gainPctCHF)}`}>
                                <div>{pct(g.gainPctCHF)}</div>
                                {dividendYields[g.ticker] != null && dividendYields[g.ticker] > 0 && (
                                  <div className="text-[11px] font-normal mt-0.5" style={{ color: '#B5820F' }}>
                                    div. {(dividendYields[g.ticker] * 100).toFixed(2)} %
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-xs text-[#9E9A93]">
                                {g.derniereMaj ? new Date(g.derniereMaj).toLocaleString('fr-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                              </td>
                              <td className="px-4 py-3">
                                {!isMulti && (
                                  <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                    <button onClick={() => openEdit(p0)} className="text-xs text-[#2B6B5A] hover:underline">Modifier</button>
                                    <button onClick={() => deletePosition(p0.id)} className="text-xs text-red-400 hover:underline">Supprimer</button>
                                  </div>
                                )}
                              </td>
                            </tr>
                            {isMulti && isExp && g.positions.map((p, idx) => (
                              <tr key={p.id} className="bg-[#FAFAF8] dark:bg-[#0F1E2E] border-l-4 border-[#B5820F]/25">
                                <td className="px-4 py-2 pl-10">
                                  <div className="text-xs font-medium text-[#5C6880]">Lot {idx + 1} — {p.dateAchat}</div>
                                  <div className="text-[11px] text-[#9E9A93]">Achat : {p.prixAchat.toLocaleString('fr-CH', { maximumFractionDigits: 4 })} {p.devise} × {p.tauxAchatCHF.toFixed(4)}</div>
                                </td>
                                <td className="px-4 py-2 font-mono text-xs">{p.quantite}</td>
                                <td className="px-4 py-2 font-mono text-xs text-[#9E9A93]">—</td>
                                <td className="px-4 py-2 font-mono text-xs">
                                  <div>{chf(p.valeurCHF)}</div>
                                  <div className="text-[11px] text-[#9E9A93]">Coût: {chf(p.coutCHF)}</div>
                                </td>
                                <td className={`px-4 py-2 font-mono text-xs ${clr(p.gainCHF)}`}>{p.gainCHF >= 0 ? '+' : ''}{chf(p.gainCHF)}</td>
                                <td className={`px-4 py-2 font-mono text-xs font-semibold ${clr(p.gainPctCHF)}`}>{pct(p.gainPctCHF)}</td>
                                <td className="px-4 py-2 text-[11px] text-[#9E9A93]">—</td>
                                <td className="px-4 py-2">
                                  <div className="flex gap-2">
                                    <button onClick={() => openEdit(p)} className="text-xs text-[#2B6B5A] hover:underline">Modifier</button>
                                    <button onClick={() => deletePosition(p.id)} className="text-xs text-red-400 hover:underline">Supprimer</button>
                                  </div>
                                </td>
                              </tr>
                            ))}
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
                        {['Position', 'Perf. devise', 'Perf. CHF', 'Impact FX', 'Perf. réelle'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#5C6880] uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F5F3EF] dark:divide-[#1e3347]">
                      {groupedCalc.map(g => {
                        const isMulti = g.positions.length > 1
                        const isExp   = expandedTickers.has(g.ticker)
                        return (
                          <React.Fragment key={g.ticker}>
                            <tr className={`hover:bg-[#F5F3EF]/50 dark:hover:bg-[#1B2D3E]/50 transition-colors ${isMulti ? 'cursor-pointer select-none' : ''}`}
                                onClick={isMulti ? () => toggleTicker(g.ticker) : undefined}>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  {isMulti && (
                                    <span className={`text-[#9E9A93] text-[10px] transition-transform inline-block ${isExp ? 'rotate-90' : ''}`}>▶</span>
                                  )}
                                  <div>
                                    <div className="font-medium">{g.nom}</div>
                                    <div className="text-xs text-[#9E9A93]">
                                      {g.ticker}
                                      {isMulti && <span className="ml-1.5 text-[#B5820F]">{g.positions.length} achats</span>}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className={`px-4 py-3 font-mono ${clr(g.gainPctDevise)}`}>
                                <div>{pct(g.gainPctDevise)}</div>
                                <div className="text-xs text-[#9E9A93]">{g.gainDevise >= 0 ? '+' : ''}{g.gainDevise.toFixed(2)} {g.devise}</div>
                              </td>
                              <td className={`px-4 py-3 font-mono ${clr(g.gainPctCHF)}`}>
                                <div>{pct(g.gainPctCHF)}</div>
                                <div className="text-xs text-[#9E9A93]">{g.gainCHF >= 0 ? '+' : ''}{chf(g.gainCHF)}</div>
                              </td>
                              <td className={`px-4 py-3 font-mono ${clr(g.impactFX)}`}>
                                {g.devise === 'CHF' ? <span className="text-[#9E9A93]">—</span> : <>{g.impactFX >= 0 ? '+' : ''}{chf(g.impactFX)}</>}
                              </td>
                              <td className={`px-4 py-3 font-mono font-semibold ${clr(g.gainPctReel)}`}>
                                <div>{pct(g.gainPctReel)}</div>
                                <div className="text-xs text-[#9E9A93]">{g.gainReel >= 0 ? '+' : ''}{chf(g.gainReel)}</div>
                              </td>
                            </tr>
                            {isMulti && isExp && g.positions.map((p, idx) => (
                              <tr key={p.id} className="bg-[#FAFAF8] dark:bg-[#0F1E2E] border-l-4 border-[#B5820F]/25">
                                <td className="px-4 py-2 pl-10">
                                  <div className="text-xs font-medium text-[#5C6880]">Lot {idx + 1} — {p.dateAchat}</div>
                                </td>
                                <td className={`px-4 py-2 font-mono text-xs ${clr(p.gainPctDevise)}`}>
                                  <div>{pct(p.gainPctDevise)}</div>
                                  <div className="text-[11px] text-[#9E9A93]">{p.gainDevise >= 0 ? '+' : ''}{p.gainDevise.toFixed(2)} {p.devise}</div>
                                </td>
                                <td className={`px-4 py-2 font-mono text-xs ${clr(p.gainPctCHF)}`}>
                                  <div>{pct(p.gainPctCHF)}</div>
                                  <div className="text-[11px] text-[#9E9A93]">{p.gainCHF >= 0 ? '+' : ''}{chf(p.gainCHF)}</div>
                                </td>
                                <td className={`px-4 py-2 font-mono text-xs ${clr(p.impactFX)}`}>
                                  {p.devise === 'CHF' ? <span className="text-[#9E9A93]">—</span> : <>{p.impactFX >= 0 ? '+' : ''}{chf(p.impactFX)}</>}
                                </td>
                                <td className={`px-4 py-2 font-mono text-xs font-semibold ${clr(p.gainPctReel)}`}>
                                  <div>{pct(p.gainPctReel)}</div>
                                  <div className="text-[11px] text-[#9E9A93]">{p.gainReel >= 0 ? '+' : ''}{chf(p.gainReel)}</div>
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <InvestorProfileSection data={positionsCalc} profile={profile} setProfile={setProfile} onDividends={setDividendYields} onDividendHistory={setDividendHistory} />
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
