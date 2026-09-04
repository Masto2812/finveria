'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'

// Inflation suisse annuelle (IPC) — source: OFS
const INFLATION_CH: Record<number, number> = {
  2015: -0.011, 2016: -0.004, 2017: 0.005, 2018: 0.009, 2019: 0.004,
  2020: -0.007, 2021: 0.006, 2022: 0.028, 2023: 0.021, 2024: 0.013, 2025: 0.010,
}

function inflationCumulee(dateAchat: string): number {
  if (!dateAchat) return 0
  const debut = new Date(dateAchat)
  const maintenant = new Date()
  let cumul = 1
  const anneeDebut = debut.getFullYear()
  const anneeFin = maintenant.getFullYear()
  for (let y = anneeDebut; y <= anneeFin; y++) {
    const taux = INFLATION_CH[y] ?? 0.01
    if (y === anneeDebut && y === anneeFin) {
      const jours = (maintenant.getTime() - debut.getTime()) / (365.25 * 24 * 3600 * 1000)
      cumul *= Math.pow(1 + taux, jours)
    } else if (y === anneeDebut) {
      const resteAnnee = (new Date(y + 1, 0, 1).getTime() - debut.getTime()) / (365.25 * 24 * 3600 * 1000)
      cumul *= Math.pow(1 + taux, resteAnnee)
    } else if (y === anneeFin) {
      const debutAnnee = new Date(y, 0, 1)
      const jours = (maintenant.getTime() - debutAnnee.getTime()) / (365.25 * 24 * 3600 * 1000)
      cumul *= Math.pow(1 + taux, jours)
    } else {
      cumul *= (1 + taux)
    }
  }
  return cumul - 1
}

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

const CATEGORIES = ['Actions', 'ETF', 'Obligations', 'Matières premières', 'Crypto', 'Autre']
const DEVISES = ['CHF', 'USD', 'EUR', 'GBP', 'JPY', 'SEK', 'NOK', 'DKK']

const CAT_COLORS: Record<string, string> = {
  'Actions': 'bg-blue-100 text-blue-700',
  'ETF': 'bg-teal-100 text-teal-700',
  'Obligations': 'bg-slate-100 text-slate-600',
  'Matières premières': 'bg-amber-100 text-amber-700',
  'Crypto': 'bg-purple-100 text-purple-700',
  'Autre': 'bg-gray-100 text-gray-600',
}

function fmt(n: number, dec = 0): string {
  return n.toLocaleString('fr-CH', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

function pct(n: number): string {
  return (n >= 0 ? '+' : '') + fmt(n, 2) + '%'
}

function gainColor(n: number): string {
  if (n > 0) return 'text-emerald-600'
  if (n < 0) return 'text-red-500'
  return 'text-gray-500'
}

const EMPTY_FORM: Omit<Position, 'id'> = {
  nom: '', ticker: '', categorie: 'Actions', devise: 'USD',
  quantite: 0, prixAchat: 0, tauxAchatCHF: 1,
  dateAchat: new Date().toISOString().split('T')[0],
  prixActuel: 0, tauxActuelCHF: 1,
}
// ─── Graphique évolution ───────────────────────────────────────────────────
function EvolChart({ data }: { data: ReturnType<typeof useMemo<typeof positionsCalc>> }) {
  if (!data || data.length === 0) return null
  const sorted = [...data].sort((a, b) => new Date(a.dateAchat).getTime() - new Date(b.dateAchat).getTime())
  const now = new Date()
  const tMin = new Date(sorted[0].dateAchat).getTime()
  const tMax = now.getTime()

  // Construire les points : cumul investi (step) + valeur actuelle (interpolée)
  type Pt = { t: number; cout: number; valeur: number }
  const pts: Pt[] = []
  let cumCout = 0
  for (const p of sorted) {
    const t = new Date(p.dateAchat).getTime()
    if (pts.length > 0) pts.push({ t, cout: cumCout, valeur: cumCout })
    cumCout += p.coutCHF
    pts.push({ t, cout: cumCout, valeur: cumCout })
  }
  const totalValeur = data.reduce((s, p) => s + p.valeurCHF, 0)
  pts.push({ t: tMax, cout: cumCout, valeur: totalValeur })

  const W = 560; const H = 160
  const PL = 64; const PR = 16; const PT = 16; const PB = 28
  const cW = W - PL - PR; const cH = H - PT - PB
  const yMax = Math.max(cumCout, totalValeur) * 1.12 || 1

  function xp(t: number) { return PL + ((t - tMin) / (tMax - tMin || 1)) * cW }
  function yp(v: number) { return PT + cH - (v / yMax) * cH }

  const coutD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xp(p.t)} ${yp(p.cout)}`).join(' ')
  const valD  = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xp(p.t)} ${yp(p.valeur)}`).join(' ')
  const coutFill = `${coutD} L ${xp(tMax)} ${yp(0)} L ${PL} ${yp(0)} Z`
  const isGain = totalValeur >= cumCout

  const yTicks = [0.25, 0.5, 0.75, 1].map(f => ({ v: yMax * f, y: yp(yMax * f) }))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: '160px' }}>
      <defs>
        <linearGradient id="gcout" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#DDD9D1" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#DDD9D1" stopOpacity="0.1" />
        </linearGradient>
        <linearGradient id="gval" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={isGain ? '#2B6B5A' : '#C0392B'} stopOpacity="0.15" />
          <stop offset="100%" stopColor={isGain ? '#2B6B5A' : '#C0392B'} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Grille */}
      {yTicks.map(tk => (
        <g key={tk.v}>
          <line x1={PL} x2={W - PR} y1={tk.y} y2={tk.y} stroke="currentColor" strokeOpacity="0.07" strokeWidth="1" />
          <text x={PL - 6} y={tk.y + 4} textAnchor="end" fontSize="9" fill="currentColor" opacity="0.4">
            {(tk.v / 1000).toFixed(0)}k
          </text>
        </g>
      ))}

      {/* Zone investi */}
      <path d={coutFill} fill="url(#gcout)" />
      <path d={coutD} fill="none" stroke="#9E9A93" strokeWidth="1.5" strokeDasharray="4 3" />

      {/* Zone valeur actuelle */}
      <path d={`${valD} L ${xp(tMax)} ${yp(0)} L ${PL} ${yp(0)} Z`} fill="url(#gval)" />
      <path d={valD} fill="none" stroke={isGain ? '#2B6B5A' : '#C0392B'} strokeWidth="2" strokeLinejoin="round" />

      {/* Point final */}
      <circle cx={xp(tMax)} cy={yp(totalValeur)} r="4"
        fill={isGain ? '#2B6B5A' : '#C0392B'} stroke="white" strokeWidth="2" />

      {/* Étiquette valeur finale */}
      <text x={xp(tMax) - 6} y={yp(totalValeur) - 10} textAnchor="end" fontSize="10"
        fill={isGain ? '#2B6B5A' : '#C0392B'} fontWeight="600">
        {Math.round(totalValeur).toLocaleString('fr-CH')} CHF
      </text>

      {/* Axe dates */}
      {sorted.slice(0, 4).map(p => (
        <text key={p.id} x={xp(new Date(p.dateAchat).getTime())} y={H - 4}
          textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.35">
          {new Date(p.dateAchat).toLocaleDateString('fr-CH', { month: 'short', year: '2-digit' })}
        </text>
      ))}
      <text x={xp(tMax)} y={H - 4} textAnchor="end" fontSize="9" fill="currentColor" opacity="0.35">
        Aujourd&apos;hui
      </text>

      {/* Légende */}
      <line x1={PL} x2={PL + 18} y1={H - PB + 10} y2={H - PB + 10} stroke="#9E9A93" strokeWidth="1.5" strokeDasharray="4 3" />
      <text x={PL + 22} y={H - PB + 14} fontSize="9" fill="currentColor" opacity="0.5">Investi</text>
      <line x1={PL + 65} x2={PL + 83} y1={H - PB + 10} y2={H - PB + 10} stroke={isGain ? '#2B6B5A' : '#C0392B'} strokeWidth="2" />
      <text x={PL + 87} y={H - PB + 14} fontSize="9" fill="currentColor" opacity="0.5">Valeur actuelle</text>
    </svg>
  )
}

// ─── Graphique allocation ──────────────────────────────────────────────────
const CAT_HUE: Record<string, string> = {
  'Actions': '#2B6B5A', 'ETF': '#1B3050', 'Obligations': '#5C6880',
  'Matières premières': '#B5820F', 'Crypto': '#7C3AED', 'Autre': '#9E9A93',
}

function AllocChart({ data }: { data: { categorie: string; valeurCHF: number }[] }) {
  const bycat: Record<string, number> = {}
  for (const p of data) bycat[p.categorie] = (bycat[p.categorie] || 0) + p.valeurCHF
  const total = Object.values(bycat).reduce((s, v) => s + v, 0) || 1
  const entries = Object.entries(bycat).sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-2">
      {entries.map(([cat, val]) => {
        const pct = (val / total) * 100
        return (
          <div key={cat}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-500">{cat}</span>
              <span className="font-mono text-gray-600 dark:text-gray-400">{pct.toFixed(1)}%</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 dark:bg-slate-700">
              <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: CAT_HUE[cat] || '#9E9A93' }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
export default function PortfolioPage() {
  const [positions, setPositions] = useState<Position[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<Position, 'id'>>(EMPTY_FORM)
  const [activeTab, setActiveTab] = useState<'positions' | 'analyse'>('positions')

  useEffect(() => {
    try {
      const saved = localStorage.getItem('finveria_portfolio')
      if (saved) setPositions(JSON.parse(saved))
    } catch {}
  }, [])

  function save(updated: Position[]) {
    setPositions(updated)
    try { localStorage.setItem('finveria_portfolio', JSON.stringify(updated)) } catch {}
  }

  function openAdd() {
    setForm(EMPTY_FORM)
    setEditId(null)
    setShowForm(true)
  }

  function openEdit(p: Position) {
    const { id, ...rest } = p
    setForm(rest)
    setEditId(id)
    setShowForm(true)
  }

  function submitForm() {
    if (!form.nom || form.quantite <= 0 || form.prixAchat <= 0) return
    if (editId) {
      save(positions.map(p => p.id === editId ? { ...form, id: editId } : p))
    } else {
      save([...positions, { ...form, id: crypto.randomUUID() }])
    }
    setShowForm(false)
  }

  function deletePos(id: string) {
    save(positions.filter(p => p.id !== id))
  }

  function setF(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const val = ['quantite', 'prixAchat', 'tauxAchatCHF', 'prixActuel', 'tauxActuelCHF'].includes(field)
        ? parseFloat(e.target.value) || 0
        : e.target.value
      setForm(prev => ({ ...prev, [field]: val }))
    }
  }

  // Calculs par position
  const positionsCalc = useMemo(() => positions.map(p => {
    const coutCHF = p.quantite * p.prixAchat * p.tauxAchatCHF
    const valeurCHF = p.quantite * p.prixActuel * p.tauxActuelCHF
    const gainCHF = valeurCHF - coutCHF
    const gainPctCHF = coutCHF > 0 ? (gainCHF / coutCHF) * 100 : 0

    // Gain nominal en devise d'origine
    const gainDevise = p.quantite * (p.prixActuel - p.prixAchat)
    const gainPctDevise = p.prixAchat > 0 ? ((p.prixActuel - p.prixAchat) / p.prixAchat) * 100 : 0

    // Impact taux de change seul
    const valeurSansFX = p.quantite * p.prixActuel * p.tauxAchatCHF
    const impactFX = valeurCHF - valeurSansFX

    // Gain ajusté inflation
    const inflation = inflationCumulee(p.dateAchat)
    const coutInflate = coutCHF * (1 + inflation)
    const gainReel = valeurCHF - coutInflate
    const gainPctReel = coutCHF > 0 ? (gainReel / coutCHF) * 100 : 0

    return { ...p, coutCHF, valeurCHF, gainCHF, gainPctCHF, gainDevise, gainPctDevise, impactFX, gainReel, gainPctReel, inflation }
  }), [positions])

  const totaux = useMemo(() => {
    const totalCout = positionsCalc.reduce((s, p) => s + p.coutCHF, 0)
    const totalValeur = positionsCalc.reduce((s, p) => s + p.valeurCHF, 0)
    const totalGain = totalValeur - totalCout
    const totalGainPct = totalCout > 0 ? (totalGain / totalCout) * 100 : 0
    const totalReel = positionsCalc.reduce((s, p) => s + p.gainReel, 0)
    const totalReelPct = totalCout > 0 ? (totalReel / totalCout) * 100 : 0
    const totalFX = positionsCalc.reduce((s, p) => s + p.impactFX, 0)
    return { totalCout, totalValeur, totalGain, totalGainPct, totalReel, totalReelPct, totalFX }
  }, [positionsCalc])

  const inputCls = 'w-full bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100">
      <nav className="border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-lg font-semibold">fin<span className="text-teal-700">veria</span></Link>
        <div className="flex gap-4 text-sm">
          <Link href="/comparateur" className="text-gray-500 hover:text-slate-800">Comparateur</Link>
          <Link href="/simulateur" className="text-gray-500 hover:text-slate-800">Simulateur</Link>
          <Link href="/portfolio" className="text-teal-700 font-medium">Portfolio</Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold mb-1">Mon Portfolio</h1>
            <p className="text-gray-500 text-sm">Performance réelle en CHF — corrigée du taux de change et de l&apos;inflation suisse.</p>
          </div>
          <button onClick={openAdd} className="bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-800 transition-colors">
            + Ajouter une position
          </button>
        </div>

        {/* Cartes résumé */}
        {positions.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Valeur totale', value: fmt(totaux.totalValeur) + ' CHF', sub: 'investi : ' + fmt(totaux.totalCout) + ' CHF', color: 'text-slate-800 dark:text-white' },
              { label: 'Gain nominal CHF', value: (totaux.totalGain >= 0 ? '+' : '') + fmt(totaux.totalGain) + ' CHF', sub: pct(totaux.totalGainPct), color: gainColor(totaux.totalGain) },
              { label: 'Impact change CHF', value: (totaux.totalFX >= 0 ? '+' : '') + fmt(totaux.totalFX) + ' CHF', sub: 'effet devises', color: gainColor(totaux.totalFX) },
              { label: 'Gain réel (inflation)', value: (totaux.totalReel >= 0 ? '+' : '') + fmt(totaux.totalReel) + ' CHF', sub: pct(totaux.totalReelPct) + ' pouvoir d\'achat', color: gainColor(totaux.totalReel) },
            ].map(card => (
              <div key={card.label} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
                <p className="text-xs text-gray-500 mb-1">{card.label}</p>
                <p className={`text-xl font-bold font-mono ${card.color}`}>{card.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* Onglets */}
        <div className="flex gap-1 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-1 mb-5 w-fit">
          {[{ key: 'positions', label: 'Positions' }, { key: 'analyse', label: 'Analyse FX & Inflation' }].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key as typeof activeTab)}
              className={`py-2 px-4 rounded-lg text-sm font-medium transition-colors ${activeTab === t.key ? 'bg-teal-700 text-white' : 'text-gray-500 hover:text-slate-800'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Positions */}
        {activeTab === 'positions' && (
          positions.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-16 text-center">
              <div className="text-5xl mb-4">📊</div>
              <p className="text-lg font-medium mb-2">Aucune position</p>
              <p className="text-gray-400 text-sm mb-6">Ajoutez vos investissements pour suivre leur performance réelle en CHF.</p>
              <button onClick={openAdd} className="bg-teal-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-teal-800 transition-colors">
                + Ajouter ma première position
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {positionsCalc.map(p => (
                <div key={p.id} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{p.nom}</p>
                          {p.ticker && <span className="text-xs text-gray-400 font-mono">{p.ticker}</span>}
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CAT_COLORS[p.categorie] || 'bg-gray-100 text-gray-600'}`}>{p.categorie}</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {fmt(p.quantite, 4)} × {fmt(p.prixAchat, 2)} {p.devise} — acheté le {new Date(p.dateAchat).toLocaleDateString('fr-CH')}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(p)} className="text-xs text-gray-400 hover:text-teal-700 px-2 py-1 rounded border border-gray-200 hover:border-teal-300 transition-colors">Modifier</button>
                      <button onClick={() => deletePos(p.id)} className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded border border-gray-200 hover:border-red-200 transition-colors">Supprimer</button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    {/* Gain nominal devise */}
                    <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">Gain nominal ({p.devise})</p>
                      <p className={`text-base font-bold font-mono ${gainColor(p.gainDevise)}`}>
                        {p.gainDevise >= 0 ? '+' : ''}{fmt(p.gainDevise, 2)} {p.devise}
                      </p>
                      <p className={`text-xs font-medium ${gainColor(p.gainPctDevise)}`}>{pct(p.gainPctDevise)}</p>
                    </div>

                    {/* Gain réel CHF */}
                    <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">Gain réel en CHF</p>
                      <p className={`text-base font-bold font-mono ${gainColor(p.gainCHF)}`}>
                        {p.gainCHF >= 0 ? '+' : ''}{fmt(p.gainCHF, 0)} CHF
                      </p>
                      <p className={`text-xs font-medium ${gainColor(p.gainPctCHF)}`}>{pct(p.gainPctCHF)}</p>
                      {p.devise !== 'CHF' && (
                        <p className="text-xs text-gray-400 mt-1">
                          FX: {p.impactFX >= 0 ? '+' : ''}{fmt(p.impactFX, 0)} CHF
                        </p>
                      )}
                    </div>

                    {/* Gain pouvoir d'achat */}
                    <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">Gain pouvoir d&apos;achat CH</p>
                      <p className={`text-base font-bold font-mono ${gainColor(p.gainReel)}`}>
                        {p.gainReel >= 0 ? '+' : ''}{fmt(p.gainReel, 0)} CHF
                      </p>
                      <p className={`text-xs font-medium ${gainColor(p.gainPctReel)}`}>{pct(p.gainPctReel)}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Inflation: +{fmt(p.inflation * 100, 1)}%
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-700 flex justify-between text-xs text-gray-400">
                    <span>Valeur actuelle : <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{fmt(p.valeurCHF, 0)} CHF</span></span>
                    <span>Investi : <span className="font-mono">{fmt(p.coutCHF, 0)} CHF</span></span>
                    {p.devise !== 'CHF' && (
                      <span>Taux achat : 1 {p.devise} = {p.tauxAchatCHF} CHF → maintenant {p.tauxActuelCHF} CHF</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* Tab Analyse */}
        {activeTab === 'analyse' && (
          <div className="space-y-5">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
              <h3 className="text-sm font-semibold mb-2">Pourquoi ces trois métriques ?</h3>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
                {[
                  {
                    titre: 'Gain nominal (devise)',
                    icone: '📈',
                    desc: 'Ce que votre courtier affiche. Gain brut dans la devise de l\'actif, sans tenir compte du taux de change ni de l\'inflation.',
                    exemple: 'Achat: 100 USD → Vente: 110 USD = +10 USD (+10%)',
                  },
                  {
                    titre: 'Gain réel en CHF',
                    icone: '🔄',
                    desc: 'Le gain converti en CHF aux taux de change d\'achat ET de vente. Révèle l\'impact du change sur votre performance.',
                    exemple: 'USD baisse de 1.05 → 1.00 : +10 USD = +100 CHF, investi 105 CHF → Gain CHF = −5 CHF',
                  },
                  {
                    titre: 'Gain pouvoir d\'achat',
                    icone: '🛒',
                    desc: 'Le gain CHF corrigé de l\'inflation suisse (IPC). Mesure si vous êtes réellement plus riche en termes de ce que vous pouvez acheter en Suisse.',
                    exemple: 'Gain CHF +5% avec inflation CH +5% = gain pouvoir d\'achat 0%',
                  },
                ].map(m => (
                  <div key={m.titre} className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-4">
                    <div className="text-2xl mb-2">{m.icone}</div>
                    <p className="font-semibold text-sm mb-2">{m.titre}</p>
                    <p className="text-xs text-gray-500 leading-relaxed mb-3">{m.desc}</p>
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-2 border border-gray-200 dark:border-slate-600">
                      <p className="text-xs font-mono text-gray-600 dark:text-gray-400">{m.exemple}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
              <h3 className="text-sm font-semibold mb-4">Inflation suisse utilisée (IPC officiel OFS)</h3>
              <div className="grid grid-cols-4 lg:grid-cols-8 gap-2">
                {Object.entries(INFLATION_CH).map(([year, rate]) => (
                  <div key={year} className="text-center">
                    <p className="text-xs text-gray-400">{year}</p>
                    <p className={`text-sm font-mono font-semibold ${rate > 0 ? 'text-amber-600' : 'text-teal-600'}`}>
                      {rate > 0 ? '+' : ''}{(rate * 100).toFixed(1)}%
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {positionsCalc.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                <div className="p-5 border-b border-gray-100 dark:border-slate-700">
                  <h3 className="text-sm font-semibold">Comparaison des performances</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-slate-700/50">
                      <tr>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Position</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Nominal ({'{'}devise{'}'})</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Réel CHF</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Impact FX</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Pouvoir d&apos;achat</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                      {positionsCalc.map(p => (
                        <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                          <td className="px-5 py-3">
                            <p className="font-medium">{p.nom}</p>
                            <p className="text-xs text-gray-400">{p.devise} · {p.categorie}</p>
                          </td>
                          <td className={`px-4 py-3 text-right font-mono text-sm ${gainColor(p.gainPctDevise)}`}>{pct(p.gainPctDevise)}</td>
                          <td className={`px-4 py-3 text-right font-mono text-sm ${gainColor(p.gainPctCHF)}`}>{pct(p.gainPctCHF)}</td>
                          <td className={`px-4 py-3 text-right font-mono text-sm ${gainColor(p.impactFX)}`}>
                            {p.devise === 'CHF' ? '—' : (p.impactFX >= 0 ? '+' : '') + fmt(p.impactFX, 0) + ' CHF'}
                          </td>
                          <td className={`px-4 py-3 text-right font-mono text-sm ${gainColor(p.gainPctReel)}`}>{pct(p.gainPctReel)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal ajout / édition */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
              <h2 className="font-semibold">{editId ? 'Modifier la position' : 'Ajouter une position'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Nom de l&apos;actif *</label>
                  <input value={form.nom} onChange={setF('nom')} placeholder="Nestlé SA" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Ticker</label>
                  <input value={form.ticker} onChange={setF('ticker')} placeholder="NESN" className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Catégorie</label>
                  <select value={form.categorie} onChange={setF('categorie')} className={inputCls}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Devise</label>
                  <select value={form.devise} onChange={setF('devise')} className={inputCls}>
                    {DEVISES.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Quantité *</label>
                  <input type="number" value={form.quantite || ''} onChange={setF('quantite')} placeholder="10" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Date d&apos;achat</label>
                  <input type="date" value={form.dateAchat} onChange={setF('dateAchat')} className={inputCls} />
                </div>
              </div>

              <div className="border-t border-gray-100 dark:border-slate-700 pt-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Au moment de l&apos;achat</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Prix d&apos;achat ({form.devise}) *</label>
                    <input type="number" value={form.prixAchat || ''} onChange={setF('prixAchat')} placeholder="100.00" className={inputCls} />
                  </div>
                  {form.devise !== 'CHF' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Taux 1 {form.devise} = ? CHF</label>
                      <input type="number" value={form.tauxAchatCHF || ''} onChange={setF('tauxAchatCHF')} placeholder="1.05" className={inputCls} />
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-gray-100 dark:border-slate-700 pt-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Prix actuel</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Prix actuel ({form.devise}) *</label>
                    <input type="number" value={form.prixActuel || ''} onChange={setF('prixActuel')} placeholder="110.00" className={inputCls} />
                  </div>
                  {form.devise !== 'CHF' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Taux actuel 1 {form.devise} = ? CHF</label>
                      <input type="number" value={form.tauxActuelCHF || ''} onChange={setF('tauxActuelCHF')} placeholder="1.00" className={inputCls} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 dark:border-slate-700 flex gap-3 justify-end">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">
                Annuler
              </button>
              <button onClick={submitForm} className="px-5 py-2 text-sm bg-teal-700 text-white rounded-lg font-medium hover:bg-teal-800 transition-colors">
                {editId ? 'Enregistrer' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}