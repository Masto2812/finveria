'use client'

import React, { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'

// ─── Swiss CPI (OFS, annual average, 2015=base) ───────────────────────────────
const INFLATION_CH: Record<number, number> = {
  2015: -0.011, 2016: -0.004, 2017: 0.005, 2018: 0.009, 2019: 0.004,
  2020: -0.007, 2021: 0.006, 2022: 0.028, 2023: 0.021, 2024: 0.013, 2025: 0.010,
}

function inflationCumulee(dateAchat: string): number {
  const anneeAchat = new Date(dateAchat).getFullYear()
  const anneeActuelle = new Date().getFullYear()
  let cumul = 0
  for (let y = anneeAchat; y < anneeActuelle; y++) {
    cumul += INFLATION_CH[y] ?? 0.015
  }
  return cumul
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Position {
  id: string
  nom: string
  ticker: string
  categorie: string
  devise: string
  quantite: number
  prixAchat: number
  tauxAchatCHF: number
  dateAchat: string
  prixActuel: number
  tauxActuelCHF: number
}

interface PositionCalc extends Position {
  coutCHF: number
  valeurCHF: number
  gainCHF: number
  gainPctCHF: number
  gainDevise: number
  gainPctDevise: number
  impactFX: number
  gainReel: number
  gainPctReel: number
}

const DEVISES = ['CHF', 'USD', 'EUR', 'GBP', 'JPY', 'SEK', 'NOK', 'DKK']
const CATEGORIES = ['Actions', 'ETF', 'Obligations', 'Matières premières', 'Crypto', 'Autre']

const CAT_COLOR: Record<string, string> = {
  'Actions': '#2B6B5A',
  'ETF': '#1B3050',
  'Obligations': '#B5820F',
  'Matières premières': '#7C4F2A',
  'Crypto': '#5C3080',
  'Autre': '#5C6880',
}

const EMPTY_FORM: Omit<Position, 'id'> = {
  nom: '', ticker: '', categorie: 'Actions', devise: 'USD',
  quantite: 0, prixAchat: 0, tauxAchatCHF: 1,
  dateAchat: new Date().toISOString().slice(0, 10),
  prixActuel: 0, tauxActuelCHF: 1,
}

// ─── Chart: Evolution du portefeuille ────────────────────────────────────────
function EvolChart({ data }: { data: PositionCalc[] }) {
  const W = 600, H = 220, PAD = { t: 16, r: 16, b: 36, l: 64 }
  const iW = W - PAD.l - PAD.r
  const iH = H - PAD.t - PAD.b

  const points = useMemo(() => {
    if (data.length === 0) return []
    const sorted = [...data].sort(
      (a, b) => new Date(a.dateAchat).getTime() - new Date(b.dateAchat).getTime()
    )
    const today = new Date()
    const firstDate = new Date(sorted[0].dateAchat)
    const totalMs = today.getTime() - firstDate.getTime()

    // Build cumulative cost timeline
    let cumCost = 0
    const pts: { x: number; cost: number; value: number; label: string }[] = []

    for (const p of sorted) {
      const t = (new Date(p.dateAchat).getTime() - firstDate.getTime()) / totalMs
      cumCost += p.coutCHF
      pts.push({ x: t, cost: cumCost, value: cumCost, label: p.dateAchat.slice(0, 7) })
    }
    // Today: value = total portfolio value
    const totalValue = data.reduce((s, p) => s + p.valeurCHF, 0)
    pts.push({ x: 1, cost: cumCost, value: totalValue, label: "Auj." })

    return pts
  }, [data])

  if (points.length < 2) {
    return (
      <div className="flex items-center justify-center h-36 text-sm text-[#9E9A93]">
        Ajoutez au moins 2 positions pour voir le graphique
      </div>
    )
  }

  const allValues = points.flatMap(p => [p.cost, p.value])
  const maxV = Math.max(...allValues) * 1.08
  const minV = Math.min(0, ...allValues)
  const span = maxV - minV || 1

  const px = (t: number) => PAD.l + t * iW
  const py = (v: number) => PAD.t + iH - ((v - minV) / span) * iH

  // Cost path (step function)
  const costPath = points.map((p, i) => {
    if (i === 0) return `M ${px(p.x)} ${py(p.cost)}`
    const prev = points[i - 1]
    return `L ${px(p.x)} ${py(prev.cost)} L ${px(p.x)} ${py(p.cost)}`
  }).join(' ')

  // Value line (straight to today)
  const valuePath = `M ${px(points[0].x)} ${py(points[0].cost)} L ${px(1)} ${py(points[points.length - 1].value)}`

  const lastValue = points[points.length - 1].value
  const lastCost = points[points.length - 1].cost
  const gain = lastValue - lastCost
  const lineColor = gain >= 0 ? '#2B6B5A' : '#DC2626'

  // Y ticks
  const yTicks = 4
  const tickVals = Array.from({ length: yTicks + 1 }, (_, i) =>
    minV + (span * i) / yTicks
  )

  // Date labels: first + last
  const labels = [
    { x: px(points[0].x), label: points[0].label },
    { x: px(1), label: 'Auj.' },
  ]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      <defs>
        <linearGradient id="gradValue" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.18" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="gradCost" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5C6880" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#5C6880" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Grid */}
      {tickVals.map((v, i) => (
        <g key={i}>
          <line x1={PAD.l} y1={py(v)} x2={W - PAD.r} y2={py(v)}
            stroke="#DDD9D1" strokeWidth="0.5" strokeDasharray="3 3" />
          <text x={PAD.l - 6} y={py(v) + 4} textAnchor="end"
            fontSize="10" fill="#9E9A93">
            {v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)}
          </text>
        </g>
      ))}

      {/* Cost area fill */}
      <path
        d={`${costPath} L ${px(1)} ${py(minV)} L ${px(points[0].x)} ${py(minV)} Z`}
        fill="url(#gradCost)"
      />

      {/* Value area fill */}
      <path
        d={`${valuePath} L ${px(1)} ${py(minV)} L ${px(points[0].x)} ${py(minV)} Z`}
        fill="url(#gradValue)"
      />

      {/* Cost line (dashed) */}
      <path d={costPath} fill="none" stroke="#9E9A93" strokeWidth="1.5" strokeDasharray="4 3" />

      {/* Value line */}
      <path d={valuePath} fill="none" stroke={lineColor} strokeWidth="2" />

      {/* Endpoint dot */}
      <circle cx={px(1)} cy={py(lastValue)} r="4" fill={lineColor} />

      {/* Date labels */}
      {labels.map(({ x, label }) => (
        <text key={label} x={x} y={H - 6} textAnchor="middle"
          fontSize="10" fill="#9E9A93">
          {label}
        </text>
      ))}

      {/* Legend */}
      <g transform={`translate(${PAD.l + 8}, ${PAD.t + 8})`}>
        <line x1="0" y1="6" x2="18" y2="6" stroke="#9E9A93" strokeWidth="1.5" strokeDasharray="4 3" />
        <text x="22" y="10" fontSize="10" fill="#9E9A93">Investi</text>
        <line x1="60" y1="6" x2="78" y2="6" stroke={lineColor} strokeWidth="2" />
        <text x="82" y="10" fontSize="10" fill={lineColor}>Valeur actuelle</text>
      </g>
    </svg>
  )
}

// ─── Chart: Allocation par catégorie ─────────────────────────────────────────
function AllocChart({ data }: { data: PositionCalc[] }) {
  if (data.length === 0) return null

  const totalVal = data.reduce((s, p) => s + p.valeurCHF, 0)
  if (totalVal <= 0) return null

  const byCategory = CATEGORIES.map(cat => ({
    cat,
    val: data.filter(p => p.categorie === cat).reduce((s, p) => s + p.valeurCHF, 0),
    color: CAT_COLOR[cat],
  })).filter(c => c.val > 0).sort((a, b) => b.val - a.val)

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
              <div
                className="h-2 rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function PortfolioPage() {
  const [positions, setPositions] = useState<Position[]>([])
  const [activeTab, setActiveTab] = useState<'positions' | 'analyse'>('positions')
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<Position, 'id'>>(EMPTY_FORM)

  // Load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('finveria_portfolio')
      if (raw) setPositions(JSON.parse(raw))
    } catch {}
  }, [])

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('finveria_portfolio', JSON.stringify(positions))
    } catch {}
  }, [positions])

  // Calculated positions
  const positionsCalc: PositionCalc[] = useMemo(() =>
    positions.map(p => {
      const coutCHF = p.quantite * p.prixAchat * p.tauxAchatCHF
      const valeurCHF = p.quantite * p.prixActuel * p.tauxActuelCHF
      const gainCHF = valeurCHF - coutCHF
      const gainPctCHF = coutCHF > 0 ? (gainCHF / coutCHF) * 100 : 0
      const gainDevise = p.quantite * (p.prixActuel - p.prixAchat)
      const gainPctDevise = p.prixAchat > 0 ? ((p.prixActuel - p.prixAchat) / p.prixAchat) * 100 : 0
      const impactFX = p.devise === 'CHF' ? 0 :
        p.quantite * p.prixActuel * (p.tauxActuelCHF - p.tauxAchatCHF)
      const inflation = inflationCumulee(p.dateAchat)
      const coutInflate = coutCHF * (1 + inflation)
      const gainReel = valeurCHF - coutInflate
      const gainPctReel = coutCHF > 0 ? (gainReel / coutCHF) * 100 : 0
      return {
        ...p, coutCHF, valeurCHF, gainCHF, gainPctCHF,
        gainDevise, gainPctDevise, impactFX, gainReel, gainPctReel,
      }
    }),
  [positions])

  // Totals
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

  // Modal handlers
  function openAdd() {
    setEditId(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  function openEdit(p: Position) {
    setEditId(p.id)
    setForm({ ...p })
    setShowModal(true)
  }

  function saveForm() {
    if (!form.nom) return
    if (editId) {
      setPositions(ps => ps.map(p => p.id === editId ? { ...form, id: editId } : p))
    } else {
      setPositions(ps => [...ps, { ...form, id: crypto.randomUUID() }])
    }
    setShowModal(false)
  }

  function deletePosition(id: string) {
    setPositions(ps => ps.filter(p => p.id !== id))
  }

  const fld = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value }))

  function color(pct: number) {
    return pct >= 0 ? 'text-[#2B6B5A]' : 'text-red-500'
  }

  function fmtPct(n: number) {
    return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
  }

  function fmtChf(n: number) {
    return n.toLocaleString('fr-CH', { maximumFractionDigits: 0 }) + ' CHF'
  }

  const inputCls = `
    w-full bg-white dark:bg-[#1B2D3E] border border-[#DDD9D1] dark:border-[#2a3f52]
    rounded-lg px-3 py-2 text-sm text-[#1B3050] dark:text-[#E8E4DC]
    focus:outline-none focus:ring-2 focus:ring-[#2B6B5A] focus:border-transparent
    placeholder-[#9E9A93]
  `

  const isEmpty = positions.length === 0

  return (
    <div className="min-h-screen bg-[#F5F3EF] dark:bg-[#0F1E2C] text-[#1B3050] dark:text-[#E8E4DC]">

      {/* Nav */}
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

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold tracking-tight">Mon portfolio</h1>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#B5820F]/10 text-[#B5820F] border border-[#B5820F]/20">Premium</span>
            </div>
            <p className="text-[#5C6880] text-sm">Suivi de vos positions avec performance nominale, ajustée FX et inflation réelle.</p>
          </div>
          <button
            onClick={openAdd}
            className="bg-[#2B6B5A] hover:bg-[#225549] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + Ajouter
          </button>
        </div>

        {isEmpty ? (
          <div className="bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-16 text-center">
            <div className="text-5xl mb-4">📈</div>
            <h2 className="text-lg font-semibold mb-2">Commencez à suivre votre portefeuille</h2>
            <p className="text-[#5C6880] text-sm mb-6 max-w-sm mx-auto">
              Ajoutez vos positions pour voir votre performance réelle en CHF, ajustée pour le taux de change et l'inflation suisse.
            </p>
            <button
              onClick={openAdd}
              className="bg-[#2B6B5A] hover:bg-[#225549] text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
            >
              + Ajouter ma première position
            </button>
          </div>
        ) : (
          <>
            {/* Summary row + charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">

              {/* Stats column */}
              <div className="lg:col-span-1 space-y-4">
                {/* Valeur */}
                <div className="bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-5">
                  <p className="text-xs font-semibold text-[#5C6880] uppercase tracking-wider mb-1">Valeur totale</p>
                  <p className="text-2xl font-bold font-mono" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {fmtChf(totals.valeurTotal)}
                  </p>
                  <p className="text-xs text-[#9E9A93] mt-0.5">
                    Investi: {fmtChf(totals.coutTotal)}
                  </p>
                </div>

                {/* Gain nominal */}
                <div className="bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-5">
                  <p className="text-xs font-semibold text-[#5C6880] uppercase tracking-wider mb-1">Gain nominal CHF</p>
                  <p className={`text-xl font-bold font-mono ${color(totals.gainTotal)}`}>
                    {totals.gainTotal >= 0 ? '+' : ''}{fmtChf(totals.gainTotal)}
                  </p>
                  <p className={`text-sm font-mono ${color(totals.gainPct)}`}>{fmtPct(totals.gainPct)}</p>
                </div>

                {/* Gain réel */}
                <div className="bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-5">
                  <p className="text-xs font-semibold text-[#5C6880] uppercase tracking-wider mb-1">Gain réel (après inflation)</p>
                  <p className={`text-xl font-bold font-mono ${color(totals.gainReelTotal)}`}>
                    {totals.gainReelTotal >= 0 ? '+' : ''}{fmtChf(totals.gainReelTotal)}
                  </p>
                  <p className={`text-sm font-mono ${color(totals.gainReelPct)}`}>{fmtPct(totals.gainReelPct)}</p>
                </div>

                {/* Impact FX */}
                <div className="bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-5">
                  <p className="text-xs font-semibold text-[#5C6880] uppercase tracking-wider mb-1">Impact taux de change</p>
                  <p className={`text-xl font-bold font-mono ${color(totals.fxTotal)}`}>
                    {totals.fxTotal >= 0 ? '+' : ''}{fmtChf(totals.fxTotal)}
                  </p>
                  <p className="text-xs text-[#9E9A93] mt-0.5">Effet seul des variations FX</p>
                </div>
              </div>

              {/* Charts column */}
              <div className="lg:col-span-2 space-y-4">
                {/* Evolution chart */}
                <div className="bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-5">
                  <h3 className="text-sm font-semibold mb-3">Évolution du portefeuille</h3>
                  <EvolChart data={positionsCalc} />
                  <p className="text-xs text-[#9E9A93] mt-2">
                    La valeur actuelle est estimée depuis le premier achat — sans prix historiques intermédiaires.
                  </p>
                </div>

                {/* Allocation chart */}
                <div className="bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-5">
                  <h3 className="text-sm font-semibold mb-4">Allocation par catégorie</h3>
                  <AllocChart data={positionsCalc} />
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-4 bg-white dark:bg-[#162534] p-1 rounded-lg border border-[#DDD9D1] dark:border-[#1e3347] w-fit">
              {(['positions', 'analyse'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    activeTab === tab
                      ? 'bg-[#2B6B5A] text-white'
                      : 'text-[#5C6880] hover:text-[#1B3050] dark:hover:text-white'
                  }`}
                >
                  {tab === 'positions' ? 'Positions' : 'Analyse FX & Inflation'}
                </button>
              ))}
            </div>

            {/* Tab: Positions */}
            {activeTab === 'positions' && (
              <div className="bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#DDD9D1] dark:border-[#1e3347]">
                        {['Position', 'Qté', 'Valeur CHF', 'Gain CHF', 'Perf.', 'Actions'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#5C6880] uppercase tracking-wider">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F5F3EF] dark:divide-[#1e3347]">
                      {positionsCalc.map(p => (
                        <tr key={p.id} className="hover:bg-[#F5F3EF]/50 dark:hover:bg-[#1B2D3E]/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-medium">{p.nom}</div>
                            <div className="text-xs text-[#9E9A93]">
                              {p.ticker} · {p.categorie} · {p.devise}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">{p.quantite}</td>
                          <td className="px-4 py-3 font-mono">
                            <div>{fmtChf(p.valeurCHF)}</div>
                            <div className="text-xs text-[#9E9A93]">Coût: {fmtChf(p.coutCHF)}</div>
                          </td>
                          <td className={`px-4 py-3 font-mono ${color(p.gainCHF)}`}>
                            {p.gainCHF >= 0 ? '+' : ''}{fmtChf(p.gainCHF)}
                          </td>
                          <td className={`px-4 py-3 font-mono font-semibold ${color(p.gainPctCHF)}`}>
                            {fmtPct(p.gainPctCHF)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button
                                onClick={() => openEdit(p)}
                                className="text-xs text-[#2B6B5A] hover:underline"
                              >
                                Modifier
                              </button>
                              <button
                                onClick={() => deletePosition(p.id)}
                                className="text-xs text-red-400 hover:underline"
                              >
                                Supprimer
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tab: Analyse FX & Inflation */}
            {activeTab === 'analyse' && (
              <div className="bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] overflow-hidden">
                {/* Legend */}
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
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#5C6880] uppercase tracking-wider">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F5F3EF] dark:divide-[#1e3347]">
                      {positionsCalc.map(p => (
                        <tr key={p.id} className="hover:bg-[#F5F3EF]/50 dark:hover:bg-[#1B2D3E]/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-medium">{p.nom}</div>
                            <div className="text-xs text-[#9E9A93]">{p.ticker} · Achat: {p.dateAchat}</div>
                          </td>
                          <td className={`px-4 py-3 font-mono ${color(p.gainPctDevise)}`}>
                            <div>{fmtPct(p.gainPctDevise)}</div>
                            <div className="text-xs text-[#9E9A93]">
                              {p.gainDevise >= 0 ? '+' : ''}{p.gainDevise.toFixed(2)} {p.devise}
                            </div>
                          </td>
                          <td className={`px-4 py-3 font-mono ${color(p.gainPctCHF)}`}>
                            <div>{fmtPct(p.gainPctCHF)}</div>
                            <div className="text-xs text-[#9E9A93]">
                              {p.gainCHF >= 0 ? '+' : ''}{fmtChf(p.gainCHF)}
                            </div>
                          </td>
                          <td className={`px-4 py-3 font-mono ${color(p.impactFX)}`}>
                            {p.devise === 'CHF'
                              ? <span className="text-[#9E9A93]">—</span>
                              : <>{p.impactFX >= 0 ? '+' : ''}{fmtChf(p.impactFX)}</>
                            }
                          </td>
                          <td className={`px-4 py-3 font-mono font-semibold ${color(p.gainPctReel)}`}>
                            <div>{fmtPct(p.gainPctReel)}</div>
                            <div className="text-xs text-[#9E9A93]">
                              {p.gainReel >= 0 ? '+' : ''}{fmtChf(p.gainReel)}
                            </div>
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

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-[#5C6880] mb-1">Nom de l'actif *</label>
                  <input className={inputCls} placeholder="Apple Inc." value={form.nom} onChange={fld('nom')} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5C6880] mb-1">Ticker</label>
                  <input className={inputCls} placeholder="AAPL" value={form.ticker} onChange={fld('ticker')} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5C6880] mb-1">Catégorie</label>
                  <select className={inputCls} value={form.categorie} onChange={fld('categorie')}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5C6880] mb-1">Devise</label>
                  <select className={inputCls} value={form.devise} onChange={fld('devise')}>
                    {DEVISES.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5C6880] mb-1">Quantité</label>
                  <input className={inputCls} type="number" placeholder="10" value={form.quantite || ''} onChange={fld('quantite')} />
                </div>
              </div>

              <div className="border-t border-[#F5F3EF] dark:border-[#1e3347] pt-4">
                <p className="text-xs font-semibold text-[#5C6880] uppercase tracking-wider mb-3">À l'achat</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#5C6880] mb-1">Prix d'achat ({form.devise})</label>
                    <input className={inputCls} type="number" placeholder="150.00" value={form.prixAchat || ''} onChange={fld('prixAchat')} />
                  </div>
                  {form.devise !== 'CHF' && (
                    <div>
                      <label className="block text-xs font-medium text-[#5C6880] mb-1">Taux CHF/{form.devise} à l'achat</label>
                      <input className={inputCls} type="number" step="0.0001" placeholder="0.9200" value={form.tauxAchatCHF || ''} onChange={fld('tauxAchatCHF')} />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-[#5C6880] mb-1">Date d'achat</label>
                    <input className={inputCls} type="date" value={form.dateAchat} onChange={fld('dateAchat')} />
                  </div>
                </div>
              </div>

              <div className="border-t border-[#F5F3EF] dark:border-[#1e3347] pt-4">
                <p className="text-xs font-semibold text-[#5C6880] uppercase tracking-wider mb-3">Valeur actuelle</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#5C6880] mb-1">Prix actuel ({form.devise})</label>
                    <input className={inputCls} type="number" placeholder="185.00" value={form.prixActuel || ''} onChange={fld('prixActuel')} />
                  </div>
                  {form.devise !== 'CHF' && (
                    <div>
                      <label className="block text-xs font-medium text-[#5C6880] mb-1">Taux CHF/{form.devise} actuel</label>
                      <input className={inputCls} type="number" step="0.0001" placeholder="0.8800" value={form.tauxActuelCHF || ''} onChange={fld('tauxActuelCHF')} />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 border border-[#DDD9D1] dark:border-[#2a3f52] text-[#5C6880] text-sm py-2 rounded-lg hover:bg-[#F5F3EF] dark:hover:bg-[#1B2D3E] transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={saveForm}
                  disabled={!form.nom}
                  className="flex-1 bg-[#2B6B5A] hover:bg-[#225549] disabled:opacity-40 text-white text-sm py-2 rounded-lg transition-colors font-medium"
                >
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
