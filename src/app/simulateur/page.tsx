'use client'
import Footer from '@/components/Footer'
import Header from '@/components/Header'

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

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

const INPUT_CLS = 'w-full bg-[#F5F3EF] dark:bg-[#0F1E2C] border border-[#DDD9D1] dark:border-[#1e3347] rounded-lg px-4 py-2.5 text-sm text-[#1B3050] dark:text-[#E8E4DC] focus:outline-none focus:ring-2 focus:ring-[#1B3050] dark:focus:ring-[#7B8DA6] placeholder-[#9E9A93]'
const LABEL_CLS = 'block text-xs font-medium text-[#5C6880] dark:text-[#7B8DA6] mb-1.5'
const CARD_CLS  = 'bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347]'

// ── Field défini HORS du composant pour éviter le remontage à chaque frappe ──
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
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#9E9A93]">CHF</span>
      </div>
      {hint && <p className={`text-xs mt-1 ${hintColor ?? 'text-[#9E9A93]'}`}>{hint}</p>}
    </div>
  )
}

const CALENDRIER = [
  {
    quand: 'Dès réception du dividende',
    bg: 'bg-[#FDF6E3] dark:bg-amber-900/20', text: 'text-[#B5820F] dark:text-amber-400',
    items: [{ label: 'Impôt anticipé (35%)', detail: 'Prélevé à la source sur les dividendes suisses. Votre courtier vous verse 65% du dividende. Les 35% sont récupérés l\'année suivante.' }],
  },
  {
    quand: 'L\'année suivante (déclaration fiscale)',
    bg: 'bg-teal-50 dark:bg-teal-900/20', text: 'text-teal-700 dark:text-teal-400',
    items: [
      { label: 'IFD + impôt cantonal sur dividendes', detail: 'Déclarez tous vos dividendes (CH et étrangers) dans votre déclaration fiscale annuelle. L\'impôt est calculé et facturé l\'année suivante.' },
      { label: 'Remboursement impôt anticipé', detail: 'En déclarant vos dividendes suisses, vous récupérez les 35% retenus à la source.' },
    ],
  },
  {
    quand: 'Jamais (exonéré — investisseur privé)',
    bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-400',
    items: [{ label: 'Plus-values sur titres', detail: 'Les gains en capital réalisés en vendant des actions, ETF ou obligations sont totalement exonérés d\'impôt pour un investisseur privé en Suisse.' }],
  },
]

export default function SimulateurPage() {
  const [mode, setMode] = useState<'prive' | 'pro'>('prive')
  const [canton, setCanton] = useState('ZH')
  const [situation, setSituation] = useState<'seul' | 'marie'>('seul')
  const [activeTab, setActiveTab] = useState<'calcul' | 'calendrier' | 'plusvalue' | 'statut'>('calcul')

  // Privé
  const [revenu,       setRevenu]       = useState('')
  const [dividendesCH, setDividendesCH] = useState('')
  const [dividendesETR,setDividendesETR]= useState('')

  // Pro
  const [revenuPro,       setRevenuPro]       = useState('')
  const [gainsCapitaux,   setGainsCapitaux]   = useState('')
  const [pertes,          setPertes]          = useState('')
  const [frais,           setFrais]           = useState('')
  const [dividendesCHPro, setDividendesCHPro] = useState('')
  const [dividendesETRPro,setDividendesETRPro]= useState('')

  const [userId, setUserId] = useState<string | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Chargement initial depuis Supabase ──────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id ?? null
      setUserId(uid)
      if (!uid) return
      const { data: prefs } = await supabase
        .from('simulateur_preferences')
        .select('*')
        .eq('user_id', uid)
        .single()
      if (prefs) {
        if (prefs.mode) setMode(prefs.mode)
        if (prefs.canton) setCanton(prefs.canton)
        if (prefs.situation) setSituation(prefs.situation)
        if (prefs.revenu != null) setRevenu(prefs.revenu)
        if (prefs.dividendes_ch != null) setDividendesCH(prefs.dividendes_ch)
        if (prefs.dividendes_etr != null) setDividendesETR(prefs.dividendes_etr)
        if (prefs.revenu_pro != null) setRevenuPro(prefs.revenu_pro)
        if (prefs.gains_capitaux != null) setGainsCapitaux(prefs.gains_capitaux)
        if (prefs.pertes != null) setPertes(prefs.pertes)
        if (prefs.frais != null) setFrais(prefs.frais)
        if (prefs.dividendes_ch_pro != null) setDividendesCHPro(prefs.dividendes_ch_pro)
        if (prefs.dividendes_etr_pro != null) setDividendesETRPro(prefs.dividendes_etr_pro)
      }
    })
  }, [])

  // ── Sauvegarde automatique (debounce 800ms) ─────────────────────────────────
  useEffect(() => {
    if (!userId) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      const supabase = createClient()
      await supabase.from('simulateur_preferences').upsert({
        user_id: userId,
        mode, canton, situation,
        revenu, dividendes_ch: dividendesCH, dividendes_etr: dividendesETR,
        revenu_pro: revenuPro, gains_capitaux: gainsCapitaux,
        pertes, frais,
        dividendes_ch_pro: dividendesCHPro, dividendes_etr_pro: dividendesETRPro,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
    }, 800)
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [userId, mode, canton, situation, revenu, dividendesCH, dividendesETR,
      revenuPro, gainsCapitaux, pertes, frais, dividendesCHPro, dividendesETRPro])

  const marie      = situation === 'marie'
  const cantonData = CANTONS.find(c => c.code === canton) || CANTONS[CANTONS.length - 1]

  const resultsPrive = useMemo(() => {
    const rev = parseFloat(revenu) || 0
    const divCH = parseFloat(dividendesCH) || 0
    const divETR = parseFloat(dividendesETR) || 0
    const divImposables = divCH + divETR
    const impotAnticipe = divCH * 0.35
    const ifdSurDiv = calcIFD(rev + divImposables, marie) - calcIFD(rev, marie)
    const impotCantonal = divImposables * (cantonData.taux / 100)
    const coutTotal = ifdSurDiv + impotCantonal
    const tauxEffectif = divImposables > 0 ? (coutTotal / divImposables) * 100 : 0
    return { rev, divCH, divETR, divImposables, impotAnticipe, ifdSurDiv, impotCantonal, coutTotal, tauxEffectif }
  }, [revenu, dividendesCH, dividendesETR, marie, cantonData])

  const resultsPro = useMemo(() => {
    const rev   = parseFloat(revenuPro) || 0
    const gains = parseFloat(gainsCapitaux) || 0
    const perts = parseFloat(pertes) || 0
    const fr    = parseFloat(frais) || 0
    const divCH = parseFloat(dividendesCHPro) || 0
    const divETR= parseFloat(dividendesETRPro) || 0
    const divImposables = divCH + divETR
    const impotAnticipe = divCH * 0.35
    const gainsNets = Math.max(0, gains - perts - fr)
    const revenuTotal = rev + gainsNets + divImposables
    const avs = gainsNets * AVS_TAUX
    const ifdSurGains = calcIFD(revenuTotal, marie) - calcIFD(rev, marie)
    const impotCantonal = (gainsNets + divImposables) * (cantonData.taux / 100)
    const coutTotal = avs + ifdSurGains + impotCantonal
    const tauxEffectif = (gainsNets + divImposables) > 0 ? (coutTotal / (gainsNets + divImposables)) * 100 : 0
    const coutSiPrive = calcIFD(rev + divImposables, marie) - calcIFD(rev, marie) + divImposables * (cantonData.taux / 100)
    const surcout = coutTotal - coutSiPrive
    return { rev, gains, perts, fr, gainsNets, divImposables, impotAnticipe, avs, ifdSurGains, impotCantonal, coutTotal, tauxEffectif, coutSiPrive, surcout }
  }, [revenuPro, gainsCapitaux, pertes, frais, dividendesCHPro, dividendesETRPro, marie, cantonData])

  const hasDataPrive = !!(parseFloat(revenu) || parseFloat(dividendesCH) || parseFloat(dividendesETR))
  const hasDataPro   = !!(parseFloat(revenuPro) || parseFloat(gainsCapitaux) || parseFloat(dividendesCHPro) || parseFloat(dividendesETRPro))

  const TABS_PRIVE = [
    { key: 'calcul',    label: 'Calcul fiscal' },
    { key: 'calendrier',label: 'Quand payer ?' },
    { key: 'plusvalue', label: 'Plus-values'   },
    { key: 'statut',    label: 'Mon statut'    },
  ]
  const TABS_PRO = [
    { key: 'calcul',    label: 'Calcul fiscal' },
    { key: 'calendrier',label: 'Quand payer ?' },
    { key: 'statut',    label: 'Mon statut'    },
  ]
  const tabs = mode === 'prive' ? TABS_PRIVE : TABS_PRO

  return (
    <div className="min-h-screen bg-[#F5F3EF] dark:bg-[#0F1E2C] text-[#1B3050] dark:text-[#E8E4DC]">
      <Header />

      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold tracking-tight">Simulateur fiscal cantonal</h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#B5820F]/10 text-[#B5820F] border border-[#B5820F]/20">Premium</span>
          </div>
          <p className="text-[#5C6880] dark:text-[#7B8DA6] text-sm">Estimez votre charge fiscale sur vos revenus de placements — impôt anticipé, IFD et impôt cantonal.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
          {/* ── FORMULAIRE ── */}
          <div className="lg:col-span-2 space-y-5 lg:sticky lg:top-6">

            {/* Toggle mode */}
            <div className={`inline-flex gap-1 ${CARD_CLS} p-1 w-full`}>
              {(['prive', 'pro'] as const).map(m => (
                <button key={m} onClick={() => { setMode(m); setActiveTab('calcul') }}
                  className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${mode === m ? 'bg-[#2B6B5A] text-white shadow-sm' : 'text-[#9E9A93] hover:text-[#5C6880]'}`}>
                  {m === 'prive' ? '👤 Investisseur privé' : '💼 Trader pro'}
                </button>
              ))}
            </div>

            {/* Situation fiscale */}
            <div className={`${CARD_CLS} p-5`}>
              <h2 className="text-xs font-semibold text-[#9E9A93] uppercase tracking-wider mb-4">Situation fiscale</h2>
              <div className="space-y-3">
                <div>
                  <label className={LABEL_CLS}>Canton de domicile</label>
                  <select value={canton} onChange={e => setCanton(e.target.value)} className={INPUT_CLS}>
                    {CANTONS.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLS}>Situation</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['seul', 'marie'] as const).map(s => (
                      <button key={s} onClick={() => setSituation(s)}
                        className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${situation === s ? 'bg-[#2B6B5A] text-white border-[#2B6B5A]' : 'text-[#5C6880] dark:text-[#7B8DA6] border-[#DDD9D1] dark:border-[#1e3347] hover:border-[#2B6B5A]'}`}>
                        {s === 'seul' ? 'Célibataire' : 'Marié(e)'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {mode === 'prive' && (
              <div className={`${CARD_CLS} p-5`}>
                <h2 className="text-xs font-semibold text-[#9E9A93] uppercase tracking-wider mb-4">Revenus</h2>
                <div className="space-y-3">
                  <Field label="Revenu imposable (hors investissements)" value={revenu} onChange={setRevenu} placeholder="80 000" />
                  <Field label="Dividendes suisses (brut)" value={dividendesCH} onChange={setDividendesCH} placeholder="2 000"
                    hint="⏱ Impôt anticipé 35% prélevé à la source" hintColor="text-[#B5820F]" />
                  <Field label="Dividendes étrangers (ETF, actions)" value={dividendesETR} onChange={setDividendesETR} placeholder="1 500"
                    hint="⏱ À déclarer l'année suivante" />
                </div>
              </div>
            )}

            {mode === 'pro' && (
              <>
                <div className={`${CARD_CLS} p-5`}>
                  <h2 className="text-xs font-semibold text-[#9E9A93] uppercase tracking-wider mb-4">Revenus</h2>
                  <div className="space-y-3">
                    <Field label="Revenu imposable (hors trading)" value={revenuPro} onChange={setRevenuPro} placeholder="80 000" />
                    <Field label="Dividendes suisses (brut)" value={dividendesCHPro} onChange={setDividendesCHPro} placeholder="2 000"
                      hint="⏱ Impôt anticipé 35% prélevé à la source" hintColor="text-[#B5820F]" />
                    <Field label="Dividendes étrangers (ETF, actions)" value={dividendesETRPro} onChange={setDividendesETRPro} placeholder="1 500"
                      hint="⏱ À déclarer l'année suivante" />
                  </div>
                </div>
                <div className={`${CARD_CLS} p-5`}>
                  <h2 className="text-xs font-semibold text-[#9E9A93] uppercase tracking-wider mb-4">Activité de trading</h2>
                  <div className="space-y-3">
                    <Field label="Gains en capital bruts (plus-values réalisées)" value={gainsCapitaux} onChange={setGainsCapitaux} placeholder="50 000"
                      hint="Total des gains sur ventes de titres dans l'année" />
                    <Field label="Pertes réalisées (déductibles)" value={pertes} onChange={setPertes} placeholder="5 000"
                      hint="Moins-values réalisées — déductibles du bénéfice" hintColor="text-green-500" />
                    <Field label="Frais professionnels déductibles" value={frais} onChange={setFrais} placeholder="2 000"
                      hint="Courtage, abonnements data, matériel, formation…" hintColor="text-green-500" />
                  </div>
                  <div className="mt-4 pt-4 border-t border-[#DDD9D1] dark:border-[#1e3347] flex justify-between text-xs text-[#5C6880] dark:text-[#7B8DA6]">
                    <span>Gain net imposable</span>
                    <span className="font-mono font-semibold text-[#1B3050] dark:text-[#E8E4DC]">
                      {fmt(Math.max(0, (parseFloat(gainsCapitaux)||0)-(parseFloat(pertes)||0)-(parseFloat(frais)||0)))}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── RÉSULTATS ── */}
          <div className="lg:col-span-3 space-y-5">

            <div className={`flex gap-1 ${CARD_CLS} p-1`}>
              {tabs.map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-colors ${activeTab === tab.key ? 'bg-[#2B6B5A] text-white shadow-sm' : 'text-[#9E9A93] hover:text-[#5C6880] dark:hover:text-[#7B8DA6]'}`}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ─── CALCUL PRIVÉ ─── */}
            {activeTab === 'calcul' && mode === 'prive' && (
              !hasDataPrive ? (
                <div className={`${CARD_CLS} p-10 text-center`}>
                  <div className="text-4xl mb-3">🧮</div>
                  <p className="text-[#9E9A93] text-sm">Remplissez les champs à gauche pour obtenir votre estimation fiscale.</p>
                </div>
              ) : (
                <>
                  <div className={`${CARD_CLS} p-6`}>
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <p className="text-xs font-semibold text-[#9E9A93] uppercase tracking-wider mb-1">Charge fiscale estimée</p>
                        <p className="text-3xl font-bold">{fmt(resultsPrive.coutTotal)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-[#9E9A93] mb-1">Taux effectif sur dividendes</p>
                        <p className="text-2xl font-bold text-[#B5820F]">{resultsPrive.tauxEffectif.toFixed(1)}%</p>
                      </div>
                    </div>
                    {resultsPrive.coutTotal > 0 && (
                      <div className="space-y-2">
                        {[
                          { label: `Impôt cantonal ${canton} (${cantonData.taux}%)`, val: resultsPrive.impotCantonal, color: '#1B3050' },
                          { label: 'IFD fédéral', val: resultsPrive.ifdSurDiv, color: '#B5820F' },
                        ].filter(i => i.val > 0).map(item => (
                          <div key={item.label}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-[#5C6880] dark:text-[#7B8DA6]">{item.label}</span>
                              <span className="font-mono font-medium">{fmt(item.val)}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-[#F5F3EF] dark:bg-[#0F1E2C]">
                              <div className="h-1.5 rounded-full" style={{ width: `${(item.val/resultsPrive.coutTotal)*100}%`, backgroundColor: item.color }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className={`${CARD_CLS} p-6`}>
                    <h3 className="text-sm font-semibold mb-4">Détail du calcul</h3>
                    <table className="w-full text-sm">
                      <tbody>
                        {resultsPrive.divImposables > 0 && (
                          <>
                            <tr><td colSpan={2} className="py-2 text-xs font-semibold text-[#9E9A93] uppercase tracking-wider">Impôt sur les dividendes</td></tr>
                            <tr><td className="py-1.5 text-[#5C6880] dark:text-[#7B8DA6] pl-3">Dividendes imposables</td><td className="py-1.5 text-right font-mono font-medium">{fmt(resultsPrive.divImposables)}</td></tr>
                            {resultsPrive.ifdSurDiv > 0 && <tr><td className="py-1.5 text-[#5C6880] dark:text-[#7B8DA6] pl-3">IFD fédéral (taux marginal)</td><td className="py-1.5 text-right font-mono text-red-500">−{fmt(resultsPrive.ifdSurDiv)}</td></tr>}
                            <tr><td className="py-1.5 text-[#5C6880] dark:text-[#7B8DA6] pl-3">Cantonal {canton} ({cantonData.taux}%)</td><td className="py-1.5 text-right font-mono text-red-500">−{fmt(resultsPrive.impotCantonal)}</td></tr>
                          </>
                        )}
                        {resultsPrive.impotAnticipe > 0 && (
                          <>
                            <tr><td colSpan={2} className="py-2 text-xs font-semibold text-[#9E9A93] uppercase tracking-wider pt-4">Impôt anticipé (35%)</td></tr>
                            <tr><td className="py-1.5 text-[#5C6880] dark:text-[#7B8DA6] pl-3">Retenu à la source (immédiat)</td><td className="py-1.5 text-right font-mono text-red-500">−{fmt(resultsPrive.impotAnticipe)}</td></tr>
                            <tr><td className="py-1.5 text-[#5C6880] dark:text-[#7B8DA6] pl-3">Remboursé l&apos;année suivante ✓</td><td className="py-1.5 text-right font-mono text-green-500">+{fmt(resultsPrive.impotAnticipe)}</td></tr>
                            <tr><td colSpan={2} className="py-1 text-xs text-[#9E9A93] italic pl-3">Impact net = 0 CHF</td></tr>
                          </>
                        )}
                        <tr className="border-t-2 border-[#DDD9D1] dark:border-[#1e3347]">
                          <td className="py-3 font-semibold">Charge fiscale totale</td>
                          <td className="py-3 text-right font-mono font-bold text-red-500">−{fmt(resultsPrive.coutTotal)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {resultsPrive.divImposables > 0 && (
                    <div className={`${CARD_CLS} p-6`}>
                      <h3 className="text-sm font-semibold mb-4">
                        Comparaison par canton
                        <span className="text-xs font-normal text-[#9E9A93] ml-2">pour {fmt(resultsPrive.divImposables)} de dividendes</span>
                      </h3>
                      <div className="space-y-1.5">
                        {[...CANTONS].sort((a,b) => a.taux - b.taux).map(c => {
                          const impot = resultsPrive.divImposables * (c.taux/100)
                          const max   = resultsPrive.divImposables * 0.44
                          const isSel = c.code === canton
                          return (
                            <div key={c.code} onClick={() => setCanton(c.code)}
                              className={`flex items-center gap-3 rounded-lg px-3 py-1.5 cursor-pointer transition-colors ${isSel ? 'bg-[#F5F3EF] dark:bg-[#1e3347]/60 border border-[#B5820F]/20' : 'hover:bg-[#F5F3EF] dark:hover:bg-[#1e3347]/40'}`}>
                              <span className="text-xs font-mono w-6 text-[#9E9A93]">{c.code}</span>
                              <div className="flex-1 h-1.5 rounded-full bg-[#F5F3EF] dark:bg-[#0F1E2C]">
                                <div className="h-1.5 rounded-full transition-all" style={{ width:`${(impot/max)*100}%`, backgroundColor: isSel ? '#1B3050' : '#D1C8BC' }} />
                              </div>
                              <span className={`text-xs font-mono w-20 text-right ${isSel ? 'text-[#1B3050] dark:text-[#E8C37A] font-semibold' : 'text-[#9E9A93]'}`}>{fmt(impot)}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </>
              )
            )}

            {/* ─── CALCUL PRO ─── */}
            {activeTab === 'calcul' && mode === 'pro' && (
              !hasDataPro ? (
                <div className={`${CARD_CLS} p-10 text-center`}>
                  <div className="text-4xl mb-3">💼</div>
                  <p className="text-[#9E9A93] text-sm">Remplissez les champs à gauche pour estimer votre charge en tant que trader professionnel.</p>
                </div>
              ) : (
                <>
                  <div className={`${CARD_CLS} p-6`}>
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <p className="text-xs font-semibold text-[#9E9A93] uppercase tracking-wider mb-1">Charge fiscale estimée</p>
                        <p className="text-3xl font-bold">{fmt(resultsPro.coutTotal)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-[#9E9A93] mb-1">Taux effectif sur gains + dividendes</p>
                        <p className="text-2xl font-bold text-red-500">{resultsPro.tauxEffectif.toFixed(1)}%</p>
                      </div>
                    </div>
                    {resultsPro.coutTotal > 0 && (
                      <div className="space-y-2">
                        {[
                          { label: `AVS/AI/APG (${(AVS_TAUX*100).toFixed(1)}% sur gains nets)`, val: resultsPro.avs, color: '#EF4444' },
                          { label: `Impôt cantonal ${canton} (${cantonData.taux}%)`, val: resultsPro.impotCantonal, color: '#1B3050' },
                          { label: 'IFD fédéral', val: resultsPro.ifdSurGains, color: '#B5820F' },
                        ].filter(i => i.val > 0).map(item => (
                          <div key={item.label}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-[#5C6880] dark:text-[#7B8DA6]">{item.label}</span>
                              <span className="font-mono font-medium">{fmt(item.val)}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-[#F5F3EF] dark:bg-[#0F1E2C]">
                              <div className="h-1.5 rounded-full" style={{ width:`${(item.val/resultsPro.coutTotal)*100}%`, backgroundColor: item.color }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className={`${CARD_CLS} p-6`}>
                    <h3 className="text-sm font-semibold mb-4">Détail du calcul</h3>
                    <table className="w-full text-sm">
                      <tbody>
                        <tr><td colSpan={2} className="py-2 text-xs font-semibold text-[#9E9A93] uppercase tracking-wider">Activité de trading</td></tr>
                        <tr><td className="py-1.5 text-[#5C6880] dark:text-[#7B8DA6] pl-3">Gains en capital bruts</td><td className="py-1.5 text-right font-mono font-medium">{fmt(resultsPro.gains)}</td></tr>
                        {resultsPro.perts > 0 && <tr><td className="py-1.5 text-[#5C6880] dark:text-[#7B8DA6] pl-3">Pertes déductibles</td><td className="py-1.5 text-right font-mono text-green-500">−{fmt(resultsPro.perts)}</td></tr>}
                        {resultsPro.fr > 0 && <tr><td className="py-1.5 text-[#5C6880] dark:text-[#7B8DA6] pl-3">Frais professionnels</td><td className="py-1.5 text-right font-mono text-green-500">−{fmt(resultsPro.fr)}</td></tr>}
                        <tr><td className="py-1.5 text-[#5C6880] dark:text-[#7B8DA6] pl-3 font-medium">Gain net imposable</td><td className="py-1.5 text-right font-mono font-semibold">{fmt(resultsPro.gainsNets)}</td></tr>
                        {resultsPro.avs > 0 && (
                          <>
                            <tr><td colSpan={2} className="py-2 text-xs font-semibold text-[#9E9A93] uppercase tracking-wider pt-4">Cotisations sociales</td></tr>
                            <tr><td className="py-1.5 text-[#5C6880] dark:text-[#7B8DA6] pl-3">AVS/AI/APG ({(AVS_TAUX*100).toFixed(1)}% sur gain net)</td><td className="py-1.5 text-right font-mono text-red-500">−{fmt(resultsPro.avs)}</td></tr>
                          </>
                        )}
                        {(resultsPro.ifdSurGains > 0 || resultsPro.impotCantonal > 0) && (
                          <>
                            <tr><td colSpan={2} className="py-2 text-xs font-semibold text-[#9E9A93] uppercase tracking-wider pt-4">Impôt sur le revenu</td></tr>
                            {resultsPro.ifdSurGains > 0 && <tr><td className="py-1.5 text-[#5C6880] dark:text-[#7B8DA6] pl-3">IFD fédéral (taux marginal)</td><td className="py-1.5 text-right font-mono text-red-500">−{fmt(resultsPro.ifdSurGains)}</td></tr>}
                            <tr><td className="py-1.5 text-[#5C6880] dark:text-[#7B8DA6] pl-3">Cantonal {canton} ({cantonData.taux}%)</td><td className="py-1.5 text-right font-mono text-red-500">−{fmt(resultsPro.impotCantonal)}</td></tr>
                          </>
                        )}
                        {resultsPro.impotAnticipe > 0 && (
                          <>
                            <tr><td colSpan={2} className="py-2 text-xs font-semibold text-[#9E9A93] uppercase tracking-wider pt-4">Impôt anticipé (35%)</td></tr>
                            <tr><td className="py-1.5 text-[#5C6880] dark:text-[#7B8DA6] pl-3">Retenu à la source</td><td className="py-1.5 text-right font-mono text-red-500">−{fmt(resultsPro.impotAnticipe)}</td></tr>
                            <tr><td className="py-1.5 text-[#5C6880] dark:text-[#7B8DA6] pl-3">Remboursé l&apos;année suivante ✓</td><td className="py-1.5 text-right font-mono text-green-500">+{fmt(resultsPro.impotAnticipe)}</td></tr>
                          </>
                        )}
                        <tr className="border-t-2 border-[#DDD9D1] dark:border-[#1e3347]">
                          <td className="py-3 font-semibold">Charge fiscale totale</td>
                          <td className="py-3 text-right font-mono font-bold text-red-500">−{fmt(resultsPro.coutTotal)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {resultsPro.gainsNets > 0 && (
                    <div className="bg-[#FDF6E3] dark:bg-amber-900/20 rounded-xl border border-[#B5820F]/20 p-6">
                      <h3 className="text-sm font-semibold text-[#B5820F] mb-4">⚖️ Comparaison avec le statut investisseur privé</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-[#5C6880] dark:text-[#7B8DA6]">Si investisseur privé (dividendes uniquement)</span>
                          <span className="font-mono text-[#5C6880]">−{fmt(resultsPro.coutSiPrive)}</span>
                        </div>
                        <div className="flex justify-between font-semibold">
                          <span className="text-[#B5820F]">Surcoût lié au statut professionnel</span>
                          <span className="font-mono text-red-500">−{fmt(resultsPro.surcout)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#5C6880] dark:text-[#7B8DA6]">dont AVS/AI/APG (non récupérables)</span>
                          <span className="font-mono text-red-500">−{fmt(resultsPro.avs)}</span>
                        </div>
                      </div>
                      <p className="text-xs text-[#B5820F]/70 dark:text-amber-500 mt-4">
                        Les plus-values exonérées en tant qu&apos;investisseur privé ({fmt(resultsPro.gainsNets)}) sont ici imposées comme revenu professionnel.
                      </p>
                    </div>
                  )}
                </>
              )
            )}

            {/* ─── CALENDRIER ─── */}
            {activeTab === 'calendrier' && (
              <div className="space-y-4">
                {CALENDRIER.map(section => (
                  <div key={section.quand} className={`${CARD_CLS} overflow-hidden`}>
                    <div className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider ${section.bg} ${section.text}`}>
                      ⏱ {section.quand}
                    </div>
                    <div className="divide-y divide-[#DDD9D1] dark:divide-[#1e3347]">
                      {section.items.map(item => (
                        <div key={item.label} className="px-5 py-4">
                          <p className="text-sm font-semibold mb-1">{item.label}</p>
                          <p className="text-sm text-[#5C6880] dark:text-[#7B8DA6] leading-relaxed">{item.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <p className="text-xs text-[#9E9A93] px-1">⚠️ Les délais de déclaration varient selon les cantons.</p>
              </div>
            )}

            {/* ─── PLUS-VALUES ─── */}
            {activeTab === 'plusvalue' && mode === 'prive' && (
              <div className="space-y-4">
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800 p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">🎉</span>
                    <h3 className="text-lg font-bold text-green-800 dark:text-green-300">Plus-values exonérées en Suisse</h3>
                  </div>
                  <p className="text-green-700 dark:text-green-400 text-sm leading-relaxed">
                    En tant qu&apos;investisseur privé, vos gains en capital sont <strong>totalement exonérés d&apos;impôt</strong>, que vous vendiez après 1 mois ou 20 ans.
                  </p>
                </div>
                <div className={`${CARD_CLS} p-6`}>
                  <h3 className="text-sm font-semibold mb-4">Exemples concrets</h3>
                  <div className="space-y-3">
                    {[
                      { actif: 'Action Nestlé',  achat: '100 CHF',    vente: '150 CHF',    gain: '+50 CHF'    },
                      { actif: 'ETF MSCI World', achat: '10 000 CHF', vente: '18 000 CHF', gain: '+8 000 CHF' },
                      { actif: 'Bitcoin (ETF)',  achat: '5 000 CHF',  vente: '12 000 CHF', gain: '+7 000 CHF' },
                    ].map(ex => (
                      <div key={ex.actif} className="flex items-center justify-between py-2 border-b border-[#DDD9D1] dark:border-[#1e3347] last:border-0">
                        <div>
                          <p className="text-sm font-medium">{ex.actif}</p>
                          <p className="text-xs text-[#9E9A93]">{ex.achat} → {ex.vente} = <span className="text-green-500">{ex.gain}</span></p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-[#9E9A93]">Impôt dû</p>
                          <p className="text-sm font-bold text-green-500">0 CHF</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ─── MON STATUT ─── */}
            {activeTab === 'statut' && (() => {
              const CardPrive = ({ current }: { current: boolean }) => (
                <div className={`${CARD_CLS} overflow-hidden ${current ? 'ring-2 ring-[#2B6B5A]' : 'opacity-70'}`}>
                  <div className="px-5 py-3 bg-green-50 dark:bg-green-900/20 border-b border-[#DDD9D1] dark:border-[#1e3347]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg">👤</span>
                      <h3 className="text-sm font-semibold text-green-800 dark:text-green-300">Investisseur privé</h3>
                      {current
                        ? <span className="ml-auto text-xs font-semibold text-white bg-[#2B6B5A] px-2.5 py-0.5 rounded-full">✓ Votre statut actuel</span>
                        : <span className="ml-auto text-xs font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/40 px-2 py-0.5 rounded-full">Régime par défaut</span>
                      }
                    </div>
                  </div>
                  <div className="p-5 space-y-4">
                    <div>
                      <p className="text-xs font-semibold text-[#9E9A93] uppercase tracking-wider mb-2">Critères typiques</p>
                      <ul className="space-y-2">
                        {[
                          'Vous investissez votre propre épargne, sans emprunt',
                          'Vous conservez vos titres plusieurs mois ou années',
                          'Vos revenus principaux viennent d\'un salaire ou d\'une autre activité',
                          'Vous effectuez un nombre limité de transactions par an',
                          'Les revenus du trading restent minoritaires dans votre revenu total',
                        ].map(c => (
                          <li key={c} className="flex items-start gap-2 text-sm text-[#5C6880] dark:text-[#7B8DA6]">
                            <span className="text-green-500 mt-0.5 shrink-0">✓</span>{c}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="pt-3 border-t border-[#DDD9D1] dark:border-[#1e3347]">
                      <p className="text-xs font-semibold text-[#9E9A93] uppercase tracking-wider mb-2">Ce que vous payez</p>
                      <ul className="space-y-1.5 text-sm">
                        <li className="flex justify-between"><span className="text-[#5C6880] dark:text-[#7B8DA6]">Plus-values (vente de titres)</span><span className="font-semibold text-green-500">0% — exonéré</span></li>
                        <li className="flex justify-between"><span className="text-[#5C6880] dark:text-[#7B8DA6]">Dividendes</span><span className="font-semibold text-[#B5820F]">IFD + cantonal</span></li>
                        <li className="flex justify-between"><span className="text-[#5C6880] dark:text-[#7B8DA6]">Cotisations AVS/AI</span><span className="font-semibold text-green-500">Aucune</span></li>
                      </ul>
                    </div>
                  </div>
                </div>
              )

              const CardPro = ({ current }: { current: boolean }) => (
                <div className={`${CARD_CLS} overflow-hidden ${current ? 'ring-2 ring-red-500' : 'opacity-70'}`}>
                  <div className="px-5 py-3 bg-red-50 dark:bg-red-900/20 border-b border-[#DDD9D1] dark:border-[#1e3347]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg">💼</span>
                      <h3 className="text-sm font-semibold text-red-800 dark:text-red-300">Trader professionnel</h3>
                      {current
                        ? <span className="ml-auto text-xs font-semibold text-white bg-red-500 px-2.5 py-0.5 rounded-full">✓ Votre statut actuel</span>
                        : <span className="ml-auto text-xs font-medium text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40 px-2 py-0.5 rounded-full">Requalification fiscale</span>
                      }
                    </div>
                  </div>
                  <div className="p-5 space-y-4">
                    <div>
                      <p className="text-xs font-semibold text-[#9E9A93] uppercase tracking-wider mb-2">Critères de requalification (faisceau d&apos;indices)</p>
                      <ul className="space-y-2">
                        {[
                          { texte: 'Volume de transactions > 5× la valeur du portefeuille par an', risque: 'élevé' },
                          { texte: 'Recours à un levier ou à un crédit pour investir', risque: 'élevé' },
                          { texte: 'Durée moyenne de détention inférieure à 6 mois', risque: 'élevé' },
                          { texte: 'Revenus du trading > 50% de vos revenus totaux', risque: 'élevé' },
                          { texte: 'Plus de 100–200 transactions par an', risque: 'moyen' },
                        ].map(c => (
                          <li key={c.texte} className="flex items-start gap-2 text-sm text-[#5C6880] dark:text-[#7B8DA6]">
                            <span className={`mt-0.5 shrink-0 ${c.risque === 'élevé' ? 'text-red-500' : 'text-[#B5820F]'}`}>⚠</span>{c.texte}
                          </li>
                        ))}
                      </ul>
                      <p className="text-xs text-[#9E9A93] mt-3">Aucun critère n&apos;est décisif seul — c&apos;est leur combinaison que le fisc apprécie au cas par cas.</p>
                    </div>
                    <div className="pt-3 border-t border-[#DDD9D1] dark:border-[#1e3347]">
                      <p className="text-xs font-semibold text-[#9E9A93] uppercase tracking-wider mb-2">Ce que vous payez en plus</p>
                      <ul className="space-y-1.5 text-sm">
                        <li className="flex justify-between"><span className="text-[#5C6880] dark:text-[#7B8DA6]">Plus-values (vente de titres)</span><span className="font-semibold text-red-500">IFD + cantonal</span></li>
                        <li className="flex justify-between"><span className="text-[#5C6880] dark:text-[#7B8DA6]">Cotisations AVS/AI/APG</span><span className="font-semibold text-red-500">≈ 10.6% sur gains nets</span></li>
                        <li className="flex justify-between"><span className="text-[#5C6880] dark:text-[#7B8DA6]">Pertes & frais pro</span><span className="font-semibold text-green-500">Déductibles</span></li>
                      </ul>
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
                  <div className="bg-[#FDF6E3] dark:bg-amber-900/20 rounded-xl border border-[#B5820F]/20 p-5">
                    <p className="text-xs text-[#B5820F] dark:text-amber-400 leading-relaxed">
                      <strong>En cas de doute</strong>, consultez votre administration fiscale cantonale ou un conseiller fiscal avant de déclarer. La requalification peut s&apos;appliquer rétroactivement sur les 5 dernières années.
                    </p>
                  </div>
                </div>
              )
            })()}

            <p className="text-xs text-[#9E9A93] px-1">⚠️ Estimation indicative basée sur les barèmes 2024. Consultez un conseiller fiscal pour votre situation précise.</p>
          </div>
        </div>
      </div>
    <Footer />
    </div>
  )
}
