'use client'

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

// ─── Swiss CPI ────────────────────────────────────────────────────────────────
const INFLATION_CH: Record<number, number> = {
  2015: -0.011, 2016: -0.004, 2017: 0.005, 2018: 0.009, 2019: 0.004,
  2020: -0.007, 2021: 0.006, 2022: 0.028, 2023: 0.021, 2024: 0.013, 2025: 0.010,
}
function inflationCumulee(dateAchat: string): number {
  const anneeAchat = new Date(dateAchat).getFullYear()
  const anneeActuelle = new Date().getFullYear()
  let cumul = 0
  for (let y = anneeAchat; y < anneeActuelle; y++) cumul += INFLATION_CH[y] ?? 0.015
  return cumul
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
  'Autre':             'Rechercher un actif… (ex: ticker Yahoo Finance)',
}

const DEVISES = [
  'CHF', 'USD', 'EUR', 'GBP', 'JPY',
  'AUD', 'CAD', 'CNY', 'HKD', 'SGD',
  'NZD', 'NOK', 'SEK', 'DKK', 'PLN',
  'CZK', 'KRW', 'INR', 'MXN', 'BRL',
  'ZAR', 'TRY',
]
const CATEGORIES = ['Actions', 'ETF', 'Obligations', 'Matières premières', 'Crypto', 'Autre']

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
  'Matières premières': '#7C4F2A', 'Crypto': '#5C3080', 'Autre': '#5C6880',
}
const EMPTY_FORM: Omit<Position, 'id'> = {
  nom: '', ticker: '', categorie: 'Actions', devise: 'USD',
  quantite: 0, prixAchat: 0, tauxAchatCHF: 1,
  dateAchat: new Date().toISOString().slice(0, 10),
  prixActuel: 0, tauxActuelCHF: 1, courtier: '',
}

// ─── Autocomplete ticker ──────────────────────────────────────────────────────
function TickerAutocomplete({
  value, onChange, placeholder, filterTypes, filterExch
}: {
  value: { ticker: string; nom: string; devise: string }
  onChange: (r: { ticker: string; nom: string; devise: string }) => void
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
          'future': 'FUTURE', 'mutual fund': 'MUTUALFUND', 'currency': 'CURRENCY',
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
    onChange({ ticker: r.ticker, nom: r.nom, devise: r.devise })
  }

  function handleClear() {
    setQuery('')
    setSelected(false)
    setResults([])
    onChange({ ticker: '', nom: '', devise: value.devise })
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

// ─── Chart: Evolution ─────────────────────────────────────────────────────────
function EvolChart({ data }: { data: PositionCalc[] }) {
  const W = 600, H = 220, PAD = { t: 16, r: 16, b: 36, l: 64 }
  const iW = W - PAD.l - PAD.r, iH = H - PAD.t - PAD.b
  const points = useMemo(() => {
    if (data.length === 0) return []
    const sorted = [...data].sort((a, b) => new Date(a.dateAchat).getTime() - new Date(b.dateAchat).getTime())
    const today = new Date(), firstDate = new Date(sorted[0].dateAchat)
    const totalMs = today.getTime() - firstDate.getTime()
    if (totalMs <= 0) return []
    let cumCost = 0
    const pts: { x: number; cost: number; value?: number; label: string }[] = []
    for (const p of sorted) {
      const t = (new Date(p.dateAchat).getTime() - firstDate.getTime()) / totalMs
      cumCost += p.coutCHF
      pts.push({ x: t, cost: cumCost, label: p.dateAchat.slice(0, 7) })
    }
    pts.push({ x: 1, cost: cumCost, value: data.reduce((s, p) => s + p.valeurCHF, 0), label: 'Auj.' })
    return pts
  }, [data])

  if (points.length < 2) return (
    <div className="flex items-center justify-center h-36 text-sm text-[#9E9A93]">
      Ajoutez au moins 2 positions pour voir le graphique
    </div>
  )

  const lastVal = points[points.length - 1].value ?? points[points.length - 1].cost
  const allValues = points.flatMap(p => [p.cost, p.value ?? p.cost])
  const maxV = Math.max(...allValues) * 1.08, minV = Math.min(0, ...allValues), span = maxV - minV || 1
  const px = (t: number) => PAD.l + t * iW
  const py = (v: number) => PAD.t + iH - ((v - minV) / span) * iH
  const gain = lastVal - points[points.length - 1].cost
  const lineColor = gain >= 0 ? '#2B6B5A' : '#DC2626'
  const costPath = points.map((p, i) => {
    if (i === 0) return `M ${px(p.x)} ${py(p.cost)}`
    return `L ${px(p.x)} ${py(points[i - 1].cost)} L ${px(p.x)} ${py(p.cost)}`
  }).join(' ')
  const valuePath = `M ${px(points[0].x)} ${py(points[0].cost)} L ${px(1)} ${py(lastVal)}`
  const tickVals = Array.from({ length: 5 }, (_, i) => minV + (span * i) / 4)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      <defs>
        <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.18" /><stop offset="100%" stopColor={lineColor} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="gc" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5C6880" stopOpacity="0.08" /><stop offset="100%" stopColor="#5C6880" stopOpacity="0" />
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
      <path d={`${costPath} L ${px(1)} ${py(minV)} L ${px(points[0].x)} ${py(minV)} Z`} fill="url(#gc)" />
      <path d={`${valuePath} L ${px(1)} ${py(minV)} L ${px(points[0].x)} ${py(minV)} Z`} fill="url(#gv)" />
      <path d={costPath} fill="none" stroke="#9E9A93" strokeWidth="1.5" strokeDasharray="4 3" />
      <path d={valuePath} fill="none" stroke={lineColor} strokeWidth="2" />
      <circle cx={px(1)} cy={py(lastVal)} r="4" fill={lineColor} />
      <text x={px(points[0].x)} y={H - 6} textAnchor="middle" fontSize="10" fill="#9E9A93">{points[0].label}</text>
      <text x={px(1)} y={H - 6} textAnchor="middle" fontSize="10" fill="#9E9A93">Auj.</text>
      <g transform={`translate(${PAD.l + 8}, ${PAD.t + 8})`}>
        <line x1="0" y1="6" x2="18" y2="6" stroke="#9E9A93" strokeWidth="1.5" strokeDasharray="4 3" />
        <text x="22" y="10" fontSize="10" fill="#9E9A93">Investi</text>
        <line x1="60" y1="6" x2="78" y2="6" stroke={lineColor} strokeWidth="2" />
        <text x="82" y="10" fontSize="10" fill={lineColor}>Valeur actuelle</text>
      </g>
    </svg>
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
    'Autre':              [], // pas de filtre
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

  // ── Fetch prix historique ────────────────────────────────────────────────────
  async function fetchPrixAchatFor(ticker: string, devise: string, date: string) {
    if (!ticker.trim() || !date) return
    setFetchingAchat(true); setFetchModalError(null)
    try {
      const res = await fetch(`/api/prices?ticker=${encodeURIComponent(ticker)}&devise=${devise}&date=${date}`)
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
  function deletePosition(id: string) { setPositions(ps => ps.filter(p => p.id !== id)) }
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
              <button onClick={refreshPrices} disabled={refreshing}
                className="border border-[#2B6B5A] text-[#2B6B5A] text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#2B6B5A]/10 disabled:opacity-40 transition-colors flex items-center gap-2">
                <span className={refreshing ? 'animate-spin inline-block' : ''}>⟳</span>
                {refreshing ? 'Mise à jour…' : 'Rafraîchir les prix'}
              </button>
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
                  <p className="text-xs font-semibold text-[#5C6880] uppercase tracking-wider mb-1">Gain nominal CHF</p>
                  <p className={`text-xl font-bold font-mono ${clr(totals.gainTotal)}`}>{totals.gainTotal >= 0 ? '+' : ''}{chf(totals.gainTotal)}</p>
                  <p className={`text-sm font-mono ${clr(totals.gainPct)}`}>{pct(totals.gainPct)}</p>
                </div>
                <div className="bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-5">
                  <p className="text-xs font-semibold text-[#5C6880] uppercase tracking-wider mb-1">Gain réel (après inflation)</p>
                  <p className={`text-xl font-bold font-mono ${clr(totals.gainReelTotal)}`}>{totals.gainReelTotal >= 0 ? '+' : ''}{chf(totals.gainReelTotal)}</p>
                  <p className={`text-sm font-mono ${clr(totals.gainReelPct)}`}>{pct(totals.gainReelPct)}</p>
                </div>
                <div className="bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-5">
                  <p className="text-xs font-semibold text-[#5C6880] uppercase tracking-wider mb-1">Impact taux de change</p>
                  <p className={`text-xl font-bold font-mono ${clr(totals.fxTotal)}`}>{totals.fxTotal >= 0 ? '+' : ''}{chf(totals.fxTotal)}</p>
                  <p className="text-xs text-[#9E9A93] mt-0.5">Effet seul des variations FX</p>
                </div>
              </div>

              <div className="lg:col-span-2 space-y-4">
                <div className="bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-5">
                  <h3 className="text-sm font-semibold mb-3">Évolution du portefeuille</h3>
                  <EvolChart data={positionsCalc} />
                  <p className="text-xs text-[#9E9A93] mt-2">Valeur estimée depuis le premier achat — sans prix historiques intermédiaires.</p>
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
                        {['Position', 'Courtier', 'Qté', 'Prix actuel', 'Valeur CHF', 'Gain CHF', 'Perf.', 'MAJ', 'Actions'].map(h => (
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
                          <td className="px-4 py-3">
                            {p.courtier ? (
                              <span className="text-xs text-[#5C6880]">
                                {BROKER_PROFILES[p.courtier]?.emoji} {p.courtier}
                              </span>
                            ) : (
                              <span className="text-xs text-[#9E9A93]">—</span>
                            )}
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
      <Footer />

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#DDD9D1] dark:border-[#1e3347]">
              <h2 className="font-semibold">{editId ? 'Modifier la position' : 'Ajouter une position'}</h2>
              <button onClick={() => setShowModal(false)} className="text-[#9E9A93] hover:text-[#1B3050] dark:hover:text-white text-xl">×</button>
            </div>
            <div className="p-6 space-y-5">

              {/* 0. Courtier */}
              <div>
                <label className="block text-xs font-medium text-[#5C6880] mb-2">Plateforme d'investissement <span className="text-[#9E9A93] font-normal">(optionnel)</span></label>
                <div className="flex flex-wrap gap-2">
                  <button type="button"
                    onClick={() => setForm(f => ({ ...f, courtier: '' }))}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      !form.courtier
                        ? 'bg-[#1B3050] text-white border-[#1B3050]'
                        : 'border-[#DDD9D1] dark:border-[#2a3f52] text-[#5C6880] hover:border-[#1B3050] hover:text-[#1B3050] dark:hover:text-white'
                    }`}>
                    Tous marchés
                  </button>
                  {Object.entries(BROKER_PROFILES).map(([name, profile]) => (
                    <button key={name} type="button"
                      onClick={() => setForm(f => ({ ...f, courtier: name }))}
                      title={profile.description}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        form.courtier === name
                          ? 'bg-[#1B3050] text-white border-[#1B3050]'
                          : 'border-[#DDD9D1] dark:border-[#2a3f52] text-[#5C6880] hover:border-[#1B3050] hover:text-[#1B3050] dark:hover:text-white'
                      }`}>
                      {profile.emoji} {name}
                    </button>
                  ))}
                </div>
                {brokerProfile && (
                  <p className="text-xs text-[#9E9A93] mt-1.5">{brokerProfile.description}</p>
                )}
              </div>

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
                  onChange={({ ticker, nom, devise }) => {
                    setForm(f => ({ ...f, ticker, nom, devise }))
                    setFetchModalError(null)
                    if (ticker) {
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
                      if (form.ticker && date) fetchPrixAchatFor(form.ticker, form.devise, date)
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
                      <select className={inputCls} value={form.devise} onChange={fld('devise')}>
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
