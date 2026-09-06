'use client'

import React, { useState, useMemo } from 'react'
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

function fmt(n: number): string {
  return Math.abs(n).toLocaleString('fr-CH', { maximumFractionDigits: 0 }) + ' CHF'
}

interface FormVals {
  revenu: string
  dividendesCH: string
  dividendesETR: string
  transactionsCH: string
  transactionsETR: string
  transactionsMP: string
  transactionsFX: string
}

const CALENDRIER = [
  {
    quand: 'Au moment de la transaction',
    couleur: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
    items: [
      { label: 'Droit de timbre', detail: 'Prélevé automatiquement par le courtier à chaque achat ou vente de titres. Non récupérable.' },
    ],
  },
  {
    quand: 'Dès réception du dividende',
    couleur: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400',
    items: [
      { label: 'Impôt anticipé (35%)', detail: 'Prélevé à la source sur les dividendes suisses. Votre courtier vous verse 65% du dividende. Les 35% sont récupérés l\'année suivante.' },
    ],
  },
  {
    quand: 'L\'année suivante (déclaration fiscale)',
    couleur: 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400',
    items: [
      { label: 'IFD + impôt cantonal sur dividendes', detail: 'Déclarez tous vos dividendes (CH et étrangers) dans votre déclaration fiscale annuelle. L\'impôt est calculé et facturé l\'année suivante.' },
      { label: 'Remboursement impôt anticipé', detail: 'En déclarant vos dividendes suisses, vous récupérez les 35% retenus à la source.' },
    ],
  },
  {
    quand: 'Jamais (exonéré)',
    couleur: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400',
    items: [
      { label: 'Plus-values sur titres', detail: 'Les gains en capital réalisés en vendant des actions, ETF ou obligations sont totalement exonérés d\'impôt pour un investisseur privé en Suisse.' },
      { label: 'Forex / Devises', detail: 'Les gains de change sur transactions de devises directes ne sont pas soumis au droit de timbre ni à l\'impôt sur les gains en capital.' },
    ],
  },
]

export default function SimulateurPage() {
  const [canton, setCanton] = useState('ZH')
  const [situation, setSituation] = useState<'seul' | 'marie'>('seul')
  const [activeTab, setActiveTab] = useState<'calcul' | 'calendrier' | 'plusvalue'>('calcul')
  const [vals, setVals] = useState<FormVals>({
    revenu: '', dividendesCH: '', dividendesETR: '',
    transactionsCH: '', transactionsETR: '',
    transactionsMP: '', transactionsFX: '',
  })

  function handleChange(field: keyof FormVals) {
    return function(e: React.ChangeEvent<HTMLInputElement>) {
      setVals(prev => ({ ...prev, [field]: e.target.value.replace(/[^0-9.]/g, '') }))
    }
  }

  const results = useMemo(() => {
    const revenu = parseFloat(vals.revenu) || 0
    const divCH = parseFloat(vals.dividendesCH) || 0
    const divETR = parseFloat(vals.dividendesETR) || 0
    const trCH = parseFloat(vals.transactionsCH) || 0
    const trETR = parseFloat(vals.transactionsETR) || 0
    const trMP = parseFloat(vals.transactionsMP) || 0
    const marie = situation === 'marie'

    const timbreCH = trCH * 0.00075
    const timbreETR = trETR * 0.0015
    const timbreMP = trMP * 0.0015
    const timbreTotal = timbreCH + timbreETR + timbreMP

    const impotAnticipe = divCH * 0.35
    const divImposables = divCH + divETR

    const ifdSansDiv = calcIFD(revenu, marie)
    const ifdAvecDiv = calcIFD(revenu + divImposables, marie)
    const ifdSurDiv = ifdAvecDiv - ifdSansDiv

    const cantonData = CANTONS.find(c => c.code === canton) || CANTONS[CANTONS.length - 1]
    const impotCantonal = divImposables * (cantonData.taux / 100)
    const coutTotal = timbreTotal + ifdSurDiv + impotCantonal
    const tauxEffectif = divImposables > 0 ? ((ifdSurDiv + impotCantonal) / divImposables) * 100 : 0

    return { timbreCH, timbreETR, timbreMP, timbreTotal, impotAnticipe, divImposables, ifdSurDiv, impotCantonal, coutTotal, tauxEffectif, cantonTaux: cantonData.taux }
  }, [vals, canton, situation])

  const hasData = Object.values(vals).some(v => parseFloat(v) > 0)
  const inputCls = 'w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 placeholder-gray-400'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100">
      <nav className="border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-lg font-semibold">fin<span className="text-teal-700">veria</span></Link>
        <div className="flex gap-4 text-sm">
          <Link href="/comparateur" className="text-gray-500 hover:text-slate-800">Comparateur</Link>
          <Link href="/simulateur" className="text-teal-700 font-medium">Simulateur</Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold">Simulateur fiscal cantonal</h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Premium</span>
          </div>
          <p className="text-gray-500 text-sm">Estimez votre charge fiscale sur vos revenus de placements — droit de timbre, impôt anticipé, IFD et impôt cantonal.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Formulaire */}
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Situation</h2>
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Canton de domicile</label>
                <select value={canton} onChange={e => setCanton(e.target.value)} className={inputCls}>
                  {CANTONS.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Situation fiscale</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setSituation('seul')} className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${situation === 'seul' ? 'bg-teal-700 text-white border-teal-700' : 'text-gray-500 border-gray-200 hover:border-teal-700'}`}>Célibataire</button>
                  <button onClick={() => setSituation('marie')} className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${situation === 'marie' ? 'bg-teal-700 text-white border-teal-700' : 'text-gray-500 border-gray-200 hover:border-teal-700'}`}>Marié(e)</button>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Revenus</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Revenu imposable (hors investissements)</label>
                  <div className="relative">
                    <input type="text" value={vals.revenu} onChange={handleChange('revenu')} placeholder="80 000" className={inputCls} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">CHF</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Dividendes suisses (brut)</label>
                  <div className="relative">
                    <input type="text" value={vals.dividendesCH} onChange={handleChange('dividendesCH')} placeholder="2 000" className={inputCls} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">CHF</span>
                  </div>
                  <p className="text-xs text-amber-600 mt-1">⏱ Impôt anticipé 35% prélevé à la source</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Dividendes étrangers (ETF, actions)</label>
                  <div className="relative">
                    <input type="text" value={vals.dividendesETR} onChange={handleChange('dividendesETR')} placeholder="1 500" className={inputCls} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">CHF</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">⏱ À déclarer l&apos;année suivante</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Transactions (volume annuel)</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Actions / ETF suisses (0.075%)</label>
                  <div className="relative">
                    <input type="text" value={vals.transactionsCH} onChange={handleChange('transactionsCH')} placeholder="20 000" className={inputCls} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">CHF</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Actions / ETF étrangers (0.15%)</label>
                  <div className="relative">
                    <input type="text" value={vals.transactionsETR} onChange={handleChange('transactionsETR')} placeholder="50 000" className={inputCls} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">CHF</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Matières premières / ETP (0.15%)</label>
                  <div className="relative">
                    <input type="text" value={vals.transactionsMP} onChange={handleChange('transactionsMP')} placeholder="10 000" className={inputCls} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">CHF</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Forex / Devises</label>
                  <div className="relative">
                    <input type="text" value={vals.transactionsFX} onChange={handleChange('transactionsFX')} placeholder="5 000" className={inputCls} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">CHF</span>
                  </div>
                  <p className="text-xs text-teal-600 mt-1">✓ Exonéré du droit de timbre</p>
                </div>
              </div>
            </div>
          </div>

          {/* Résultats */}
          <div className="lg:col-span-3 space-y-5">
            {/* Onglets */}
            <div className="flex gap-1 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-1">
              {[
                { key: 'calcul', label: 'Calcul fiscal' },
                { key: 'calendrier', label: 'Quand payer ?' },
                { key: 'plusvalue', label: 'Plus-values' },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.key ? 'bg-teal-700 text-white' : 'text-gray-500 hover:text-slate-800'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Onglet Calcul */}
            {activeTab === 'calcul' && (
              <>
                {!hasData ? (
                  <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-10 text-center">
                    <div className="text-4xl mb-3">🧮</div>
                    <p className="text-gray-400 text-sm">Remplissez les champs à gauche pour obtenir votre estimation fiscale.</p>
                  </div>
                ) : (
                  <>
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
                      <div className="flex items-start justify-between mb-6">
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Charge fiscale estimée</p>
                          <p className="text-3xl font-bold">{fmt(results.coutTotal)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-400 mb-1">Taux effectif sur dividendes</p>
                          <p className="text-2xl font-bold text-amber-600">{results.tauxEffectif.toFixed(1)}%</p>
                        </div>
                      </div>
                      {results.coutTotal > 0 && (
                        <div className="space-y-2">
                          {[
                            { label: 'Droit de timbre', val: results.timbreTotal, color: '#6b7280' },
                            { label: `Impôt cantonal ${canton} (${results.cantonTaux}%)`, val: results.impotCantonal, color: '#0f766e' },
                            { label: 'IFD fédéral', val: results.ifdSurDiv, color: '#1e3a5f' },
                          ].filter(item => item.val > 0).map(item => (
                            <div key={item.label}>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-500">{item.label}</span>
                                <span className="font-mono font-medium">{fmt(item.val)}</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-gray-100 dark:bg-slate-700">
                                <div className="h-1.5 rounded-full" style={{ width: `${(item.val / results.coutTotal) * 100}%`, backgroundColor: item.color }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
                      <h3 className="text-sm font-semibold mb-4">Détail du calcul</h3>
                      <table className="w-full text-sm">
                        <tbody>
                          {results.timbreTotal > 0 && (
                            <>
                              <tr><td colSpan={2} className="py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Droit de timbre</td></tr>
                              {results.timbreCH > 0 && <tr><td className="py-1.5 text-gray-500 pl-3">Actions / ETF suisses (0.075%)</td><td className="py-1.5 text-right font-mono text-red-500">−{fmt(results.timbreCH)}</td></tr>}
                              {results.timbreETR > 0 && <tr><td className="py-1.5 text-gray-500 pl-3">Actions / ETF étrangers (0.15%)</td><td className="py-1.5 text-right font-mono text-red-500">−{fmt(results.timbreETR)}</td></tr>}
                              {results.timbreMP > 0 && <tr><td className="py-1.5 text-gray-500 pl-3">Matières premières / ETP (0.15%)</td><td className="py-1.5 text-right font-mono text-red-500">−{fmt(results.timbreMP)}</td></tr>}
                              <tr><td className="py-1.5 text-gray-500 pl-3">Forex / Devises</td><td className="py-1.5 text-right font-mono text-teal-600">Exonéré</td></tr>
                            </>
                          )}
                          {results.impotAnticipe > 0 && (
                            <>
                              <tr><td colSpan={2} className="py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider pt-4">Impôt anticipé (35%)</td></tr>
                              <tr><td className="py-1.5 text-gray-500 pl-3">Retenu à la source (immédiat)</td><td className="py-1.5 text-right font-mono text-red-500">−{fmt(results.impotAnticipe)}</td></tr>
                              <tr><td className="py-1.5 text-gray-500 pl-3">Remboursé l&apos;année suivante ✓</td><td className="py-1.5 text-right font-mono text-teal-600">+{fmt(results.impotAnticipe)}</td></tr>
                              <tr><td colSpan={2} className="py-1 text-xs text-gray-400 italic pl-3">Impact net = 0 CHF</td></tr>
                            </>
                          )}
                          {results.divImposables > 0 && (
                            <>
                              <tr><td colSpan={2} className="py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider pt-4">Impôt sur les dividendes</td></tr>
                              <tr><td className="py-1.5 text-gray-500 pl-3">Dividendes imposables</td><td className="py-1.5 text-right font-mono font-medium">{fmt(results.divImposables)}</td></tr>
                              {results.ifdSurDiv > 0 && <tr><td className="py-1.5 text-gray-500 pl-3">IFD fédéral (taux marginal)</td><td className="py-1.5 text-right font-mono text-red-500">−{fmt(results.ifdSurDiv)}</td></tr>}
                              <tr><td className="py-1.5 text-gray-500 pl-3">Cantonal {canton} ({results.cantonTaux}%)</td><td className="py-1.5 text-right font-mono text-red-500">−{fmt(results.impotCantonal)}</td></tr>
                            </>
                          )}
                          <tr className="border-t-2 border-slate-200 dark:border-slate-600">
                            <td className="py-3 font-semibold">Charge fiscale totale</td>
                            <td className="py-3 text-right font-mono font-bold text-red-500">−{fmt(results.coutTotal)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {results.divImposables > 0 && (
                      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
                        <h3 className="text-sm font-semibold mb-4">
                          Comparaison par canton
                          <span className="text-xs font-normal text-gray-400 ml-2">pour {fmt(results.divImposables)} de dividendes</span>
                        </h3>
                        <div className="space-y-1.5">
                          {[...CANTONS].sort((a, b) => a.taux - b.taux).map(c => {
                            const impot = results.divImposables * (c.taux / 100)
                            const max = results.divImposables * 0.44
                            const isSelected = c.code === canton
                            return (
                              <div key={c.code} onClick={() => setCanton(c.code)} className={`flex items-center gap-3 rounded-lg px-3 py-1.5 cursor-pointer transition-colors ${isSelected ? 'bg-teal-50 dark:bg-teal-900/20 border border-teal-200' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
                                <span className="text-xs font-mono w-6 text-gray-400">{c.code}</span>
                                <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-slate-700">
                                  <div className="h-1.5 rounded-full transition-all" style={{ width: `${(impot / max) * 100}%`, backgroundColor: isSelected ? '#0f766e' : '#d1d5db' }} />
                                </div>
                                <span className={`text-xs font-mono w-20 text-right ${isSelected ? 'text-teal-700 font-semibold' : 'text-gray-500'}`}>{fmt(impot)}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {/* Onglet Calendrier */}
            {activeTab === 'calendrier' && (
              <div className="space-y-4">
                {CALENDRIER.map(section => (
                  <div key={section.quand} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                    <div className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider ${section.couleur}`}>
                      ⏱ {section.quand}
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-slate-700">
                      {section.items.map(item => (
                        <div key={item.label} className="px-5 py-4">
                          <p className="text-sm font-semibold mb-1">{item.label}</p>
                          <p className="text-sm text-gray-500 leading-relaxed">{item.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <p className="text-xs text-gray-400 px-1">
                  ⚠️ Les délais de déclaration varient selon les cantons. Vérifiez les dates limites auprès de votre administration fiscale cantonale.
                </p>
              </div>
            )}

            {/* Onglet Plus-values */}
            {activeTab === 'plusvalue' && (
              <div className="space-y-4">
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800 p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">🎉</span>
                    <h3 className="text-lg font-bold text-green-800 dark:text-green-300">Plus-values exonérées en Suisse</h3>
                  </div>
                  <p className="text-green-700 dark:text-green-400 text-sm leading-relaxed">
                    En tant qu&apos;investisseur privé, vos gains en capital sur la vente d&apos;actions, ETF, obligations ou matières premières sont <strong>totalement exonérés d&apos;impôt</strong>. Cela s&apos;applique que vous vendiez après 1 mois ou 20 ans.
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
                  <h3 className="text-sm font-semibold mb-4">Exemples concrets</h3>
                  <div className="space-y-3">
                    {[
                      { actif: 'Action Nestlé', achat: '100 CHF', vente: '150 CHF', gain: '+50 CHF', impot: '0 CHF', couleur: 'text-green-600' },
                      { actif: 'ETF MSCI World', achat: '10 000 CHF', vente: '18 000 CHF', gain: '+8 000 CHF', impot: '0 CHF', couleur: 'text-green-600' },
                      { actif: 'Bitcoin (ETF)', achat: '5 000 CHF', vente: '12 000 CHF', gain: '+7 000 CHF', impot: '0 CHF', couleur: 'text-green-600' },
                    ].map(ex => (
                      <div key={ex.actif} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-slate-700 last:border-0">
                        <div>
                          <p className="text-sm font-medium">{ex.actif}</p>
                          <p className="text-xs text-gray-400">{ex.achat} → {ex.vente} = <span className="text-green-600">{ex.gain}</span></p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-400">Impôt dû</p>
                          <p className={`text-sm font-bold ${ex.couleur}`}>{ex.impot}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 p-5">
                  <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-3">⚠️ Attention — Trader professionnel</h3>
                  <p className="text-sm text-amber-700 dark:text-amber-400 leading-relaxed mb-3">
                    L&apos;administration fiscale peut requalifier vos gains en revenus professionnels imposables si vous réunissez plusieurs de ces critères :
                  </p>
                  <ul className="space-y-1.5 text-sm text-amber-700 dark:text-amber-400">
                    {[
                      'Volume de transactions > 5× votre portefeuille par an',
                      'Utilisation d\'un levier ou de crédit pour investir',
                      'Détention de titres < 6 mois en moyenne',
                      'Revenus du trading > 50% de vos revenus totaux',
                      'Plus de 100–200 transactions par an',
                    ].map(item => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="mt-0.5">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-amber-600 dark:text-amber-500 mt-3 font-medium">
                    Si vous correspondez à plusieurs critères, consultez un conseiller fiscal avant de déclarer.
                  </p>
                </div>
              </div>
            )}

            <p className="text-xs text-gray-400 px-1">
              ⚠️ Estimation indicative basée sur les barèmes 2024. Consultez un conseiller fiscal pour votre situation précise.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}