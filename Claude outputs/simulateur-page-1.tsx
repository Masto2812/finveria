'use client'

import { useState, useMemo } from 'react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

// 26 cantons — taux marginal combiné cantonal + communal (chef-lieu, estimation 2024)
const CANTONS = [
  { code: 'AG', name: 'Argovie', taux: 37.0 },
  { code: 'AI', name: 'App. Rhodes-Int.', taux: 26.0 },
  { code: 'AR', name: 'App. Rhodes-Ext.', taux: 30.0 },
  { code: 'BE', name: 'Berne', taux: 42.0 },
  { code: 'BL', name: 'Bâle-Campagne', taux: 37.0 },
  { code: 'BS', name: 'Bâle-Ville', taux: 38.0 },
  { code: 'FR', name: 'Fribourg', taux: 41.0 },
  { code: 'GE', name: 'Genève', taux: 43.0 },
  { code: 'GL', name: 'Glaris', taux: 32.0 },
  { code: 'GR', name: 'Grisons', taux: 39.0 },
  { code: 'JU', name: 'Jura', taux: 44.0 },
  { code: 'LU', name: 'Lucerne', taux: 33.0 },
  { code: 'NE', name: 'Neuchâtel', taux: 41.0 },
  { code: 'NW', name: 'Nidwald', taux: 25.0 },
  { code: 'OW', name: 'Obwald', taux: 25.0 },
  { code: 'SG', name: 'Saint-Gall', taux: 38.0 },
  { code: 'SH', name: 'Schaffhouse', taux: 33.0 },
  { code: 'SO', name: 'Soleure', taux: 40.0 },
  { code: 'SZ', name: 'Schwytz', taux: 21.0 },
  { code: 'TG', name: 'Thurgovie', taux: 35.0 },
  { code: 'TI', name: 'Tessin', taux: 39.0 },
  { code: 'UR', name: 'Uri', taux: 27.0 },
  { code: 'VD', name: 'Vaud', taux: 44.0 },
  { code: 'VS', name: 'Valais', taux: 40.0 },
  { code: 'ZG', name: 'Zoug', taux: 20.0 },
  { code: 'ZH', name: 'Zurich', taux: 38.0 },
]

// Barème IFD 2024 — personne seule [seuil, taux%]
const IFD_SEUL: [number, number][] = [
  [14500, 0], [31600, 0.77], [41400, 0.88], [55200, 2.64],
  [72500, 2.97], [78100, 5.94], [103600, 6.60], [134600, 8.80],
  [176000, 11.00], [755200, 13.20], [Infinity, 11.50],
]

// Barème IFD 2024 — marié(e)
const IFD_MARIE: [number, number][] = [
  [28800, 0], [50900, 1.00], [58400, 2.00], [75300, 3.00],
  [90300, 4.00], [103400, 5.00], [114700, 6.00], [124200, 7.00],
  [131700, 8.00], [141200, 9.00], [148700, 10.00], [156100, 11.00],
  [163400, 12.00], [170600, 13.00], [Infinity, 13.50],
]

function calcIFD(revenu: number, marie: boolean): number {
  if (revenu <= 0) return 0
  const brackets = marie ? IFD_MARIE : IFD_SEUL
  let tax = 0
  let prev = 0
  for (const [seuil, taux] of brackets) {
    if (revenu <= prev) break
    const inBracket = Math.min(revenu, seuil) - prev
    tax += (inBracket * taux) / 100
    prev = seuil
  }
  return tax
}

function fmt(n: number, sign = false): string {
  const s = Math.abs(n).toLocaleString('fr-CH', { maximumFractionDigits: 0 })
  if (sign && n < 0) return `− ${s} CHF`
  if (sign && n > 0) return `+ ${s} CHF`
  return `${s} CHF`
}

type Field = 'revenu' | 'dividendesCH' | 'dividendesETR' | 'transactionsCH' | 'transactionsETR'

// ─── Finveria design tokens ───────────────────────────────────────────────────
// Light surface
const C = {
  bgApp:       '#faf9f5',
  bgPanel:     '#f3f1ea',
  bgSurface:   '#ffffff',
  bgMuted:     '#f0eee6',
  bgSelected:  '#e3dacc',
  bgActive:    '#e8e6dc',
  borderSubtle:'rgba(15,12,8,0.08)',
  borderCard:  'rgba(15,12,8,0.12)',
  borderStrong:'rgba(15,12,8,0.22)',
  textPrimary: 'rgba(15,12,8,0.92)',
  textSecond:  'rgba(15,12,8,0.64)',
  textTertiary:'rgba(15,12,8,0.60)',
  textMuted:   'rgba(15,12,8,0.40)',
  accent:      '#d97757',
  accentBg:    'rgba(217,119,87,0.10)',
  accentHover: '#c46a4d',
  blue:        '#6a9bcc',
  success:     '#558a42',
  warning:     '#c9a82d',
  error:       '#a63244',
} as const

export default function SimulateurPage() {
  const [canton, setCanton] = useState('ZH')
  const [situation, setSituation] = useState<'seul' | 'marie'>('seul')
  const [vals, setVals] = useState<Record<Field, string>>({
    revenu: '', dividendesCH: '', dividendesETR: '',
    transactionsCH: '', transactionsETR: '',
  })

  const set = (f: Field) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setVals(v => ({ ...v, [f]: e.target.value.replace(/[^0-9.]/g, '') }))

  const num = (f: Field) => parseFloat(vals[f]) || 0

  const results = useMemo(() => {
    const revenu = num('revenu')
    const divCH = num('dividendesCH')
    const divETR = num('dividendesETR')
    const trCH = num('transactionsCH')
    const trETR = num('transactionsETR')
    const marie = situation === 'marie'

    // 1. Droit de timbre
    const timbreCH = trCH * 0.00075
    const timbreETR = trETR * 0.0015
    const timbreTotal = timbreCH + timbreETR

    // 2. Impôt anticipé (35% sur div CH — entièrement récupéré si déclaré)
    const impotAnticipe = divCH * 0.35
    // Montant net reçu avant remboursement
    const cashFlowAnticipe = -impotAnticipe // flux initial négatif, récupéré l'année suivante

    // 3. Dividendes imposables
    // En Suisse, 100% des dividendes sont imposables (revenu mobilier)
    const divImposables = divCH + divETR

    // 4. IFD sur les dividendes (différentiel = IFD(revenu+div) - IFD(revenu))
    const ifdSansDiv = calcIFD(revenu, marie)
    const ifdAvecDiv = calcIFD(revenu + divImposables, marie)
    const ifdSurDiv = ifdAvecDiv - ifdSansDiv

    // 5. Impôt cantonal + communal sur dividendes
    const cantonData = CANTONS.find(c => c.code === canton)!
    const tauxCantonal = cantonData.taux / 100
    // Taux marginal approximatif sur les dividendes
    const impotCantonal = divImposables * tauxCantonal

    // 6. Bilan
    const coutTotal = timbreTotal + ifdSurDiv + impotCantonal
    const bilanNet = -coutTotal + impotAnticipe // récupération anticipé net

    const tauxEffectif = divImposables > 0
      ? ((ifdSurDiv + impotCantonal) / divImposables) * 100
      : 0

    return {
      timbreCH, timbreETR, timbreTotal,
      impotAnticipe, cashFlowAnticipe,
      divImposables, ifdSurDiv, impotCantonal,
      coutTotal, bilanNet, tauxEffectif,
      cantonTaux: cantonData.taux,
    }
  }, [vals, canton, situation])

  const hasData = Object.values(vals).some(v => parseFloat(v) > 0)

  return (
    <div style={{ minHeight: '100vh', backgroundColor: C.bgApp, color: C.textPrimary }}>
      <Header />

      <div style={{ maxWidth: 1024, margin: '0 auto', padding: '2.5rem 1rem 4rem' }}>

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.375rem' }}>
            <h1 style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              letterSpacing: '-0.01em',
              color: C.textPrimary,
              margin: 0,
            }}>
              Simulateur fiscal cantonal
            </h1>
            <span style={{
              fontSize: '0.625rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
              backgroundColor: C.accentBg,
              color: C.accent,
              border: `1px solid rgba(217,119,87,0.25)`,
            }}>
              Premium
            </span>
          </div>
          <p style={{ fontSize: '0.8125rem', color: C.textSecond, margin: 0, lineHeight: 1.5 }}>
            Estimez votre charge fiscale sur vos revenus de placements — droit de timbre, impôt anticipé, IFD et impôt cantonal.
          </p>
        </div>

        {/* ── Two-column layout ─────────────────────────────────────────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,2fr) minmax(0,3fr)',
          gap: '1.25rem',
          alignItems: 'start',
        }}
          className="sim-grid"
        >

          {/* ── LEFT: Form ────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

            {/* Situation */}
            <FormCard title="Situation">
              {/* Canton */}
              <FormRow label="Canton de domicile">
                <select
                  value={canton}
                  onChange={e => setCanton(e.target.value)}
                  style={selectStyle()}
                >
                  {CANTONS.map(c => (
                    <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
                  ))}
                </select>
              </FormRow>

              {/* Situation fiscale — segmented control */}
              <FormRow label="Situation fiscale">
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.375rem',
                  padding: '0.25rem',
                  backgroundColor: C.bgMuted,
                  borderRadius: '8px',
                }}>
                  {(['seul', 'marie'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setSituation(s)}
                      style={{
                        padding: '0.4rem 0.75rem',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 500,
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        backgroundColor: situation === s ? C.bgSurface : 'transparent',
                        color: situation === s ? C.textPrimary : C.textSecond,
                        boxShadow: situation === s ? '0 1px 2px rgba(15,12,8,0.10)' : 'none',
                      }}
                    >
                      {s === 'seul' ? 'Célibataire' : 'Marié(e)'}
                    </button>
                  ))}
                </div>
              </FormRow>
            </FormCard>

            {/* Revenus */}
            <FormCard title="Revenus">
              <FormRow label="Revenu imposable" hint="hors investissements">
                <NumericInput
                  value={vals.revenu}
                  onChange={set('revenu')}
                  placeholder="80 000"
                />
              </FormRow>
              <FormRow label="Dividendes suisses" hint="brut" note="Soumis à l'impôt anticipé (35%)">
                <NumericInput
                  value={vals.dividendesCH}
                  onChange={set('dividendesCH')}
                  placeholder="2 000"
                />
              </FormRow>
              <FormRow label="Dividendes étrangers" hint="ETF, actions">
                <NumericInput
                  value={vals.dividendesETR}
                  onChange={set('dividendesETR')}
                  placeholder="1 500"
                />
              </FormRow>
            </FormCard>

            {/* Transactions */}
            <FormCard title="Transactions" titleHint="volume annuel">
              <FormRow label="Titres suisses" hint="0.075%">
                <NumericInput
                  value={vals.transactionsCH}
                  onChange={set('transactionsCH')}
                  placeholder="20 000"
                />
              </FormRow>
              <FormRow label="Titres étrangers" hint="0.15%">
                <NumericInput
                  value={vals.transactionsETR}
                  onChange={set('transactionsETR')}
                  placeholder="50 000"
                />
              </FormRow>
            </FormCard>
          </div>

          {/* ── RIGHT: Results ────────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

            {!hasData ? (
              /* Empty state */
              <div style={{
                ...cardBase(),
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '3.5rem 2rem',
                gap: '0.75rem',
                textAlign: 'center',
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2"/>
                  <line x1="8" y1="21" x2="16" y2="21"/>
                  <line x1="12" y1="17" x2="12" y2="21"/>
                </svg>
                <p style={{ fontSize: '0.8125rem', color: C.textTertiary, margin: 0, maxWidth: 240 }}>
                  Remplissez les champs à gauche pour obtenir votre estimation fiscale.
                </p>
              </div>
            ) : (
              <>
                {/* ── Main KPI card ──────────────────────────────────────── */}
                <div style={cardBase()}>
                  {/* Top row: total + effective rate */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: '1rem',
                    alignItems: 'start',
                    marginBottom: results.coutTotal > 0 ? '1.25rem' : 0,
                  }}>
                    <div>
                      <p style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: C.textTertiary, margin: '0 0 0.375rem' }}>
                        Charge fiscale nette estimée
                      </p>
                      <p style={{
                        fontSize: '2rem',
                        fontWeight: 700,
                        fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                        fontVariantNumeric: 'tabular-nums',
                        letterSpacing: '-0.02em',
                        color: C.textPrimary,
                        margin: 0,
                        lineHeight: 1.1,
                      }}>
                        {fmt(results.coutTotal)}
                      </p>
                    </div>
                    {results.tauxEffectif > 0 && (
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '0.6875rem', color: C.textTertiary, margin: '0 0 0.25rem', letterSpacing: '0.03em' }}>
                          Taux effectif divid.
                        </p>
                        <p style={{
                          fontSize: '1.5rem',
                          fontWeight: 700,
                          fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                          color: C.accent,
                          margin: 0,
                          lineHeight: 1.1,
                        }}>
                          {results.tauxEffectif.toFixed(1)}%
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Proportional breakdown bars */}
                  {results.coutTotal > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {[
                        { label: 'Droit de timbre', val: results.timbreTotal, color: C.textMuted },
                        { label: `Impôt cantonal ${canton} (${results.cantonTaux}%)`, val: results.impotCantonal, color: C.blue },
                        { label: 'IFD fédéral', val: results.ifdSurDiv, color: C.accent },
                      ].filter(i => i.val > 0).map(item => (
                        <div key={item.label}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                            <span style={{ fontSize: '0.75rem', color: C.textSecond }}>{item.label}</span>
                            <span style={{
                              fontSize: '0.75rem',
                              fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                              fontVariantNumeric: 'tabular-nums',
                              color: C.textPrimary,
                              fontWeight: 500,
                            }}>
                              {fmt(item.val)}
                            </span>
                          </div>
                          <div style={{ height: 3, borderRadius: 2, backgroundColor: C.bgMuted, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%',
                              borderRadius: 2,
                              width: `${(item.val / results.coutTotal) * 100}%`,
                              backgroundColor: item.color,
                              transition: 'width 0.3s ease',
                            }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── Calculation detail ─────────────────────────────────── */}
                <div style={cardBase()}>
                  <SectionTitle>Détail du calcul</SectionTitle>

                  <div style={{ display: 'flex', flexDirection: 'column' }}>

                    {/* Droit de timbre */}
                    <TableGroup label="Droit de timbre" />
                    {results.timbreCH > 0 && (
                      <TableRow
                        label={`Titres suisses (0.075% × ${fmt(num('transactionsCH'))})`}
                        value={fmt(results.timbreCH)}
                        negative
                      />
                    )}
                    {results.timbreETR > 0 && (
                      <TableRow
                        label={`Titres étrangers (0.15% × ${fmt(num('transactionsETR'))})`}
                        value={fmt(results.timbreETR)}
                        negative
                      />
                    )}

                    {/* Impôt anticipé */}
                    {results.impotAnticipe > 0 && (
                      <>
                        <TableGroup label="Impôt anticipé (35%)" />
                        <TableRow
                          label="Retenu à la source sur div. CH"
                          value={fmt(results.impotAnticipe)}
                          negative
                        />
                        <TableRow
                          label="Remboursé après déclaration ✓"
                          value={`+${fmt(results.impotAnticipe)}`}
                          positive
                        />
                        <div style={{ padding: '0.25rem 0.75rem 0.5rem', fontSize: '0.7rem', color: C.textMuted, fontStyle: 'italic' }}>
                          Impact net = 0 (flux de trésorerie différé d'un an)
                        </div>
                      </>
                    )}

                    {/* Impôt sur dividendes */}
                    {results.divImposables > 0 && (
                      <>
                        <TableGroup label="Impôt sur le revenu des dividendes" />
                        <TableRow
                          label="Dividendes imposables"
                          value={fmt(results.divImposables)}
                          neutral
                        />
                        {results.ifdSurDiv > 0 && (
                          <TableRow
                            label="IFD fédéral (taux marginal progressif)"
                            value={fmt(results.ifdSurDiv)}
                            negative
                          />
                        )}
                        <TableRow
                          label={`Cantonal + communal ${canton} (${results.cantonTaux}%)`}
                          value={fmt(results.impotCantonal)}
                          negative
                        />
                      </>
                    )}

                    {/* Total */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.75rem 0',
                      marginTop: '0.25rem',
                      borderTop: `2px solid ${C.borderStrong}`,
                    }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: C.textPrimary }}>
                        Charge fiscale totale
                      </span>
                      <span style={{
                        fontSize: '0.9375rem',
                        fontWeight: 700,
                        fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                        fontVariantNumeric: 'tabular-nums',
                        color: C.error,
                      }}>
                        −{fmt(results.coutTotal)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ── Canton comparison ──────────────────────────────────── */}
                <div style={cardBase()}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.875rem' }}>
                    <SectionTitle>Impact du canton sur vos dividendes</SectionTitle>
                    {results.divImposables > 0 && (
                      <span style={{ fontSize: '0.7rem', color: C.textTertiary }}>
                        pour {fmt(results.divImposables)} de dividendes
                      </span>
                    )}
                  </div>

                  {results.divImposables > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {[...CANTONS]
                        .sort((a, b) => a.taux - b.taux)
                        .map(c => {
                          const impot = results.divImposables * (c.taux / 100)
                          const isSelected = c.code === canton
                          const max = results.divImposables * 0.44
                          return (
                            <div
                              key={c.code}
                              onClick={() => setCanton(c.code)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.625rem',
                                padding: '0.3rem 0.5rem',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                backgroundColor: isSelected ? C.accentBg : 'transparent',
                                border: `1px solid ${isSelected ? 'rgba(217,119,87,0.25)' : 'transparent'}`,
                                transition: 'background-color 0.12s',
                              }}
                            >
                              <span style={{
                                fontSize: '0.6875rem',
                                fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                                width: '1.625rem',
                                color: isSelected ? C.accent : C.textMuted,
                                fontWeight: isSelected ? 600 : 400,
                                flexShrink: 0,
                              }}>
                                {c.code}
                              </span>
                              <div style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: C.bgMuted }}>
                                <div style={{
                                  height: '100%',
                                  borderRadius: 2,
                                  width: `${(impot / max) * 100}%`,
                                  backgroundColor: isSelected ? C.accent : C.borderStrong,
                                  transition: 'width 0.3s ease',
                                }} />
                              </div>
                              <span style={{
                                fontSize: '0.6875rem',
                                fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                                fontVariantNumeric: 'tabular-nums',
                                width: '5.25rem',
                                textAlign: 'right',
                                color: isSelected ? C.accent : C.textSecond,
                                fontWeight: isSelected ? 600 : 400,
                                flexShrink: 0,
                              }}>
                                {fmt(impot)}
                              </span>
                            </div>
                          )
                        })}
                    </div>
                  ) : (
                    <p style={{ fontSize: '0.8125rem', color: C.textTertiary, margin: 0 }}>
                      Entrez vos dividendes pour voir la comparaison.
                    </p>
                  )}
                </div>

                {/* Legal note */}
                <p style={{ fontSize: '0.6875rem', color: C.textMuted, margin: '0 0.25rem', lineHeight: 1.5 }}>
                  ⚠️ Estimation à titre indicatif basée sur les barèmes 2024. Les taux cantonaux sont des moyennes pour le chef-lieu.
                  Consultez un conseiller fiscal pour votre situation précise.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Responsive: stack on mobile */}
      <style>{`
        @media (max-width: 768px) {
          .sim-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      <Footer />
    </div>
  )
}

// ─── Design system sub-components ────────────────────────────────────────────

function cardBase(): React.CSSProperties {
  return {
    backgroundColor: '#ffffff',
    border: '1px solid rgba(15,12,8,0.12)',
    borderRadius: '10px',
    padding: '1.125rem',
    boxShadow: '0 1px 3px rgba(15,12,8,0.05)',
  }
}

function FormCard({ title, titleHint, children }: { title: string; titleHint?: string; children: React.ReactNode }) {
  return (
    <div style={cardBase()}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.375rem', marginBottom: '0.875rem' }}>
        <p style={{
          fontSize: '0.6875rem',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'rgba(15,12,8,0.40)',
          margin: 0,
        }}>
          {title}
        </p>
        {titleHint && (
          <span style={{ fontSize: '0.6875rem', color: 'rgba(15,12,8,0.30)', fontWeight: 400 }}>
            ({titleHint})
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
        {children}
      </div>
    </div>
  )
}

function FormRow({ label, hint, note, children }: { label: string; hint?: string; note?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ marginBottom: '0.3rem' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'rgba(15,12,8,0.65)' }}>
          {label}
        </span>
        {hint && (
          <span style={{ fontSize: '0.7rem', color: 'rgba(15,12,8,0.35)', marginLeft: '0.3rem' }}>
            ({hint})
          </span>
        )}
      </div>
      {children}
      {note && (
        <p style={{ fontSize: '0.6875rem', color: 'rgba(15,12,8,0.38)', margin: '0.25rem 0 0' }}>{note}</p>
      )}
    </div>
  )
}

function selectStyle(): React.CSSProperties {
  return {
    width: '100%',
    padding: '0.4rem 0.625rem',
    fontSize: '0.8125rem',
    color: 'rgba(15,12,8,0.85)',
    backgroundColor: '#faf9f5',
    border: '1px solid rgba(15,12,8,0.15)',
    borderRadius: '6px',
    outline: 'none',
    appearance: 'auto' as const,
  }
}

function NumericInput({ value, onChange, placeholder }: {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder: string
}) {
  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '0.4rem 2.75rem 0.4rem 0.625rem',
          fontSize: '0.8125rem',
          fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
          fontVariantNumeric: 'tabular-nums',
          color: 'rgba(15,12,8,0.85)',
          backgroundColor: '#faf9f5',
          border: '1px solid rgba(15,12,8,0.15)',
          borderRadius: '6px',
          outline: 'none',
        }}
        onFocus={e => {
          e.currentTarget.style.borderColor = '#d97757'
          e.currentTarget.style.boxShadow = '0 0 0 2px rgba(217,119,87,0.15)'
        }}
        onBlur={e => {
          e.currentTarget.style.borderColor = 'rgba(15,12,8,0.15)'
          e.currentTarget.style.boxShadow = 'none'
        }}
      />
      <span style={{
        position: 'absolute',
        right: '0.5rem',
        top: '50%',
        transform: 'translateY(-50%)',
        fontSize: '0.6875rem',
        color: 'rgba(15,12,8,0.32)',
        pointerEvents: 'none',
        fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
        letterSpacing: '0.02em',
      }}>
        CHF
      </span>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: '0.75rem',
      fontWeight: 600,
      color: 'rgba(15,12,8,0.85)',
      margin: '0 0 0.625rem',
    }}>
      {children}
    </p>
  )
}

function TableGroup({ label }: { label: string }) {
  return (
    <div style={{
      padding: '0.5rem 0 0.25rem',
      fontSize: '0.6875rem',
      fontWeight: 700,
      letterSpacing: '0.07em',
      textTransform: 'uppercase',
      color: 'rgba(15,12,8,0.38)',
      borderTop: '1px solid rgba(15,12,8,0.07)',
      marginTop: '0.125rem',
    }}>
      {label}
    </div>
  )
}

function TableRow({ label, value, negative, positive, neutral }: {
  label: string
  value: string
  negative?: boolean
  positive?: boolean
  neutral?: boolean
}) {
  const valueColor = negative
    ? '#a63244'
    : positive
    ? '#558a42'
    : 'rgba(15,12,8,0.85)'

  const valuePrefix = negative ? '−' : ''

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0.3rem 0',
      gap: '1rem',
    }}>
      <span style={{ fontSize: '0.7875rem', color: 'rgba(15,12,8,0.58)', paddingLeft: '0.75rem', lineHeight: 1.4 }}>
        {label}
      </span>
      <span style={{
        fontSize: '0.7875rem',
        fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
        fontVariantNumeric: 'tabular-nums',
        color: valueColor,
        fontWeight: 500,
        flexShrink: 0,
      }}>
        {value}
      </span>
    </div>
  )
}
