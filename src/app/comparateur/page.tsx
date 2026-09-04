'use client'
import { useState } from 'react'

const NA = null

const brokers = [
  {
    id: 'ibkr', name: 'Interactive Brokers', country: 'US', flag: '🇺🇸',
    reg: 'international', stamp: false, minDeposit: 0, protection: '500\'000 USD (SIPC)',
    swissTax: false, languages: ['FR', 'DE', 'IT', 'EN'],
    assets: ['ETF', 'Actions', 'Options', 'Obligations', 'Forex', 'Matières'],
    fees: {
      ETF:       { display: '0.50 USD min.', note: '0.005% · par transaction', perTx: true,  hasSpread: false, overnight: null, feeRaw: 0.5 },
      Actions:   { display: '0.50 USD min.', note: '0.005% · par transaction', perTx: true,  hasSpread: false, overnight: null, feeRaw: 0.5 },
      Options:   { display: '0.70 USD/contrat', note: 'min 1 USD · par transaction', perTx: true, hasSpread: false, overnight: '~1.5% + Fed Funds/an (si marge)', feeRaw: 0.7 },
      Obligations: { display: '1 USD min.', note: 'par transaction', perTx: true, hasSpread: true, overnight: null, feeRaw: 1 },
      Forex:     { display: 'Spread 0.1–0.2 pip', note: 'EUR/USD · pas de commission', perTx: false, hasSpread: true, overnight: 'Rollover selon paires', feeRaw: 0.1 },
      Matières:  { display: '0.85 USD/contrat', note: 'Futures · par transaction', perTx: true, hasSpread: true, overnight: 'Roll à chaque échéance', feeRaw: 0.85 },
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
      Matières:  { display: NA, note: NA, perTx: false, hasSpread: false, overnight: null, feeRaw: 999 },
    },
    horizonScores: { court: 7, moyen: 9, long: 9 },
    horizonNotes:  { court: 'Correct', moyen: 'Idéal', long: 'Idéal' },
    pros: ['ETFs gratuits', 'Interface simple', 'Exonéré timbre'],
    cons: ['Pas de Forex/Matières', 'Pas de rapport fiscal CH'],
    score: 8.7, affiliate: '#',
  },
  {
    id: 'swissquote', name: 'Swissquote', country: 'CH', flag: '🇨🇭',
    reg: 'swiss', stamp: true, minDeposit: 1000, protection: '100\'000 CHF',
    swissTax: true, languages: ['FR', 'DE', 'IT', 'EN'],
    assets: ['ETF', 'Actions', 'Options', 'Obligations', 'Forex', 'Matières'],
    fees: {
      ETF:       { display: '9 CHF min.', note: '0.10% · par transaction', perTx: true, hasSpread: false, overnight: null, feeRaw: 9 },
      Actions:   { display: '9 CHF min.', note: '0.10% · par transaction', perTx: true, hasSpread: false, overnight: null, feeRaw: 9 },
      Options:   { display: '3 CHF/contrat', note: 'min 9 CHF · par transaction', perTx: true, hasSpread: false, overnight: '~2% + BNS/an', feeRaw: 3 },
      Obligations: { display: '9 CHF min.', note: 'par transaction', perTx: true, hasSpread: true, overnight: null, feeRaw: 9 },
      Forex:     { display: 'Spread ~1 pip', note: 'EUR/CHF standard', perTx: false, hasSpread: true, overnight: 'Rollover selon paires', feeRaw: 1 },
      Matières:  { display: '9 CHF min.', note: 'CFDs et ETFs matières', perTx: true, hasSpread: true, overnight: '~3% + BNS/an (CFD)', feeRaw: 9 },
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
      Matières:  { display: NA, note: NA, perTx: false, hasSpread: false, overnight: null, feeRaw: 999 },
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
      Matières:  { display: NA, note: NA, perTx: false, hasSpread: false, overnight: null, feeRaw: 999 },
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
      Matières:  { display: NA, note: NA, perTx: false, hasSpread: false, overnight: null, feeRaw: 999 },
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
    assets: ['ETF', 'Actions', 'Options', 'Obligations', 'Forex', 'Matières'],
    fees: {
      ETF:       { display: '3 USD min.', note: '0.08% · par transaction', perTx: true, hasSpread: false, overnight: null, feeRaw: 3 },
      Actions:   { display: '3 USD min.', note: '0.08% · par transaction', perTx: true, hasSpread: false, overnight: null, feeRaw: 3 },
      Options:   { display: '1.25 USD/contrat', note: 'par transaction', perTx: true, hasSpread: false, overnight: '~1.8% + Fed Funds/an', feeRaw: 1.25 },
      Obligations: { display: '3 USD min.', note: 'par transaction', perTx: true, hasSpread: true, overnight: null, feeRaw: 3 },
      Forex:     { display: 'Spread ~0.6 pip', note: 'EUR/USD Classic', perTx: false, hasSpread: true, overnight: 'Rollover selon paires', feeRaw: 0.6 },
      Matières:  { display: '2 USD/contrat', note: 'Futures · par transaction', perTx: true, hasSpread: true, overnight: 'Roll à chaque échéance', feeRaw: 2 },
    },
    horizonScores: { court: 8, moyen: 8, long: 7 },
    horizonNotes:  { court: 'Bon', moyen: 'Bon', long: 'Correct' },
    pros: ['Large gamme d\'actifs', 'Outils professionnels', 'Exonéré timbre'],
    cons: ['Dépôt minimum 2000 USD', 'Frais modérés'],
    score: 8.0, affiliate: '#',
  },
]

const ASSETS = ['Tous', 'ETF', 'Actions', 'Options', 'Obligations', 'Forex', 'Matières']
const HORIZONS = ['Tous horizons', 'Court terme', 'Moyen terme', 'Long terme']

type State = {
  asset: string
  horizon: string
  reg: string
  stamp: string
  sort: string
  open: string | null
}

export default function ComparateurPage() {
  const [state, setState] = useState<State>({
    asset: 'Tous', horizon: 'Tous horizons',
    reg: 'all', stamp: 'all', sort: 'score', open: null,
  })

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

  const filtered = brokers.filter(b => {
    if (state.asset !== 'Tous' && !b.assets.includes(state.asset)) return false
    if (state.reg !== 'all' && b.reg !== state.reg) return false
    if (state.stamp === 'exonere' && b.stamp) return false
    const hk = getHorizonKey()
    if (hk && b.horizonScores[hk as keyof typeof b.horizonScores] < 5) return false
    return true
  }).sort((a, b) => {
    if (state.sort === 'score') return b.score - a.score
    if (state.sort === 'fees') {
      const asset = state.asset === 'Tous' ? 'ETF' : state.asset
      const fa = a.fees[asset as keyof typeof a.fees]?.feeRaw ?? 999
      const fb = b.fees[asset as keyof typeof b.fees]?.feeRaw ?? 999
      return fa - fb
    }
    return 0
  })

  const openBroker = brokers.find(b => b.id === state.open)

  return (
    <div style={{ minHeight: '100vh', background: '#F5F3EF', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#1B3050', color: 'white', padding: '2rem', textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '2rem', margin: 0 }}>Comparateur de courtiers</h1>
        <p style={{ color: '#B5C4D8', marginTop: '0.5rem' }}>Trouvez le courtier adapté à votre profil d'investisseur suisse</p>
      </div>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem 1rem' }}>
        {/* Filtres */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
          {/* Assets */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.8rem', color: '#5C6880', marginBottom: '0.5rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type d'actif</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {ASSETS.map(a => (
                <button key={a} onClick={() => setState(s => ({ ...s, asset: a }))}
                  style={{ padding: '0.4rem 1rem', borderRadius: '20px', border: '1.5px solid', fontSize: '0.85rem', cursor: 'pointer',
                    background: state.asset === a ? '#1B3050' : 'white',
                    color: state.asset === a ? 'white' : '#1B3050',
                    borderColor: state.asset === a ? '#1B3050' : '#DDD9D1' }}>
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Horizon */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.8rem', color: '#5C6880', marginBottom: '0.5rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Horizon</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {HORIZONS.map(h => (
                <button key={h} onClick={() => setState(s => ({ ...s, horizon: h }))}
                  style={{ padding: '0.4rem 1rem', borderRadius: '20px', border: '1.5px solid', fontSize: '0.85rem', cursor: 'pointer',
                    background: state.horizon === h ? '#2B6B5A' : 'white',
                    color: state.horizon === h ? 'white' : '#2B6B5A',
                    borderColor: state.horizon === h ? '#2B6B5A' : '#DDD9D1' }}>
                  {h}
                </button>
              ))}
            </div>
          </div>

          {/* Autres filtres */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
            <select value={state.reg} onChange={e => setState(s => ({ ...s, reg: e.target.value }))}
              style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #DDD9D1', fontSize: '0.85rem', background: 'white' }}>
              <option value="all">Toutes réglementations</option>
              <option value="swiss">Courtiers suisses</option>
              <option value="international">Courtiers internationaux</option>
            </select>
            <select value={state.stamp} onChange={e => setState(s => ({ ...s, stamp: e.target.value }))}
              style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #DDD9D1', fontSize: '0.85rem', background: 'white' }}>
              <option value="all">Tous (timbre)</option>
              <option value="exonere">Exonérés de timbre</option>
            </select>
            <select value={state.sort} onChange={e => setState(s => ({ ...s, sort: e.target.value }))}
              style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #DDD9D1', fontSize: '0.85rem', background: 'white' }}>
              <option value="score">Trier par score</option>
              <option value="fees">Trier par frais</option>
            </select>
          </div>
        </div>

        {/* Résultats */}
        <div style={{ fontSize: '0.85rem', color: '#5C6880', marginBottom: '1rem' }}>{filtered.length} courtier{filtered.length > 1 ? 's' : ''} trouvé{filtered.length > 1 ? 's' : ''}</div>

        <div style={{ display: 'grid', gap: '1rem' }}>
          {filtered.map(b => {
            const fee = getFeeInfo(b)
            const hk = getHorizonKey()
            const hScore = hk ? b.horizonScores[hk as keyof typeof b.horizonScores] : null
            const hNote = hk ? b.horizonNotes[hk as keyof typeof b.horizonNotes] : null

            return (
              <div key={b.id} style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 8px rgba(0,0,0,0.06)', border: '1px solid #DDD9D1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ fontSize: '2rem' }}>{b.flag}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#1B3050' }}>{b.name}</div>
                      <div style={{ fontSize: '0.8rem', color: '#5C6880' }}>
                        {b.reg === 'swiss' ? '🇨🇭 Courtier suisse' : '🌍 Courtier international'} · Dépôt min. {b.minDeposit === 0 ? 'aucun' : b.minDeposit + ' USD'}
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                        {!b.stamp && <span style={{ fontSize: '0.7rem', background: '#E8F5F0', color: '#2B6B5A', padding: '0.2rem 0.6rem', borderRadius: '12px', fontWeight: 600 }}>Exonéré timbre</span>}
                        {b.swissTax && <span style={{ fontSize: '0.7rem', background: '#EEF2FF', color: '#1B3050', padding: '0.2rem 0.6rem', borderRadius: '12px', fontWeight: 600 }}>Rapport fiscal CH</span>}
                        {fee.perTx && <span style={{ fontSize: '0.7rem', background: '#FFF8EC', color: '#B5820F', padding: '0.2rem 0.6rem', borderRadius: '12px', fontWeight: 600 }}>Par transaction</span>}
                        {fee.hasSpread && <span style={{ fontSize: '0.7rem', background: '#FFF0F0', color: '#C0392B', padding: '0.2rem 0.6rem', borderRadius: '12px', fontWeight: 600 }}>Spread</span>}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: '#5C6880', marginBottom: '0.2rem' }}>
                      {state.asset === 'Tous' ? 'ETF' : state.asset}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '1.2rem', color: fee.display === 'Non disponible' ? '#C0392B' : '#1B3050' }}>{fee.display}</div>
                    {fee.note && <div style={{ fontSize: '0.75rem', color: '#5C6880' }}>{fee.note}</div>}
                    {fee.overnight && <div style={{ fontSize: '0.72rem', color: '#B5820F', marginTop: '0.2rem' }}>🌙 {fee.overnight}</div>}
                    {hNote && (
                      <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', fontWeight: 600,
                        color: hScore! >= 8 ? '#2B6B5A' : hScore! >= 6 ? '#B5820F' : '#C0392B' }}>
                        {hNote} (horizon)
                      </div>
                    )}
                    <div style={{ marginTop: '0.3rem', fontSize: '0.8rem', color: '#1B3050', fontWeight: 600 }}>★ {b.score}/10</div>
                  </div>
                </div>

                <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button onClick={() => setState(s => ({ ...s, open: s.open === b.id ? null : b.id }))}
                    style={{ padding: '0.5rem 1.2rem', border: '1.5px solid #1B3050', borderRadius: '8px', background: 'white', color: '#1B3050', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 500 }}>
                    {state.open === b.id ? 'Masquer' : 'Voir détails'}
                  </button>
                  <a href={b.affiliate} style={{ padding: '0.5rem 1.2rem', background: '#2B6B5A', color: 'white', borderRadius: '8px', fontSize: '0.85rem', textDecoration: 'none', fontWeight: 600 }}>
                    Ouvrir un compte →
                  </a>
                </div>

                {/* Détail */}
                {state.open === b.id && (
                  <div style={{ marginTop: '1.5rem', borderTop: '1px solid #DDD9D1', paddingTop: '1.5rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: '#1B3050', marginBottom: '0.75rem' }}>✅ Points forts</div>
                        {b.pros.map((p, i) => <div key={i} style={{ fontSize: '0.85rem', color: '#2B6B5A', marginBottom: '0.3rem' }}>+ {p}</div>)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: '#1B3050', marginBottom: '0.75rem' }}>⚠️ Points faibles</div>
                        {b.cons.map((c, i) => <div key={i} style={{ fontSize: '0.85rem', color: '#C0392B', marginBottom: '0.3rem' }}>- {c}</div>)}
                      </div>
                    </div>

                    <div style={{ marginTop: '1.5rem' }}>
                      <div style={{ fontWeight: 600, color: '#1B3050', marginBottom: '0.75rem' }}>Frais par actif</div>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                          <thead>
                            <tr style={{ background: '#F5F3EF' }}>
                              <th style={{ padding: '0.5rem', textAlign: 'left', color: '#5C6880', fontWeight: 600 }}>Actif</th>
                              <th style={{ padding: '0.5rem', textAlign: 'left', color: '#5C6880', fontWeight: 600 }}>Frais</th>
                              <th style={{ padding: '0.5rem', textAlign: 'left', color: '#5C6880', fontWeight: 600 }}>Overnight</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(b.fees).map(([asset, f]) => (
                              <tr key={asset} style={{ borderBottom: '1px solid #DDD9D1' }}>
                                <td style={{ padding: '0.5rem', fontWeight: 500, color: '#1B3050' }}>{asset}</td>
                                <td style={{ padding: '0.5rem', color: f.display ? '#1B3050' : '#C0392B' }}>{f.display || 'Non disponible'}{f.note ? ` — ${f.note}` : ''}</td>
                                <td style={{ padding: '0.5rem', color: '#B5820F' }}>{f.overnight || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div style={{ marginTop: '1.5rem' }}>
                      <div style={{ fontWeight: 600, color: '#1B3050', marginBottom: '0.75rem' }}>Score par horizon</div>
                      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        {[['Court terme', 'court'], ['Moyen terme', 'moyen'], ['Long terme', 'long']].map(([label, key]) => {
                          const score = b.horizonScores[key as keyof typeof b.horizonScores]
                          const note = b.horizonNotes[key as keyof typeof b.horizonNotes]
                          return (
                            <div key={key} style={{ background: score >= 8 ? '#E8F5F0' : score >= 6 ? '#FFF8EC' : '#FFF0F0', padding: '0.75rem 1rem', borderRadius: '8px', textAlign: 'center', minWidth: '100px' }}>
                              <div style={{ fontSize: '0.75rem', color: '#5C6880' }}>{label}</div>
                              <div style={{ fontWeight: 700, fontSize: '1.2rem', color: score >= 8 ? '#2B6B5A' : score >= 6 ? '#B5820F' : '#C0392B' }}>{score}/10</div>
                              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: score >= 8 ? '#2B6B5A' : score >= 6 ? '#B5820F' : '#C0392B' }}>{note}</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#5C6880' }}>
                      Protection: {b.protection} · Langues: {b.languages.join(', ')}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}