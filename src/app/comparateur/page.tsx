'use client'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import { useState, useRef, useEffect, useMemo } from 'react'
import Link from 'next/link'

const NA = null

const brokers = [
  {
    id: 'ibkr', name: 'Interactive Brokers', country: 'US', flag: '🇺🇸',
    reg: 'international', stamp: false, minDeposit: 0, protection: '500\'000 USD (SIPC)',
    swissTax: false, languages: ['FR', 'DE', 'IT', 'EN'],
    assets: ['ETF', 'Actions', 'Options', 'Obligations', 'Forex', 'Matières premières'],
    fees: {
      ETF:       { display: '0.50 USD min.', note: '0.005% · par transaction', perTx: true,  hasSpread: false, overnight: null, feeRaw: 0.5 },
      Actions:   { display: '0.50 USD min.', note: '0.005% · par transaction', perTx: true,  hasSpread: false, overnight: null, feeRaw: 0.5 },
      Options:   { display: '0.70 USD/contrat', note: 'min 1 USD · par transaction', perTx: true, hasSpread: false, overnight: '~1.5% + Fed Funds/an (si marge)', feeRaw: 0.7 },
      Obligations: { display: '1 USD min.', note: 'par transaction', perTx: true, hasSpread: true, overnight: null, feeRaw: 1 },
      Forex:     { display: 'Spread 0.1–0.2 pip', note: 'EUR/USD · pas de commission', perTx: false, hasSpread: true, overnight: 'Rollover selon paires', feeRaw: 0.1 },
      'Matières premières':  { display: '0.85 USD/contrat', note: 'Futures · par transaction', perTx: true, hasSpread: true, overnight: 'Roll à chaque échéance', feeRaw: 0.85 },
    },
    horizonScores: { court: 9, moyen: 9, long: 8 },
    horizonNotes:  { court: 'Idéal', moyen: 'Idéal', long: 'Bon' },
    pros: ['Frais parmi les plus bas', 'Large gamme d\'actifs', 'Exonéré timbre'],
    cons: ['Interface complexe', 'Support limité en français'],
    score: 9.2, affiliate: '#',
  },
  {
    id: 'degiro', name: 'DEGIRO', country: 'NL', flag: '🇳🇱',
    reg: 'international', stamp: false, minDeposit: 0, protection: '20\'000 EUR',
    swissTax: false, languages: ['FR', 'DE', 'IT', 'EN'],
    assets: ['ETF', 'Actions', 'Options', 'Obligations'],
    fees: {
      ETF:       { display: '0 – 3.90 EUR', note: 'ETFs gratuits disponibles · par transaction', perTx: true, hasSpread: false, overnight: null, feeRaw: 0 },
      Actions:   { display: '3.90 EUR + 0.054%', note: 'par transaction', perTx: true, hasSpread: false, overnight: null, feeRaw: 3.9 },
      Options:   { display: '0.75 EUR/contrat', note: 'min 2 EUR · par transaction', perTx: true, hasSpread: false, overnight: null, feeRaw: 0.75 },
      Obligations: { display: '2 EUR + 0.03%', note: 'par transaction', perTx: true, hasSpread: true, overnight: null, feeRaw: 2 },
      Forex:     { display: NA, note: NA, perTx: false, hasSpread: false, overnight: null, feeRaw: 999 },
      'Matières premières':  { display: NA, note: NA, perTx: false, hasSpread: false, overnight: null, feeRaw: 999 },
    },
    horizonScores: { court: 7, moyen: 9, long: 9 },
    horizonNotes:  { court: 'Correct', moyen: 'Idéal', long: 'Idéal' },
    pros: ['ETFs gratuits', 'Interface simple', 'Exonéré timbre'],
    cons: ['Pas de Forex/Matières premières', 'Pas de rapport fiscal CH'],
    score: 8.7, affiliate: '#',
  },
  {
    id: 'swissquote', name: 'Swissquote', country: 'CH', flag: '🇨🇭',
    reg: 'swiss', stamp: true, minDeposit: 1000, protection: '100\'000 CHF',
    swissTax: true, languages: ['FR', 'DE', 'IT', 'EN'],
    assets: ['ETF', 'Actions', 'Options', 'Obligations', 'Forex', 'Matières premières'],
    fees: {
      ETF:       { display: '9 CHF min.', note: '0.10% · par transaction', perTx: true, hasSpread: false, overnight: null, feeRaw: 9 },
      Actions:   { display: '9 CHF min.', note: '0.10% · par transaction', perTx: true, hasSpread: false, overnight: null, feeRaw: 9 },
      Options:   { display: '3 CHF/contrat', note: 'min 9 CHF · par transaction', perTx: true, hasSpread: false, overnight: '~2% + BNS/an', feeRaw: 3 },
      Obligations: { display: '9 CHF min.', note: 'par transaction', perTx: true, hasSpread: true, overnight: null, feeRaw: 9 },
      Forex:     { display: 'Spread ~1 pip', note: 'EUR/CHF standard', perTx: false, hasSpread: true, overnight: 'Rollover selon paires', feeRaw: 1 },
      'Matières premières':  { display: '9 CHF min.', note: 'CFDs et ETFs matières', perTx: true, hasSpread: true, overnight: '~3% + BNS/an (CFD)', feeRaw: 9 },
    },
    horizonScores: { court: 5, moyen: 7, long: 9 },
    horizonNotes:  { court: 'Coûteux', moyen: 'Correct', long: 'Idéal' },
    pros: ['Banque suisse agréée', 'Rapport fiscal inclus', 'Protection 100k CHF'],
    cons: ['Frais élevés', 'Droit de timbre applicable'],
    score: 7.8, affiliate: '#',
  },
  {
    id: 'trade-republic', name: 'Trade Republic', country: 'DE', flag: '🇩🇪',
    reg: 'international', stamp: false, minDeposit: 0, protection: '100\'000 EUR',
    swissTax: false, languages: ['FR', 'DE', 'EN'],
    assets: ['ETF', 'Actions', 'Obligations'],
    fees: {
      ETF:       { display: '1 EUR fixe', note: 'par transaction', perTx: true, hasSpread: false, overnight: null, feeRaw: 1 },
      Actions:   { display: '1 EUR fixe', note: 'par transaction', perTx: true, hasSpread: false, overnight: null, feeRaw: 1 },
      Options:   { display: NA, note: NA, perTx: false, hasSpread: false, overnight: null, feeRaw: 999 },
      Obligations: { display: '1 EUR fixe', note: 'par transaction', perTx: true, hasSpread: false, overnight: null, feeRaw: 1 },
      Forex:     { display: NA, note: NA, perTx: false, hasSpread: false, overnight: null, feeRaw: 999 },
      'Matières premières':  { display: NA, note: NA, perTx: false, hasSpread: false, overnight: null, feeRaw: 999 },
    },
    horizonScores: { court: 6, moyen: 8, long: 9 },
    horizonNotes:  { court: 'Limité', moyen: 'Bon', long: 'Idéal' },
    pros: ['1 EUR par trade', 'Interface mobile excellent', 'Exonéré timbre'],
    cons: ['Actifs limités', 'Pas de rapport fiscal CH'],
    score: 8.1, affiliate: '#',
  },
  {
    id: 'yuh', name: 'Yuh', country: 'CH', flag: '🇨🇭',
    reg: 'swiss', stamp: true, minDeposit: 0, protection: '100\'000 CHF',
    swissTax: true, languages: ['FR', 'DE', 'EN'],
    assets: ['ETF', 'Actions'],
    fees: {
      ETF:       { display: '0.5% spread', note: 'pas de commission fixe', perTx: false, hasSpread: true, overnight: null, feeRaw: 0.5 },
      Actions:   { display: '0.5% spread', note: 'pas de commission fixe', perTx: false, hasSpread: true, overnight: null, feeRaw: 0.5 },
      Options:   { display: NA, note: NA, perTx: false, hasSpread: false, overnight: null, feeRaw: 999 },
      Obligations: { display: NA, note: NA, perTx: false, hasSpread: false, overnight: null, feeRaw: 999 },
      Forex:     { display: NA, note: NA, perTx: false, hasSpread: false, overnight: null, feeRaw: 999 },
      'Matières premières':  { display: NA, note: NA, perTx: false, hasSpread: false, overnight: null, feeRaw: 999 },
    },
    horizonScores: { court: 4, moyen: 6, long: 7 },
    horizonNotes:  { court: 'Déconseillé', moyen: 'Correct', long: 'Bon' },
    pros: ['100% suisse', 'App intuitive', 'Compte bancaire intégré'],
    cons: ['Spread élevé', 'Peu d\'actifs', 'Droit de timbre'],
    score: 6.5, affiliate: '#',
  },
  {
    id: 'neon', name: 'Neon', country: 'CH', flag: '🇨🇭',
    reg: 'swiss', stamp: true, minDeposit: 0, protection: '100\'000 CHF',
    swissTax: false, languages: ['FR', 'DE', 'EN'],
    assets: ['ETF', 'Actions'],
    fees: {
      ETF:       { display: '0.5% spread', note: 'pas de commission fixe', perTx: false, hasSpread: true, overnight: null, feeRaw: 0.5 },
      Actions:   { display: '0.5% spread', note: 'pas de commission fixe', perTx: false, hasSpread: true, overnight: null, feeRaw: 0.5 },
      Options:   { display: NA, note: NA, perTx: false, hasSpread: false, overnight: null, feeRaw: 999 },
      Obligations: { display: NA, note: NA, perTx: false, hasSpread: false, overnight: null, feeRaw: 999 },
      Forex:     { display: NA, note: NA, perTx: false, hasSpread: false, overnight: null, feeRaw: 999 },
      'Matières premières':  { display: NA, note: NA, perTx: false, hasSpread: false, overnight: null, feeRaw: 999 },
    },
    horizonScores: { court: 3, moyen: 6, long: 7 },
    horizonNotes:  { court: 'Déconseillé', moyen: 'Correct', long: 'Bon' },
    pros: ['App moderne', 'Compte suisse', 'Gratuit'],
    cons: ['Peu d\'actifs', 'Spread élevé', 'Droit de timbre'],
    score: 6.2, affiliate: '#',
  },
  {
    id: 'saxo', name: 'Saxo Bank', country: 'DK', flag: '🇩🇰',
    reg: 'international', stamp: false, minDeposit: 2000, protection: '100\'000 EUR',
    swissTax: false, languages: ['FR', 'DE', 'EN'],
    assets: ['ETF', 'Actions', 'Options', 'Obligations', 'Forex', 'Matières premières'],
    fees: {
      ETF:       { display: '3 USD min.', note: '0.08% · par transaction', perTx: true, hasSpread: false, overnight: null, feeRaw: 3 },
      Actions:   { display: '3 USD min.', note: '0.08% · par transaction', perTx: true, hasSpread: false, overnight: null, feeRaw: 3 },
      Options:   { display: '1.25 USD/contrat', note: 'par transaction', perTx: true, hasSpread: false, overnight: '~1.8% + Fed Funds/an', feeRaw: 1.25 },
      Obligations: { display: '3 USD min.', note: 'par transaction', perTx: true, hasSpread: true, overnight: null, feeRaw: 3 },
      Forex:     { display: 'Spread ~0.6 pip', note: 'EUR/USD Classic', perTx: false, hasSpread: true, overnight: 'Rollover selon paires', feeRaw: 0.6 },
      'Matières premières':  { display: '2 USD/contrat', note: 'Futures · par transaction', perTx: true, hasSpread: true, overnight: 'Roll à chaque échéance', feeRaw: 2 },
    },
    horizonScores: { court: 8, moyen: 8, long: 7 },
    horizonNotes:  { court: 'Bon', moyen: 'Bon', long: 'Correct' },
    pros: ['Large gamme d\'actifs', 'Outils professionnels', 'Exonéré timbre'],
    cons: ['Dépôt minimum 2000 USD', 'Frais modérés'],
    score: 8.0, affiliate: '#',
  },
  {
    id: 'revolut', name: 'Revolut', country: 'LT', flag: '🇱🇹',
    reg: 'international', stamp: false, minDeposit: 0, protection: "20\'000 EUR",
    swissTax: false, languages: ['FR', 'DE', 'IT', 'EN'],
    assets: ['ETF', 'Actions'],
    fees: {
      ETF:       { display: '0 – 0.25%', note: 'Gratuit (Standard) · 0.25% (plans payants illimité)', perTx: false, hasSpread: true, overnight: null, feeRaw: 0 },
      Actions:   { display: '0 – 0.25%', note: 'Gratuit (Standard) · 0.25% (plans payants illimité)', perTx: false, hasSpread: true, overnight: null, feeRaw: 0 },
      Options:   { display: NA, note: NA, perTx: false, hasSpread: false, overnight: null, feeRaw: 999 },
      Obligations: { display: NA, note: NA, perTx: false, hasSpread: false, overnight: null, feeRaw: 999 },
      Forex:     { display: NA, note: NA, perTx: false, hasSpread: false, overnight: null, feeRaw: 999 },
      'Matières premières':  { display: NA, note: NA, perTx: false, hasSpread: false, overnight: null, feeRaw: 999 },
    },
    horizonScores: { court: 5, moyen: 6, long: 6 },
    horizonNotes:  { court: 'Limité', moyen: 'Correct', long: 'Correct' },
    pros: ["Frais très bas sur plans payants", "App tout-en-un", "Change avantageux"],
    cons: ["Entité lituanienne (non FINMA)", "Catalogue ETF limité", "Pas de rapport fiscal CH"],
    score: 5.8, affiliate: '#',
  },
]

const ASSETS = ['Tous', 'ETF', 'Actions', 'Options', 'Obligations', 'Forex', 'Matières premières']
const HORIZONS = ['Tous horizons', 'Court terme', 'Moyen terme', 'Long terme']
const CAPITALS = ["Tous capitaux", "< 20'000 CHF", "20'000 – 100'000 CHF", "> 100'000 CHF"]

type State = {
  asset: string
  horizon: string
  capital: string
  reg: string
  stamp: string
  sort: string
  open: string | null
}

export default function ComparateurPage() {
  const [state, setState] = useState<State>({
    asset: 'Tous', horizon: 'Tous horizons', capital: 'all',
    reg: 'all', stamp: 'all', sort: 'score', open: null,
  })
  const [regOpen, setRegOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const regRef = useRef<HTMLDivElement>(null)
  const sortRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!regOpen) return
    const h = (e: MouseEvent) => { if (regRef.current && !regRef.current.contains(e.target as Node)) setRegOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [regOpen])
  useEffect(() => {
    if (!sortOpen) return
    const h = (e: MouseEvent) => { if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [sortOpen])

  function getFeeInfo(b: typeof brokers[0]) {
    const asset = state.asset === 'Tous' ? 'ETF' : state.asset
    const f = b.fees[asset as keyof typeof b.fees]
    if (!f || f.display === null) return { display: 'Non disponible', note: '', perTx: false, hasSpread: false, overnight: null }
    return f
  }

  function getHorizonKey() {
    if (state.horizon === 'Court terme') return 'court'
    if (state.horizon === 'Moyen terme') return 'moyen'
    if (state.horizon === 'Long terme') return 'long'
    return null
  }

  function computeScore(b: typeof brokers[0]): number {
    const hk = getHorizonKey()
    const horizonBase = hk ? b.horizonScores[hk as keyof typeof b.horizonScores] : b.score

    const hasFee = state.asset !== 'Tous'
    const hasCap = state.capital !== 'all'

    let feeScore = 0
    if (hasFee) {
      const fee = b.fees[state.asset as keyof typeof b.fees]
      if (!fee || fee.feeRaw === 999) return 0
      const r = fee.feeRaw
      feeScore = r === 0 ? 10 : r < 0.3 ? 9.5 : r < 0.6 ? 9.0 : r < 1 ? 8.5 : r < 2 ? 7.5 : r < 4 ? 7.0 : r < 9 ? 6.0 : 4.0
    }

    const capKey = state.capital === "< 20'000 CHF" ? 'small' : state.capital === "> 100'000 CHF" ? 'large' : 'medium'
    const capScore = hasCap ? getCapitalScore(b, capKey) : 0

    let result: number
    if (!hasFee && !hasCap) result = horizonBase
    else if (hasFee && !hasCap) result = horizonBase * 0.6 + feeScore * 0.4
    else if (!hasFee && hasCap) result = horizonBase * 0.6 + capScore * 0.4
    else result = horizonBase * 0.4 + feeScore * 0.3 + capScore * 0.3

    return Math.round(result * 10) / 10
  }

  function getCapitalScore(b: typeof brokers[0], capital: string): number {
    if (capital === 'small') {
      let s = 7
      if (b.minDeposit === 0) s += 0.5
      if (b.minDeposit >= 1000) s -= 1.5
      if (b.minDeposit >= 2000) s -= 1.0
      if (b.id === 'swissquote') s -= 1.0   // 9 CHF min sur petits montants = coûteux
      if (b.id === 'ibkr') s += 1.0         // 0.50 USD min, très compétitif
      if (b.id === 'degiro') s += 1.0       // ETF gratuits, pas de dépôt min
      if (b.id === 'trade-republic') s += 1.0 // 1 EUR fixe
      if (b.id === 'revolut') s += 0.5      // gratuit sur plan Standard
      return Math.max(1, Math.min(10, s))
    }
    if (capital === 'large') {
      let s = 7
      if (b.id === 'ibkr') s += 2.0         // 500k USD (SIPC), frais % très compétitifs à ce niveau
      if (b.id === 'swissquote') s += 1.5   // banque suisse, rapport fiscal CH, 100k CHF couvert
      if (b.id === 'saxo') s += 1.0         // outils pros, bons pour portefeuilles > 100k
      if (b.id === 'degiro') s -= 1.0       // 20k EUR protection insuffisante pour > 100k
      if (b.id === 'revolut') s -= 2.0      // 20k EUR prot., entité LT, pas de rapport fiscal
      if (b.id === 'yuh') s -= 0.5          // limité en actifs à ce niveau
      if (b.id === 'neon') s -= 0.5
      if (b.swissTax) s += 0.5
      return Math.max(1, Math.min(10, s))
    }
    return b.score // medium: score de base
  }

  const filtered = useMemo(() => brokers.filter(b => {
    if (state.asset !== 'Tous' && !b.assets.includes(state.asset)) return false
    if (state.reg !== 'all' && b.reg !== state.reg) return false
    if (state.stamp === 'exonere' && b.stamp) return false
    const hk = getHorizonKey()
    if (hk && b.horizonScores[hk as keyof typeof b.horizonScores] < 5) return false
    return true
  }).sort((a, b) => {
    if (state.sort === 'score') {
      return computeScore(b) - computeScore(a)
    }
    if (state.sort === 'fees') {
      const asset = state.asset === 'Tous' ? 'ETF' : state.asset
      const fa = a.fees[asset as keyof typeof a.fees]?.feeRaw ?? 999
      const fb = b.fees[asset as keyof typeof b.fees]?.feeRaw ?? 999
      return fa - fb
    }
    return 0
  }), [state.asset, state.horizon, state.capital, state.reg, state.stamp, state.sort])

  const openBroker = useMemo(() => brokers.find(b => b.id === state.open), [state.open])

  return (
    <div className="min-h-screen bg-[#F5F3EF] dark:bg-[#0F1E2C] text-[#1B3050] dark:text-[#E8E4DC]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Nav */}
      <Header />

      <div className="max-w-6xl mx-auto px-4 py-10">
        {/* Titre */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold tracking-tight">Comparateur de courtiers</h1>
            </div>
            <p className="text-[#5C6880] text-sm">Comparez les frais, actifs disponibles et adéquation par horizon d&apos;investissement des principaux courtiers accessibles depuis la Suisse.</p>
          </div>
        </div>

        {/* Filtres */}
        <div style={{ background: 'var(--finv-card)', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
          {/* Assets */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--finv-slate)', marginBottom: '0.5rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type d'actif</div>
            <div className="inline-flex flex-wrap gap-1 p-1 bg-[#F5F3EF] dark:bg-[#1B2D3E] border border-[#DDD9D1] dark:border-transparent rounded-xl w-full">
              {ASSETS.map(a => (
                <button key={a} onClick={() => setState(s => ({ ...s, asset: a }))}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${state.asset === a ? 'bg-white dark:bg-[#0F1E2C] text-[#1B3050] dark:text-[#E8E4DC] shadow-sm border border-[#DDD9D1] dark:border-[#2a3f52]' : 'text-[#9E9A93] hover:text-[#5C6880] dark:hover:text-[#A8B8C8]'}`}>
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Horizon */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--finv-slate)', marginBottom: '0.5rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Horizon</div>
            <div className="inline-flex flex-wrap gap-1 p-1 bg-[#F5F3EF] dark:bg-[#1B2D3E] border border-[#DDD9D1] dark:border-transparent rounded-xl w-full">
              {HORIZONS.map(h => (
                <button key={h} onClick={() => setState(s => ({ ...s, horizon: h }))}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${state.horizon === h ? 'bg-white dark:bg-[#0F1E2C] text-[#1B3050] dark:text-[#E8E4DC] shadow-sm border border-[#DDD9D1] dark:border-[#2a3f52]' : 'text-[#9E9A93] hover:text-[#5C6880] dark:hover:text-[#A8B8C8]'}`}>
                  {h}
                </button>
              ))}
            </div>
          </div>

          {/* Capital investi */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--finv-slate)', marginBottom: '0.5rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Capital investi</div>
            <div className="inline-flex flex-wrap gap-1 p-1 bg-[#F5F3EF] dark:bg-[#1B2D3E] border border-[#DDD9D1] dark:border-transparent rounded-xl w-full">
              {CAPITALS.map(c => (
                <button key={c} onClick={() => setState(s => ({ ...s, capital: c === 'Tous capitaux' ? 'all' : c }))}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${(c === 'Tous capitaux' ? state.capital === 'all' : state.capital === c) ? 'bg-white dark:bg-[#0F1E2C] text-[#1B3050] dark:text-[#E8E4DC] shadow-sm border border-[#DDD9D1] dark:border-[#2a3f52]' : 'text-[#9E9A93] hover:text-[#5C6880] dark:hover:text-[#A8B8C8]'}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Autres filtres */}
          <div className="flex flex-wrap gap-3 items-center">
            {/* Réglementation */}
            <div className="relative" ref={regRef}>
              <button type="button" onClick={() => setRegOpen(o => !o)}
                className="flex items-center justify-between gap-2 min-w-[180px] rounded-lg px-3 py-2.5 text-sm border border-[#DDD9D1] dark:border-[#2a3f52] bg-white dark:bg-[#0F1E2C] text-[#1B3050] dark:text-[#E8E4DC] transition-colors focus:outline-none focus:ring-2 focus:ring-[#2B6B5A]/30 focus:border-[#2B6B5A]">
                <span>{{ all: 'Toutes réglementations', swiss: 'Courtiers suisses', international: 'Courtiers internationaux' }[state.reg]}</span>
                <svg className={`w-4 h-4 text-[#9E9A93] flex-shrink-0 transition-transform ${regOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
              </button>
              {regOpen && (
                <div className="absolute z-50 mt-1 w-full rounded-lg border border-[#DDD9D1] dark:border-[#2a3f52] bg-[#F5F3EF] dark:bg-[#0F1E2C] shadow-lg overflow-hidden">
                  {[['all', 'Toutes réglementations'], ['swiss', 'Courtiers suisses'], ['international', 'Courtiers internationaux']].map(([val, label]) => (
                    <button key={val} type="button" onClick={() => { setState(s => ({ ...s, reg: val })); setRegOpen(false) }}
                      className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${state.reg === val ? 'bg-[#2B6B5A]/10 text-[#2B6B5A] font-medium' : 'text-[#1B3050] dark:text-[#E8E4DC] hover:bg-[#DDD9D1]/40 dark:hover:bg-[#162534]'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Tri */}
            <div className="relative" ref={sortRef}>
              <button type="button" onClick={() => setSortOpen(o => !o)}
                className="flex items-center justify-between gap-2 min-w-[150px] rounded-lg px-3 py-2.5 text-sm border border-[#DDD9D1] dark:border-[#2a3f52] bg-white dark:bg-[#0F1E2C] text-[#1B3050] dark:text-[#E8E4DC] transition-colors focus:outline-none focus:ring-2 focus:ring-[#2B6B5A]/30 focus:border-[#2B6B5A]">
                <span>{{ score: 'Trier par score', fees: 'Trier par frais' }[state.sort]}</span>
                <svg className={`w-4 h-4 text-[#9E9A93] flex-shrink-0 transition-transform ${sortOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
              </button>
              {sortOpen && (
                <div className="absolute z-50 mt-1 w-full rounded-lg border border-[#DDD9D1] dark:border-[#2a3f52] bg-[#F5F3EF] dark:bg-[#0F1E2C] shadow-lg overflow-hidden">
                  {[['score', 'Trier par score'], ['fees', 'Trier par frais']].map(([val, label]) => (
                    <button key={val} type="button" onClick={() => { setState(s => ({ ...s, sort: val })); setSortOpen(false) }}
                      className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${state.sort === val ? 'bg-[#2B6B5A]/10 text-[#2B6B5A] font-medium' : 'text-[#1B3050] dark:text-[#E8E4DC] hover:bg-[#DDD9D1]/40 dark:hover:bg-[#162534]'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Résultats */}
        <div style={{ fontSize: '0.85rem', color: 'var(--finv-slate)', marginBottom: '1rem' }}>{filtered.length} courtier{filtered.length > 1 ? 's' : ''} trouvé{filtered.length > 1 ? 's' : ''}</div>

        <div style={{ display: 'grid', gap: '1rem' }}>
          {filtered.map((b, priceRank0) => {
            const priceRank = priceRank0 + 1
            const fee = getFeeInfo(b)
            const hk = getHorizonKey()
            const hScore = hk ? b.horizonScores[hk as keyof typeof b.horizonScores] : null
            const hNote = hk ? b.horizonNotes[hk as keyof typeof b.horizonNotes] : null

            return (
              <div key={b.id} style={{ background: 'var(--finv-card)', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 8px rgba(0,0,0,0.06)', border: '1px solid var(--finv-border)', position: 'relative' }}>
                <span style={{ position: 'absolute', top: '1rem', left: '1rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 28, height: 28, borderRadius: 14, background: priceRank === 1 ? '#2B6B5A' : 'var(--finv-card2)', color: priceRank === 1 ? 'white' : 'var(--finv-slate)', fontSize: '0.72rem', fontWeight: 700, padding: '0 6px' }}>#{priceRank}</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ fontSize: '2rem' }}>{b.flag}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--finv-text)' }}>{b.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--finv-slate)' }}>
                        {b.reg === 'swiss' ? '🇨🇭 Courtier suisse' : '🌍 Courtier international'} · Dépôt min. {b.minDeposit === 0 ? 'aucun' : b.minDeposit + ' USD'}
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                        {!b.stamp && <span style={{ fontSize: '0.7rem', background: 'var(--finv-badge-green-bg)', color: '#2B6B5A', padding: '0.2rem 0.6rem', borderRadius: '12px', fontWeight: 600 }}>Exonéré timbre</span>}
                        {b.swissTax && <span style={{ fontSize: '0.7rem', background: 'var(--finv-badge-green-bg)', color: '#2B6B5A', padding: '0.2rem 0.6rem', borderRadius: '12px', fontWeight: 600 }}>Rapport fiscal CH</span>}
                        {fee.perTx && <span style={{ fontSize: '0.7rem', background: 'var(--finv-badge-amber-bg)', color: '#B5820F', padding: '0.2rem 0.6rem', borderRadius: '12px', fontWeight: 600 }}>Par transaction</span>}
                        {fee.hasSpread && <span style={{ fontSize: '0.7rem', background: 'var(--finv-badge-red-bg)', color: '#C0392B', padding: '0.2rem 0.6rem', borderRadius: '12px', fontWeight: 600 }}>Spread</span>}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--finv-slate)', marginBottom: '0.2rem' }}>
                      {state.asset === 'Tous' ? 'ETF' : state.asset}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '1.2rem', color: fee.display === 'Non disponible' ? '#C0392B' : 'var(--finv-text)' }}>{fee.display}</div>
                    {fee.note && <div style={{ fontSize: '0.75rem', color: 'var(--finv-slate)' }}>{fee.note}</div>}
                    {fee.overnight && <div style={{ fontSize: '0.72rem', color: '#B5820F', marginTop: '0.2rem' }}>🌙 {fee.overnight}</div>}
                    {hNote && (
                      <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', fontWeight: 600,
                        color: hScore! >= 8 ? '#2B6B5A' : hScore! >= 6 ? '#B5820F' : '#C0392B' }}>
                        {hNote} (horizon)
                      </div>
                    )}
                    <div style={{ marginTop: '0.3rem', fontSize: '0.8rem', color: computeScore(b) >= 8 ? '#2B6B5A' : computeScore(b) >= 6 ? '#B5820F' : '#C0392B', fontWeight: 600 }}>
                      ★ {computeScore(b)}/10{(state.asset !== 'Tous' || state.horizon !== 'Tous horizons' || state.capital !== 'all') && <span style={{ fontSize: '0.7rem', fontWeight: 400, marginLeft: '0.3rem', color: 'var(--finv-slate)' }}>contextualisé</span>}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button onClick={() => setState(s => ({ ...s, open: s.open === b.id ? null : b.id }))}
                    className="px-5 py-2 rounded-lg text-sm font-medium border border-[#DDD9D1] dark:border-[#2a3f52] bg-white dark:bg-[#0F1E2C] text-[#1B3050] dark:text-[#E8E4DC] transition-colors hover:border-[#2B6B5A] dark:hover:border-[#2B6B5A] cursor-pointer">
                    {state.open === b.id ? 'Masquer' : 'Voir détails'}
                  </button>
                  <a href={b.affiliate} style={{ padding: '0.5rem 1.2rem', background: '#2B6B5A', color: 'white', borderRadius: '8px', fontSize: '0.85rem', textDecoration: 'none', fontWeight: 600 }}>
                    Ouvrir un compte →
                  </a>
                </div>

                {/* Détail */}
                {state.open === b.id && (
                  <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--finv-border)', paddingTop: '1.5rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--finv-text)', marginBottom: '0.75rem' }}>✅ Points forts</div>
                        {b.pros.map((p, i) => <div key={i} style={{ fontSize: '0.85rem', color: '#2B6B5A', marginBottom: '0.3rem' }}>+ {p}</div>)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--finv-text)', marginBottom: '0.75rem' }}>⚠️ Points faibles</div>
                        {b.cons.map((c, i) => <div key={i} style={{ fontSize: '0.85rem', color: '#C0392B', marginBottom: '0.3rem' }}>- {c}</div>)}
                      </div>
                    </div>

                    <div style={{ marginTop: '1.5rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--finv-text)', marginBottom: '0.75rem' }}>Frais par actif</div>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                          <thead>
                            <tr style={{ background: 'var(--finv-card2)' }}>
                              <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--finv-slate)', fontWeight: 600 }}>Actif</th>
                              <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--finv-slate)', fontWeight: 600 }}>Frais</th>
                              <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--finv-slate)', fontWeight: 600 }}>Overnight</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(b.fees).map(([asset, f]) => (
                              <tr key={asset} style={{ borderBottom: '1px solid var(--finv-border)' }}>
                                <td style={{ padding: '0.5rem', fontWeight: 500, color: 'var(--finv-text)' }}>{asset}</td>
                                <td style={{ padding: '0.5rem', color: f.display ? 'var(--finv-text)' : '#C0392B' }}>{f.display || 'Non disponible'}{f.note ? ` — ${f.note}` : ''}</td>
                                <td style={{ padding: '0.5rem', color: '#B5820F' }}>{f.overnight || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div style={{ marginTop: '1.5rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--finv-text)', marginBottom: '0.75rem' }}>Score par horizon</div>
                      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        {[['Court terme', 'court'], ['Moyen terme', 'moyen'], ['Long terme', 'long']].map(([label, key]) => {
                          const score = b.horizonScores[key as keyof typeof b.horizonScores]
                          const note = b.horizonNotes[key as keyof typeof b.horizonNotes]
                          return (
                            <div key={key} style={{ background: score >= 8 ? 'var(--finv-badge-green-bg)' : score >= 6 ? 'var(--finv-badge-amber-bg)' : 'var(--finv-badge-red-bg)', padding: '0.75rem 1rem', borderRadius: '8px', textAlign: 'center', minWidth: '100px' }}>
                              <div style={{ fontSize: '0.75rem', color: 'var(--finv-slate)' }}>{label}</div>
                              <div style={{ fontWeight: 700, fontSize: '1.2rem', color: score >= 8 ? '#2B6B5A' : score >= 6 ? '#B5820F' : '#C0392B' }}>{score}/10</div>
                              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: score >= 8 ? '#2B6B5A' : score >= 6 ? '#B5820F' : '#C0392B' }}>{note}</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--finv-slate)' }}>
                      Protection: {b.protection} · Langues: {b.languages.join(', ')}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    <Footer />
    </div>
  )
}