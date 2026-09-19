'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

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

const IFD_SEUL: Array<[number, number]> = [
  [14500, 0], [31600, 0.77], [41400, 0.88], [55200, 2.64],
  [72500, 2.97], [78100, 5.94], [103600, 6.60], [134600, 8.80],
  [176000, 11.00], [755200, 13.20], [Infinity, 11.50],
]

const IFD_MARIE: Array<[number, number]> = [
  [28800, 0], [50900, 1.00], [58400, 2.00], [75300, 3.00],
  [90300, 4.00], [103400, 5.00], [114700, 6.00], [124200, 7.00],
  [131700, 8.00], [141200, 9.00], [148700, 10.00], [156100, 11.00],
  [163400, 12.00], [170600, 13.00], [Infinity, 13.50],
]

function calcIFD(revenu: number, marie: boolean): number {
  if (revenu <= 0) return 0
  const brackets = marie ? IFD_MARIE : IFD_SEUL
  let tax = 0, prev = 0
  for (const [seuil, taux] of brackets) {
    if (revenu <= prev) break
    tax += ((Math.min(revenu, seuil) - prev) * taux) / 100
    prev = seuil
  }
  return tax
}

function fmt(n: number): string {
  return Math.abs(n).toLocaleString('fr-CH', { maximumFractionDigits: 0 }) + ' CHF'
}

const AVS_TAUX = 0.106

const CARD_CLS = 'bg-white dark:bg-[#162534] border border-[#DDD9D1] dark:border-[#1e3347] rounded-xl'

const INPUT_CLS = [
  'w-full rounded-lg px-3 py-2.5 text-sm font-mono',
  'border border-[#DDD9D1] dark:border-[#2a3f52]',
  'bg-white dark:bg-[#0F1E2C]',
  'text-[#1B3050] dark:text-[#E8E4DC]',
  'placeholder-[#9E9A93]',
  'focus:outline-none focus:ring-2 focus:ring-[#2B6B5A]/30 focus:border-[#2B6B5A]',
  'transition-colors',
].join(' ')

const LABEL_CLS = 'block text-[11px] font-medium tracking-wide uppercase text-[#9E9A93] mb-1.5'

const CALENDRIER = [
  {
    quand: 'Dès réception du dividende',
    accent: '#D97706',
    items: [{ label: 'Impôt anticipé (35%)', detail: "Prélevé à la source sur les dividendes suisses. Votre courtier vous verse 65% du dividende. Les 35% sont récupérés l'année suivante." }],
  },
  {
    quand: "L'année suivante (déclaration fiscale)",
    accent: '#3B82F6',
    items: [
      { label: 'IFD + impôt cantonal sur dividendes', detail: "Déclarez tous vos dividendes (CH et étrangers) dans votre déclaration fiscale annuelle. L'impôt est calculé et facturé l'année suivante." },
      { label: 'Remboursement impôt anticipé', detail: 'En déclarant vos dividendes suisses, vous récupérez les 35% retenus à la source.' },
    ],
  },
  {
    quand: 'Jamais (exonéré — investisseur privé)',
    accent: '#2B6B5A',
    items: [{ label: 'Plus-values sur titres', detail: "Les gains en capital réalisés en vendant des actions, ETF ou obligations sont totalement exonérés d'impôt pour un investisseur privé en Suisse." }],
  },
]

function Field({ label, value, onChange, placeholder, hint, hintColor }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder: string; hint?: string; hintColor?: string
}) {
  return (
    <div>
      <label className={LABEL_CLS}>{label}</label>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value.replace(/[^0-9.]/g, ''))}
          placeholder={placeholder}
          className={INPUT_CLS}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-mono text-[#9E9A93]">CHF</span>
      </div>
      {hint && <p className={`text-[11px] mt-1.5 leading-snug ${hintColor ?? 'text-[#9E9A93]'}`}>{hint}</p>}
    </div>
  )
}

function StatRow({ label, value, valueClass, indent = false }: {
  label: string; value: string; valueClass?: string; indent?: boolean
}) {
  return (
    <div className={`flex items-baseline justify-between py-2 border-b border-[#DDD9D1]/50 dark:border-[#1e3347]/70 last:border-0 ${indent ? 'pl-3' : ''}`}>
      <span className="text-sm text-[#5C6880] dark:text-[#A8B8C8] leading-snug pr-4">{label}</span>
      <span className={`text-sm font-mono whitespace-nowrap ${valueClass ?? 'text-[#1B3050] dark:text-[#E8E4DC]'}`}>{value}</span>
    </div>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold tracking-widest uppercase text-[#9E9A93] pt-4 pb-1.5 first:pt-0">{children}</p>
  )
}

const TABS_PRIVE = [
  { key: 'calcul',     label: 'Calcul fiscal' },
  { key: 'calendrier', label: 'Calendrier'     },
  { key: 'plusvalue',  label: 'Plus-values'    },
  { key: 'statut',     label: 'Mon statut'     },
]
const TABS_PRO = [
  { key: 'calcul',     label: 'Calcul fiscal' },
  { key: 'calendrier', label: 'Calendrier'     },
  { key: 'statut',     label: 'Mon statut'     },
]

export default function SimulateurPage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push('/login')
    })
  }, [])

  const [mode, setMode] = useState<'prive' | 'pro'>('prive')
  const [canton, setCanton] = useState('ZH')
  const [cantonOpen, setCantonOpen] = useState(false)
  const cantonRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!cantonOpen) return
    const handler = (e: MouseEvent) => { if (cantonRef.current && !cantonRef.current.contains(e.target as Node)) setCantonOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [cantonOpen])
  const [situation, setSituation] = useState<'seul' | 'marie'>('seul')
  const [activeTab, setActiveTab] = useState<'calcul' | 'calendrier' | 'plusvalue' | 'statut'>('calcul')

  const [revenu,        setRevenu]        = useState('')
  const [dividendesCH,  setDividendesCH]  = useState('')
  const [dividendesETR, setDividendesETR] = useState('')

  const [revenuPro,        setRevenuPro]        = useState('')
  const [gainsCapitaux,    setGainsCapitaux]    = useState('')
  const [pertes,           setPertes]           = useState('')
  const [frais,            setFrais]            = useState('')
  const [dividendesCHPro,  setDividendesCHPro]  = useState('')
  const [dividendesETRPro, setDividendesETRPro] = useState('')

  const marie      = situation === 'marie'
  const cantonData = CANTONS.find(c => c.code === canton) || CANTONS[CANTONS.length - 1]

  const resultsPrive = useMemo(() => {
    const rev           = parseFloat(revenu) || 0
    const divCH         = parseFloat(dividendesCH) || 0
    const divETR        = parseFloat(dividendesETR) || 0
    const divImposables = divCH + divETR
    const impotAnticipe = divCH * 0.35
    const ifdSurDiv     = calcIFD(rev + divImposables, marie) - calcIFD(rev, marie)
    const impotCantonal = divImposables * (cantonData.taux / 100)
    const coutTotal     = ifdSurDiv + impotCantonal
    const tauxEffectif  = divImposables > 0 ? (coutTotal / divImposables) * 100 : 0
    return { rev, divCH, divETR, divImposables, impotAnticipe, ifdSurDiv, impotCantonal, coutTotal, tauxEffectif }
  }, [revenu, dividendesCH, dividendesETR, marie, cantonData])

  const resultsPro = useMemo(() => {
    const rev    = parseFloat(revenuPro) || 0
    const gains  = parseFloat(gainsCapitaux) || 0
    const perts  = parseFloat(pertes) || 0
    const fr     = parseFloat(frais) || 0
    const divCH  = parseFloat(dividendesCHPro) || 0
    const divETR = parseFloat(dividendesETRPro) || 0
    const divImposables = divCH + divETR
    const impotAnticipe = divCH * 0.35
    const gainsNets     = Math.max(0, gains - perts - fr)
    const revenuTotal   = rev + gainsNets + divImposables
    const avs           = gainsNets * AVS_TAUX
    const ifdSurGains   = calcIFD(revenuTotal, marie) - calcIFD(rev, marie)
    const impotCantonal = (gainsNets + divImposables) * (cantonData.taux / 100)
    const coutTotal     = avs + ifdSurGains + impotCantonal
    const tauxEffectif  = (gainsNets + divImposables) > 0 ? (coutTotal / (gainsNets + divImposables)) * 100 : 0
    const coutSiPrive   = calcIFD(rev + divImposables, marie) - calcIFD(rev, marie) + divImposables * (cantonData.taux / 100)
    const surcout       = coutTotal - coutSiPrive
    return { rev, gains, perts, fr, gainsNets, divImposables, impotAnticipe, avs, ifdSurGains, impotCantonal, coutTotal, tauxEffectif, coutSiPrive, surcout }
  }, [revenuPro, gainsCapitaux, pertes, frais, dividendesCHPro, dividendesETRPro, marie, cantonData])

  const hasDataPrive = !!(parseFloat(revenu) || parseFloat(dividendesCH) || parseFloat(dividendesETR))
  const hasDataPro   = !!(parseFloat(revenuPro) || parseFloat(gainsCapitaux) || parseFloat(dividendesCHPro) || parseFloat(dividendesETRPro))

  const tabs = mode === 'prive' ? TABS_PRIVE : TABS_PRO

  function handleModeChange(m: 'prive' | 'pro') {
    setMode(m)
    setActiveTab('calcul')
  }

  return (
    <div className="min-h-screen bg-[#F5F3EF] dark:bg-[#0F1E2C] text-[#1B3050] dark:text-[#E8E4DC]">
      <Header />

      <div className="max-w-6xl mx-auto px-4 py-10">

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold tracking-tight">Simulateur fiscal cantonal</h1>
          </div>
          <p className="text-[#5C6880] text-sm">
            Estimez votre imposition sur vos revenus de placements selon votre canton de résidence — réservé aux résidents suisses.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

          <div className="lg:col-span-2 space-y-4 lg:sticky lg:top-6">

            <div className="grid grid-cols-2 gap-1 p-1 bg-[#F5F3EF] dark:bg-[#1B2D3E] rounded-xl border border-[#DDD9D1] dark:border-transparent">
              {(['prive', 'pro'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => handleModeChange(m)}
                  className={[
                    'py-2.5 px-3 rounded-lg text-[13px] font-medium transition-all',
                    mode === m
                      ? 'bg-white dark:bg-[#0F1E2C] text-[#1B3050] dark:text-[#E8E4DC] shadow-sm border border-[#DDD9D1] dark:border-[#2a3f52]'
                      : 'text-[#9E9A93] hover:text-[#5C6880] dark:hover:text-[#A8B8C8]',
                  ].join(' ')}
                >
                  {m === 'prive' ? '👤 Investisseur privé' : '💼 Trader pro'}
                </button>
              ))}
            </div>

            <div className={`${CARD_CLS} p-5`}>
              <p className="text-[10px] font-semibold tracking-widest uppercase text-[#9E9A93] mb-4">Situation fiscale</p>
              <div className="space-y-4">
                <div>
                  <label className={LABEL_CLS}>Canton de domicile</label>
                  <div className="relative" ref={cantonRef}>
                    <button
                      type="button"
                      onClick={() => setCantonOpen(o => !o)}
                      className={`${INPUT_CLS} flex items-center justify-between text-left`}
                    >
                      <span>{CANTONS.find(c => c.code === canton)?.code} — {CANTONS.find(c => c.code === canton)?.name}</span>
                      <svg className={`w-4 h-4 text-[#9E9A93] flex-shrink-0 transition-transform ${cantonOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
                    </button>
                    {cantonOpen && (
                      <div className="absolute z-50 mt-1 w-full rounded-lg border border-[#DDD9D1] dark:border-[#2a3f52] bg-white dark:bg-[#0F1E2C] shadow-lg overflow-hidden">
                        <div className="max-h-56 overflow-y-auto">
                          {CANTONS.map(c => (
                            <button
                              key={c.code}
                              type="button"
                              onClick={() => { setCanton(c.code); setCantonOpen(false) }}
                              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors
                                ${c.code === canton
                                  ? 'bg-[#2B6B5A]/10 text-[#2B6B5A] font-medium'
                                  : 'text-[#1B3050] dark:text-[#E8E4DC] hover:bg-[#F5F3EF] dark:hover:bg-[#162534]'
                                }`}
                            >
                              <span className="font-mono text-[11px] w-6 flex-shrink-0 text-[#9E9A93]">{c.code}</span>
                              <span>{c.name}</span>
                              <span className="ml-auto text-[11px] text-[#9E9A93]">{c.taux}%</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className={LABEL_CLS}>Situation familiale</label>
                  <div className="grid grid-cols-2 gap-1 p-1 bg-[#F5F3EF] dark:bg-[#1B2D3E] rounded-xl border border-[#DDD9D1] dark:border-transparent">
                    {(['seul', 'marie'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => setSituation(s)}
                        className={[
                          'py-2 px-3 rounded-lg text-[13px] font-medium transition-all',
                          situation === s
                            ? 'bg-white dark:bg-[#0F1E2C] text-[#1B3050] dark:text-[#E8E4DC] shadow-sm border border-[#DDD9D1] dark:border-[#2a3f52]'
                            : 'text-[#9E9A93] hover:text-[#5C6880] dark:hover:text-[#A8B8C8]',
                        ].join(' ')}
                      >
                        {s === 'seul' ? 'Célibataire' : 'Marié(e)'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {mode === 'prive' && (
              <div className={`${CARD_CLS} p-5`}>
                <p className="text-[10px] font-semibold tracking-widest uppercase text-[#9E9A93] mb-4">Revenus</p>
                <div className="space-y-4">
                  <Field label="Revenu imposable (hors investissements)" value={revenu} onChange={setRevenu} placeholder="80 000" />
                  <Field label="Dividendes suisses (brut)" value={dividendesCH} onChange={setDividendesCH} placeholder="2 000"
                    hint="Impôt anticipé 35% prélevé à la source" hintColor="text-[#D97706] dark:text-[#F59E0B]" />
                  <Field label="Dividendes étrangers (ETF, actions)" value={dividendesETR} onChange={setDividendesETR} placeholder="1 500"
                    hint="À déclarer l'année suivante" />
                </div>
              </div>
            )}

            {mode === 'pro' && (
              <>
                <div className={`${CARD_CLS} p-5`}>
                  <p className="text-[10px] font-semibold tracking-widest uppercase text-[#9E9A93] mb-4">Revenus</p>
                  <div className="space-y-4">
                    <Field label="Revenu imposable (hors trading)" value={revenuPro} onChange={setRevenuPro} placeholder="80 000" />
                    <Field label="Dividendes suisses (brut)" value={dividendesCHPro} onChange={setDividendesCHPro} placeholder="2 000"
                      hint="Impôt anticipé 35% prélevé à la source" hintColor="text-[#D97706] dark:text-[#F59E0B]" />
                    <Field label="Dividendes étrangers (ETF, actions)" value={dividendesETRPro} onChange={setDividendesETRPro} placeholder="1 500"
                      hint="À déclarer l'année suivante" />
                  </div>
                </div>

                <div className={`${CARD_CLS} p-5`}>
                  <p className="text-[10px] font-semibold tracking-widest uppercase text-[#9E9A93] mb-4">Activité de trading</p>
                  <div className="space-y-4">
                    <Field label="Gains en capital bruts (plus-values réalisées)" value={gainsCapitaux} onChange={setGainsCapitaux} placeholder="50 000"
                      hint="Total des gains sur ventes de titres dans l'année" />
                    <Field label="Pertes réalisées (déductibles)" value={pertes} onChange={setPertes} placeholder="5 000"
                      hint="Moins-values réalisées — déductibles du bénéfice" hintColor="text-[#2B6B5A] dark:text-[#4A9A85]" />
                    <Field label="Frais professionnels déductibles" value={frais} onChange={setFrais} placeholder="2 000"
                      hint="Courtage, abonnements data, matériel, formation…" hintColor="text-[#2B6B5A] dark:text-[#4A9A85]" />
                  </div>
                  <div className="mt-4 pt-4 border-t border-[#DDD9D1] dark:border-[#1e3347] flex justify-between items-center">
                    <span className="text-[12px] text-[#9E9A93]">Gain net imposable</span>
                    <span className="text-[13px] font-mono font-semibold text-[#1B3050] dark:text-[#E8E4DC]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {fmt(Math.max(0, (parseFloat(gainsCapitaux) || 0) - (parseFloat(pertes) || 0) - (parseFloat(frais) || 0)))}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="lg:col-span-3 space-y-4">

            <div className="flex gap-1 p-1 bg-[#F5F3EF] dark:bg-[#1B2D3E] rounded-xl border border-[#DDD9D1] dark:border-transparent">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={[
                    'flex-1 py-2.5 px-2 rounded-lg text-[12px] font-medium transition-all',
                    activeTab === tab.key
                      ? 'bg-white dark:bg-[#0F1E2C] text-[#1B3050] dark:text-[#E8E4DC] shadow-sm border border-[#DDD9D1] dark:border-[#2a3f52]'
                      : 'text-[#9E9A93] hover:text-[#5C6880] dark:hover:text-[#A8B8C8]',
                  ].join(' ')}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'calcul' && mode === 'prive' && (
              !hasDataPrive ? (
                <div className={`${CARD_CLS} p-12 text-center`}>
                  <div className="text-4xl mb-4 opacity-30">⌗</div>
                  <p className="text-[13px] text-[#9E9A93]">Remplissez les champs à gauche pour obtenir votre estimation fiscale.</p>
                </div>
              ) : (
                <>
                  <div className={`${CARD_CLS} p-6`}>
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <p className="text-[11px] font-medium tracking-widest uppercase text-[#9E9A93] mb-1">Charge fiscale estimée</p>
                        <p className="text-[32px] font-semibold font-mono leading-none tracking-tight text-[#1B3050] dark:text-[#E8E4DC]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {fmt(resultsPrive.coutTotal)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] text-[#9E9A93] mb-1">Taux effectif dividendes</p>
                        <p className="text-[26px] font-semibold font-mono text-[#5C6880] dark:text-[#A8B8C8]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {resultsPrive.tauxEffectif.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    {resultsPrive.coutTotal > 0 && (
                      <div className="space-y-3">
                        {[
                          { label: `Cantonal ${canton} (${cantonData.taux}%)`, val: resultsPrive.impotCantonal, color: '#1B3050' },
                          { label: 'IFD fédéral', val: resultsPrive.ifdSurDiv, color: '#2B6B5A' },
                        ].filter(i => i.val > 0).map(item => (
                          <div key={item.label}>
                            <div className="flex justify-between text-[12px] mb-1.5">
                              <span className="text-[#5C6880] dark:text-[#A8B8C8]">{item.label}</span>
                              <span className="font-mono font-medium text-[#1B3050] dark:text-[#E8E4DC]" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(item.val)}</span>
                            </div>
                            <div className="h-1 rounded-full bg-[#DDD9D1] dark:bg-[#1e3347]">
                              <div className="h-1 rounded-full transition-all" style={{ width: `${(item.val / resultsPrive.coutTotal) * 100}%`, backgroundColor: item.color }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className={`${CARD_CLS} p-6`}>
                    <p className="text-[13px] font-semibold text-[#1B3050] dark:text-[#E8E4DC] mb-4">Détail du calcul</p>
                    {resultsPrive.divImposables > 0 && (
                      <>
                        <SectionHeader>Impôt sur les dividendes</SectionHeader>
                        <StatRow label="Dividendes imposables" value={fmt(resultsPrive.divImposables)} />
                        {resultsPrive.ifdSurDiv > 0 && (
                          <StatRow label="IFD fédéral (taux marginal)" value={`−${fmt(resultsPrive.ifdSurDiv)}`} valueClass="font-mono text-[#EF4444] dark:text-[#F87171]" indent />
                        )}
                        <StatRow label={`Cantonal ${canton} (${cantonData.taux}%)`} value={`−${fmt(resultsPrive.impotCantonal)}`} valueClass="font-mono text-[#EF4444] dark:text-[#F87171]" indent />
                      </>
                    )}
                    {resultsPrive.impotAnticipe > 0 && (
                      <>
                        <SectionHeader>Impôt anticipé (35%)</SectionHeader>
                        <StatRow label="Retenu à la source (immédiat)" value={`−${fmt(resultsPrive.impotAnticipe)}`} valueClass="font-mono text-[#EF4444] dark:text-[#F87171]" indent />
                        <StatRow label="Remboursé l'année suivante ✓" value={`+${fmt(resultsPrive.impotAnticipe)}`} valueClass="font-mono text-[#2B6B5A]" indent />
                        <p className="text-[11px] text-[#9E9A93] italic pl-3 mb-1">Impact net = 0 CHF</p>
                      </>
                    )}
                    <div className="mt-3 pt-3 border-t border-[#DDD9D1] dark:border-[#1e3347] flex justify-between items-center">
                      <span className="text-[13px] font-semibold text-[#1B3050] dark:text-[#E8E4DC]">Charge fiscale totale</span>
                      <span className="text-[13px] font-mono font-bold text-[#EF4444] dark:text-[#F87171]" style={{ fontVariantNumeric: 'tabular-nums' }}>−{fmt(resultsPrive.coutTotal)}</span>
                    </div>
                  </div>
                </>
              )
            )}

            {activeTab === 'calcul' && mode === 'pro' && (
              !hasDataPro ? (
                <div className={`${CARD_CLS} p-12 text-center`}>
                  <div className="text-4xl mb-4 opacity-30">⌗</div>
                  <p className="text-[13px] text-[#9E9A93]">Remplissez les champs à gauche pour estimer votre charge en tant que trader professionnel.</p>
                </div>
              ) : (
                <>
                  <div className={`${CARD_CLS} p-6`}>
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <p className="text-[11px] font-medium tracking-widest uppercase text-[#9E9A93] mb-1">Charge fiscale estimée</p>
                        <p className="text-[32px] font-semibold font-mono leading-none tracking-tight text-[#1B3050] dark:text-[#E8E4DC]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {fmt(resultsPro.coutTotal)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] text-[#9E9A93] mb-1">Taux effectif gains + dividendes</p>
                        <p className="text-[26px] font-semibold font-mono text-[#EF4444] dark:text-[#F87171]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {resultsPro.tauxEffectif.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    {resultsPro.coutTotal > 0 && (
                      <div className="space-y-3">
                        {[
                          { label: `AVS/AI/APG (${(AVS_TAUX * 100).toFixed(1)}% gains nets)`, val: resultsPro.avs, color: '#EF4444' },
                          { label: `Cantonal ${canton} (${cantonData.taux}%)`, val: resultsPro.impotCantonal, color: '#1B3050' },
                          { label: 'IFD fédéral', val: resultsPro.ifdSurGains, color: '#2B6B5A' },
                        ].filter(i => i.val > 0).map(item => (
                          <div key={item.label}>
                            <div className="flex justify-between text-[12px] mb-1.5">
                              <span className="text-[#5C6880] dark:text-[#A8B8C8]">{item.label}</span>
                              <span className="font-mono font-medium text-[#1B3050] dark:text-[#E8E4DC]" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(item.val)}</span>
                            </div>
                            <div className="h-1 rounded-full bg-[#DDD9D1] dark:bg-[#1e3347]">
                              <div className="h-1 rounded-full transition-all" style={{ width: `${(item.val / resultsPro.coutTotal) * 100}%`, backgroundColor: item.color }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className={`${CARD_CLS} p-6`}>
                    <p className="text-[13px] font-semibold text-[#1B3050] dark:text-[#E8E4DC] mb-4">Détail du calcul</p>
                    <SectionHeader>Activité de trading</SectionHeader>
                    <StatRow label="Gains en capital bruts" value={fmt(resultsPro.gains)} />
                    {resultsPro.perts > 0 && <StatRow label="Pertes déductibles" value={`−${fmt(resultsPro.perts)}`} valueClass="font-mono text-[#2B6B5A]" indent />}
                    {resultsPro.fr > 0    && <StatRow label="Frais professionnels" value={`−${fmt(resultsPro.fr)}`} valueClass="font-mono text-[#2B6B5A]" indent />}
                    <StatRow label="Gain net imposable" value={fmt(resultsPro.gainsNets)} valueClass="font-mono font-semibold text-[#1B3050] dark:text-[#E8E4DC]" />
                    {resultsPro.avs > 0 && (
                      <>
                        <SectionHeader>Cotisations sociales</SectionHeader>
                        <StatRow label={`AVS/AI/APG (${(AVS_TAUX * 100).toFixed(1)}% sur gain net)`} value={`−${fmt(resultsPro.avs)}`} valueClass="font-mono text-[#EF4444] dark:text-[#F87171]" indent />
                      </>
                    )}
                    {(resultsPro.ifdSurGains > 0 || resultsPro.impotCantonal > 0) && (
                      <>
                        <SectionHeader>Impôt sur le revenu</SectionHeader>
                        {resultsPro.ifdSurGains > 0 && (
                          <StatRow label="IFD fédéral (taux marginal)" value={`−${fmt(resultsPro.ifdSurGains)}`} valueClass="font-mono text-[#EF4444] dark:text-[#F87171]" indent />
                        )}
                        <StatRow label={`Cantonal ${canton} (${cantonData.taux}%)`} value={`−${fmt(resultsPro.impotCantonal)}`} valueClass="font-mono text-[#EF4444] dark:text-[#F87171]" indent />
                      </>
                    )}
                    {resultsPro.impotAnticipe > 0 && (
                      <>
                        <SectionHeader>Impôt anticipé (35%)</SectionHeader>
                        <StatRow label="Retenu à la source" value={`−${fmt(resultsPro.impotAnticipe)}`} valueClass="font-mono text-[#EF4444] dark:text-[#F87171]" indent />
                        <StatRow label="Remboursé l'année suivante ✓" value={`+${fmt(resultsPro.impotAnticipe)}`} valueClass="font-mono text-[#2B6B5A]" indent />
                      </>
                    )}
                    <div className="mt-3 pt-3 border-t border-[#DDD9D1] dark:border-[#1e3347] flex justify-between items-center">
                      <span className="text-[13px] font-semibold text-[#1B3050] dark:text-[#E8E4DC]">Charge fiscale totale</span>
                      <span className="text-[13px] font-mono font-bold text-[#EF4444] dark:text-[#F87171]" style={{ fontVariantNumeric: 'tabular-nums' }}>−{fmt(resultsPro.coutTotal)}</span>
                    </div>
                  </div>

                  {resultsPro.gainsNets > 0 && (
                    <div className="rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] bg-[#F5F3EF] dark:bg-[#162534]/50 p-6">
                      <p className="text-[13px] font-semibold text-[#1B3050] dark:text-[#E8E4DC] mb-4">⚖️ Comparaison avec le statut investisseur privé</p>
                      <div className="space-y-2.5">
                        <div className="flex justify-between text-[13px]">
                          <span className="text-[#5C6880] dark:text-[#A8B8C8]">Si investisseur privé (dividendes uniquement)</span>
                          <span className="font-mono text-[#5C6880] dark:text-[#A8B8C8]" style={{ fontVariantNumeric: 'tabular-nums' }}>−{fmt(resultsPro.coutSiPrive)}</span>
                        </div>
                        <div className="flex justify-between text-[13px] font-semibold">
                          <span className="text-[#EF4444] dark:text-[#F87171]">Surcoût lié au statut professionnel</span>
                          <span className="font-mono text-[#EF4444] dark:text-[#F87171]" style={{ fontVariantNumeric: 'tabular-nums' }}>−{fmt(resultsPro.surcout)}</span>
                        </div>
                        <div className="flex justify-between text-[13px]">
                          <span className="text-[#5C6880] dark:text-[#A8B8C8]">dont AVS/AI/APG (non récupérables)</span>
                          <span className="font-mono text-[#EF4444] dark:text-[#F87171]" style={{ fontVariantNumeric: 'tabular-nums' }}>−{fmt(resultsPro.avs)}</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-[#9E9A93] mt-4 leading-relaxed">
                        Les plus-values exonérées en tant qu&apos;investisseur privé ({fmt(resultsPro.gainsNets)}) sont ici imposées comme revenu professionnel.
                      </p>
                    </div>
                  )}
                </>
              )
            )}

            {activeTab === 'calendrier' && (
              <div className="space-y-3">
                {CALENDRIER.map(section => (
                  <div key={section.quand} className={`${CARD_CLS} overflow-hidden`}>
                    <div className="px-5 py-3 border-b border-[#DDD9D1] dark:border-[#1e3347]" style={{ borderLeftWidth: 3, borderLeftColor: section.accent, borderLeftStyle: 'solid' }}>
                      <p className="text-[11px] font-semibold tracking-wide" style={{ color: section.accent }}>{section.quand.toUpperCase()}</p>
                    </div>
                    <div className="divide-y divide-[#DDD9D1]/50 dark:divide-[#1e3347]/70">
                      {section.items.map(item => (
                        <div key={item.label} className="px-5 py-4">
                          <p className="text-[13px] font-semibold text-[#1B3050] dark:text-[#E8E4DC] mb-1.5">{item.label}</p>
                          <p className="text-[13px] text-[#5C6880] dark:text-[#A8B8C8] leading-relaxed">{item.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <p className="text-[11px] text-[#9E9A93] px-1">⚠️ Les délais de déclaration varient selon les cantons.</p>
              </div>
            )}

            {activeTab === 'plusvalue' && mode === 'prive' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-[#2B6B5A]/25 bg-[#2B6B5A]/5 dark:bg-[#2B6B5A]/10 p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-[#2B6B5A]/15 flex items-center justify-center text-lg">🎉</div>
                    <h3 className="text-[15px] font-semibold text-[#2B6B5A]">Plus-values exonérées en Suisse</h3>
                  </div>
                  <p className="text-[13px] text-[#5C6880] dark:text-[#A8B8C8] leading-relaxed">
                    En tant qu&apos;investisseur privé, vos gains en capital sont <strong className="text-[#2B6B5A]">totalement exonérés d&apos;impôt</strong>, que vous vendiez après 1 mois ou 20 ans.
                  </p>
                </div>
                <div className={`${CARD_CLS} p-6`}>
                  <p className="text-[13px] font-semibold text-[#1B3050] dark:text-[#E8E4DC] mb-4">Exemples concrets</p>
                  <div className="space-y-0">
                    {[
                      { actif: 'Action Nestlé',  achat: '100 CHF',    vente: '150 CHF',    gain: '+50 CHF'    },
                      { actif: 'ETF MSCI World', achat: '10 000 CHF', vente: '18 000 CHF', gain: '+8 000 CHF' },
                      { actif: 'Bitcoin (ETF)',  achat: '5 000 CHF',  vente: '12 000 CHF', gain: '+7 000 CHF' },
                    ].map((ex, i, arr) => (
                      <div key={ex.actif} className={`flex items-center justify-between py-3.5 ${i < arr.length - 1 ? 'border-b border-[#DDD9D1]/50 dark:border-[#1e3347]/70' : ''}`}>
                        <div>
                          <p className="text-[13px] font-medium text-[#1B3050] dark:text-[#E8E4DC]">{ex.actif}</p>
                          <p className="text-[11px] text-[#9E9A93] mt-0.5 font-mono">
                            {ex.achat} → {ex.vente} = <span className="text-[#2B6B5A]">{ex.gain}</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] text-[#9E9A93]">Impôt dû</p>
                          <p className="text-[13px] font-mono font-bold text-[#2B6B5A]">0 CHF</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'statut' && (() => {
              const CardPrive = ({ current }: { current: boolean }) => (
                <div className={`${CARD_CLS} overflow-hidden transition-all ${current ? 'ring-1 ring-[#2B6B5A]/40' : 'opacity-60'}`}>
                  <div className="px-5 py-3 border-b border-[#DDD9D1] dark:border-[#1e3347] flex items-center gap-2.5 flex-wrap" style={{ borderLeftWidth: 3, borderLeftColor: '#2B6B5A', borderLeftStyle: 'solid' }}>
                    <span className="text-base">👤</span>
                    <h3 className="text-[13px] font-semibold text-[#1B3050] dark:text-[#E8E4DC]">Investisseur privé</h3>
                    {current
                      ? <span className="ml-auto text-[11px] font-semibold text-white bg-[#2B6B5A] px-2.5 py-0.5 rounded-full">✓ Votre statut</span>
                      : <span className="ml-auto text-[11px] font-medium text-[#2B6B5A] border border-[#2B6B5A]/30 px-2 py-0.5 rounded-full">Régime par défaut</span>
                    }
                  </div>
                  <div className="p-5 space-y-5">
                    <div>
                      <p className="text-[10px] font-semibold tracking-widest uppercase text-[#9E9A93] mb-3">Critères typiques</p>
                      <ul className="space-y-2">
                        {[
                          "Vous investissez votre propre épargne, sans emprunt",
                          "Vous conservez vos titres plusieurs mois ou années",
                          "Vos revenus principaux viennent d'un salaire ou d'une autre activité",
                          "Vous effectuez un nombre limité de transactions par an",
                          "Les revenus du trading restent minoritaires dans votre revenu total",
                        ].map(c => (
                          <li key={c} className="flex items-start gap-2 text-[13px] text-[#5C6880] dark:text-[#A8B8C8]">
                            <span className="text-[#2B6B5A] mt-0.5 shrink-0 text-[11px]">✓</span>
                            {c}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="pt-4 border-t border-[#DDD9D1] dark:border-[#1e3347]">
                      <p className="text-[10px] font-semibold tracking-widest uppercase text-[#9E9A93] mb-3">Ce que vous payez</p>
                      <div className="space-y-2">
                        <div className="flex justify-between text-[13px]">
                          <span className="text-[#5C6880] dark:text-[#A8B8C8]">Plus-values (vente de titres)</span>
                          <span className="font-mono font-semibold text-[#2B6B5A]">0% — exonéré</span>
                        </div>
                        <div className="flex justify-between text-[13px]">
                          <span className="text-[#5C6880] dark:text-[#A8B8C8]">Dividendes</span>
                          <span className="font-mono font-semibold text-[#5C6880] dark:text-[#A8B8C8]">IFD + cantonal</span>
                        </div>
                        <div className="flex justify-between text-[13px]">
                          <span className="text-[#5C6880] dark:text-[#A8B8C8]">Cotisations AVS/AI</span>
                          <span className="font-mono font-semibold text-[#2B6B5A]">Aucune</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )

              const CardPro = ({ current }: { current: boolean }) => (
                <div className={`${CARD_CLS} overflow-hidden transition-all ${current ? 'ring-1 ring-[#EF4444]/40' : 'opacity-60'}`}>
                  <div className="px-5 py-3 border-b border-[#DDD9D1] dark:border-[#1e3347] flex items-center gap-2.5 flex-wrap" style={{ borderLeftWidth: 3, borderLeftColor: '#EF4444', borderLeftStyle: 'solid' }}>
                    <span className="text-base">💼</span>
                    <h3 className="text-[13px] font-semibold text-[#1B3050] dark:text-[#E8E4DC]">Trader professionnel</h3>
                    {current
                      ? <span className="ml-auto text-[11px] font-semibold text-white bg-[#EF4444] px-2.5 py-0.5 rounded-full">✓ Votre statut</span>
                      : <span className="ml-auto text-[11px] font-medium text-[#EF4444] border border-[#EF4444]/30 px-2 py-0.5 rounded-full">Requalification fiscale</span>
                    }
                  </div>
                  <div className="p-5 space-y-5">
                    <div>
                      <p className="text-[10px] font-semibold tracking-widest uppercase text-[#9E9A93] mb-3">Critères de requalification (faisceau d&apos;indices)</p>
                      <ul className="space-y-2">
                        {[
                          { texte: "Volume de transactions > 5× la valeur du portefeuille par an", risque: 'élevé' },
                          { texte: "Recours à un levier ou à un crédit pour investir", risque: 'élevé' },
                          { texte: "Durée moyenne de détention inférieure à 6 mois", risque: 'élevé' },
                          { texte: "Revenus du trading > 50% de vos revenus totaux", risque: 'élevé' },
                          { texte: "Plus de 100–200 transactions par an", risque: 'moyen' },
                        ].map(c => (
                          <li key={c.texte} className="flex items-start gap-2 text-[13px] text-[#5C6880] dark:text-[#A8B8C8]">
                            <span className={`mt-0.5 shrink-0 text-[11px] ${c.risque === 'élevé' ? 'text-[#EF4444]' : 'text-[#D97706]'}`}>⚠</span>
                            {c.texte}
                          </li>
                        ))}
                      </ul>
                      <p className="text-[11px] text-[#9E9A93] mt-3 leading-snug">
                        Aucun critère n&apos;est décisif seul — c&apos;est leur combinaison que le fisc apprécie au cas par cas.
                      </p>
                    </div>
                    <div className="pt-4 border-t border-[#DDD9D1] dark:border-[#1e3347]">
                      <p className="text-[10px] font-semibold tracking-widest uppercase text-[#9E9A93] mb-3">Ce que vous payez en plus</p>
                      <div className="space-y-2">
                        <div className="flex justify-between text-[13px]">
                          <span className="text-[#5C6880] dark:text-[#A8B8C8]">Plus-values (vente de titres)</span>
                          <span className="font-mono font-semibold text-[#EF4444] dark:text-[#F87171]">IFD + cantonal</span>
                        </div>
                        <div className="flex justify-between text-[13px]">
                          <span className="text-[#5C6880] dark:text-[#A8B8C8]">Cotisations AVS/AI/APG</span>
                          <span className="font-mono font-semibold text-[#EF4444] dark:text-[#F87171]">≈ 10.6% sur gains nets</span>
                        </div>
                        <div className="flex justify-between text-[13px]">
                          <span className="text-[#5C6880] dark:text-[#A8B8C8]">Pertes & frais pro</span>
                          <span className="font-mono font-semibold text-[#2B6B5A]">Déductibles</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )

              return (
                <div className="space-y-4">
                  {mode === 'prive'
                    ? <><CardPrive current={true} /><CardPro current={false} /></>
                    : <><CardPro current={true} /><CardPrive current={false} /></>
                  }
                  <div className="rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] bg-[#F5F3EF] dark:bg-[#162534]/50 p-5">
                    <p className="text-[12px] text-[#5C6880] dark:text-[#A8B8C8] leading-relaxed">
                      <strong className="text-[#1B3050] dark:text-[#E8E4DC]">En cas de doute</strong>, consultez votre administration fiscale cantonale ou un conseiller fiscal avant de déclarer. La requalification peut s&apos;appliquer rétroactivement sur les 5 dernières années.
                    </p>
                  </div>
                </div>
              )
            })()}

            <p className="text-[11px] text-[#9E9A93] px-1">
              ⚠️ Estimation indicative basée sur les barèmes IFD 2024. Consultez un conseiller fiscal pour votre situation précise.
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
