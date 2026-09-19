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
  if (sign && n < 0) return `− ${s} CHF`
  if (sign && n > 0) return `+ ${s} CHF`
  return `${s} CHF`
}

type Field = 'revenu' | 'dividendesCH' | 'dividendesETR' | 'transactionsCH' | 'transactionsETR'

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

  const inputClass = `
    w-full bg-white dark:bg-[#1B2D3E] border border-[#DDD9D1] dark:border-[#2a3f52]
    rounded-lg px-4 py-2.5 text-sm text-[#1B3050] dark:text-[#E8E4DC]
    focus:outline-none focus:ring-2 focus:ring-[#2B6B5A] focus:border-transparent
    placeholder-[#9E9A93]
  `

  return (
    <div className="min-h-screen bg-[#F5F3EF] dark:bg-[#0F1E2C] text-[#1B3050] dark:text-[#E8E4DC]">
      <Header />

      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold tracking-tight">Simulateur fiscal cantonal</h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#B5820F]/10 text-[#B5820F] border border-[#B5820F]/20">
              Premium
            </span>
          </div>
          <p className="text-[#5C6880] text-sm">
            Estimez votre charge fiscale sur vos revenus de placements — droit de timbre, impôt anticipé, IFD et impôt cantonal.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Formulaire */}
          <div className="lg:col-span-2 space-y-5">
            {/* Situation */}
            <div className="bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-5">
              <h2 className="text-sm font-semibold text-[#5C6880] uppercase tracking-wider mb-4">Situation</h2>

              <div className="mb-4">
                <label className="block text-xs font-medium text-[#5C6880] mb-1.5">Canton de domicile</label>
                <select
                  value={canton}
                  onChange={e => setCanton(e.target.value)}
                  className={inputClass}
                >
                  {CANTONS.map(c => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#5C6880] mb-1.5">Situation fiscale</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['seul', 'marie'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setSituation(s)}
                      className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                        situation === s
                          ? 'bg-[#2B6B5A] text-white border-[#2B6B5A]'
                          : 'bg-transparent text-[#5C6880] border-[#DDD9D1] dark:border-[#2a3f52] hover:border-[#2B6B5A]'
                      }`}
                    >
                      {s === 'seul' ? 'Célibataire' : 'Marié(e)'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Revenus */}
            <div className="bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-5">
              <h2 className="text-sm font-semibold text-[#5C6880] uppercase tracking-wider mb-4">Revenus</h2>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[#5C6880] mb-1.5">
                    Revenu imposable <span className="text-[#9E9A93] font-normal">(hors investissements)</span>
                  </label>
                  <div className="relative">
                    <input type="text" value={vals.revenu} onChange={set('revenu')}
                      placeholder="80 000" className={inputClass} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#9E9A93]">CHF</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#5C6880] mb-1.5">
                    Dividendes suisses <span className="text-[#9E9A93] font-normal">(brut)</span>
                  </label>
                  <div className="relative">
                    <input type="text" value={vals.dividendesCH} onChange={set('dividendesCH')}
                      placeholder="2 000" className={inputClass} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#9E9A93]">CHF</span>
                  </div>
                  <p className="text-xs text-[#9E9A93] mt-1">Soumis à l'impôt anticipé (35%)</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#5C6880] mb-1.5">
                    Dividendes étrangers <span className="text-[#9E9A93] font-normal">(ETF, actions)</span>
                  </label>
                  <div className="relative">
                    <input type="text" value={vals.dividendesETR} onChange={set('dividendesETR')}
                      placeholder="1 500" className={inputClass} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#9E9A93]">CHF</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Transactions */}
            <div className="bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-5">
              <h2 className="text-sm font-semibold text-[#5C6880] uppercase tracking-wider mb-4">
                Transactions <span className="text-[#9E9A93] font-normal normal-case">(volume annuel)</span>
              </h2>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[#5C6880] mb-1.5">
                    Titres suisses <span className="text-[#9E9A93] font-normal">(0.075%)</span>
                  </label>
                  <div className="relative">
                    <input type="text" value={vals.transactionsCH} onChange={set('transactionsCH')}
                      placeholder="20 000" className={inputClass} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#9E9A93]">CHF</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#5C6880] mb-1.5">
                    Titres étrangers <span className="text-[#9E9A93] font-normal">(0.15%)</span>
                  </label>
                  <div className="relative">
                    <input type="text" value={vals.transactionsETR} onChange={set('transactionsETR')}
                      placeholder="50 000" className={inputClass} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#9E9A93]">CHF</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Résultats */}
          <div className="lg:col-span-3 space-y-5">
            {!hasData ? (
              <div className="bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-10 text-center">
                <div className="text-4xl mb-3">🧮</div>
                <p className="text-[#5C6880] text-sm">Remplissez les champs à gauche pour obtenir votre estimation fiscale.</p>
              </div>
            ) : (
              <>
                {/* Bilan principal */}
                <div className="bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-6">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <p className="text-xs font-semibold text-[#5C6880] uppercase tracking-wider mb-1">Charge fiscale nette estimée</p>
                      <p className="text-3xl font-bold text-[#1B3050] dark:text-white font-mono" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {fmt(results.coutTotal)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[#9E9A93] mb-1">Taux effectif sur dividendes</p>
                      <p className="text-2xl font-bold text-[#B5820F]">
                        {results.tauxEffectif.toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {/* Bar chart visuel */}
                  {results.coutTotal > 0 && (
                    <div className="space-y-2">
                      {[
                        { label: 'Droit de timbre', val: results.timbreTotal, color: '#5C6880' },
                        { label: `Impôt cantonal ${canton} (${results.cantonTaux}%)`, val: results.impotCantonal, color: '#2B6B5A' },
                        { label: 'IFD fédéral', val: results.ifdSurDiv, color: '#1B3050' },
                      ].filter(i => i.val > 0).map(item => (
                        <div key={item.label}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-[#5C6880]">{item.label}</span>
                            <span className="font-mono font-medium">{fmt(item.val)}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-[#F5F3EF] dark:bg-[#0F1E2C]">
                            <div
                              className="h-1.5 rounded-full transition-all"
                              style={{
                                width: `${(item.val / results.coutTotal) * 100}%`,
                                backgroundColor: item.color,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Détail ligne par ligne */}
                <div className="bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-6">
                  <h3 className="text-sm font-semibold mb-4">Détail du calcul</h3>

                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-[#F5F3EF] dark:divide-[#1e3347]">

                      {/* Droit de timbre */}
                      <tr>
                        <td colSpan={2} className="py-2 text-xs font-semibold text-[#5C6880] uppercase tracking-wider pt-3">
                          Droit de timbre
                        </td>
                      </tr>
                      {results.timbreCH > 0 && (
                        <tr>
                          <td className="py-1.5 text-[#5C6880] pl-3">
                            Titres suisses (0.075% × {fmt(num('transactionsCH'))})
                          </td>
                          <td className="py-1.5 text-right font-mono text-red-600 dark:text-red-400">
                            −{fmt(results.timbreCH)}
                          </td>
                        </tr>
                      )}
                      {results.timbreETR > 0 && (
                        <tr>
                          <td className="py-1.5 text-[#5C6880] pl-3">
                            Titres étrangers (0.15% × {fmt(num('transactionsETR'))})
                          </td>
                          <td className="py-1.5 text-right font-mono text-red-600 dark:text-red-400">
                            −{fmt(results.timbreETR)}
                          </td>
                        </tr>
                      )}

                      {/* Impôt anticipé */}
                      {results.impotAnticipe > 0 && (
                        <>
                          <tr>
                            <td colSpan={2} className="py-2 text-xs font-semibold text-[#5C6880] uppercase tracking-wider pt-4">
                              Impôt anticipé (35%)
                            </td>
                          </tr>
                          <tr>
                            <td className="py-1.5 text-[#5C6880] pl-3">
                              Retenu à la source sur div. CH
                            </td>
                            <td className="py-1.5 text-right font-mono text-red-600 dark:text-red-400">
                              −{fmt(results.impotAnticipe)}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-1.5 text-[#5C6880] pl-3">
                              Remboursé après déclaration ✓
                            </td>
                            <td className="py-1.5 text-right font-mono text-[#2B6B5A]">
                              +{fmt(results.impotAnticipe)}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-1.5 text-xs text-[#9E9A93] italic pl-3" colSpan={2}>
                              Impact net = 0 (flux de trésorerie différé d'un an)
                            </td>
                          </tr>
                        </>
                      )}

                      {/* Impôt sur dividendes */}
                      {results.divImposables > 0 && (
                        <>
                          <tr>
                            <td colSpan={2} className="py-2 text-xs font-semibold text-[#5C6880] uppercase tracking-wider pt-4">
                              Impôt sur le revenu des dividendes
                            </td>
                          </tr>
                          <tr>
                            <td className="py-1.5 text-[#5C6880] pl-3">
                              Dividendes imposables
                            </td>
                            <td className="py-1.5 text-right font-mono font-medium">
                              {fmt(results.divImposables)}
                            </td>
                          </tr>
                          {results.ifdSurDiv > 0 && (
                            <tr>
                              <td className="py-1.5 text-[#5C6880] pl-3">
                                IFD fédéral (taux marginal progressif)
                              </td>
                              <td className="py-1.5 text-right font-mono text-red-600 dark:text-red-400">
                                −{fmt(results.ifdSurDiv)}
                              </td>
                            </tr>
                          )}
                          <tr>
                            <td className="py-1.5 text-[#5C6880] pl-3">
                              Cantonal + communal {canton} ({results.cantonTaux}%)
                            </td>
                            <td className="py-1.5 text-right font-mono text-red-600 dark:text-red-400">
                              −{fmt(results.impotCantonal)}
                            </td>
                          </tr>
                        </>
                      )}

                      {/* Total */}
                      <tr className="border-t-2 border-[#1B3050] dark:border-[#2a3f52]">
                        <td className="py-3 font-semibold">Charge fiscale totale</td>
                        <td className="py-3 text-right font-mono font-bold text-red-600 dark:text-red-400">
                          −{fmt(results.coutTotal)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Comparaison cantons */}
                <div className="bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-6">
                  <h3 className="text-sm font-semibold mb-4">
                    Impact du canton sur vos dividendes
                    {results.divImposables > 0 && (
                      <span className="text-xs font-normal text-[#9E9A93] ml-2">
                        pour {fmt(results.divImposables)} de dividendes
                      </span>
                    )}
                  </h3>

                  {results.divImposables > 0 ? (
                    <div className="space-y-1.5">
                      {[...CANTONS]
                        .sort((a, b) => a.taux - b.taux)
                        .map(c => {
                          const impot = results.divImposables * (c.taux / 100)
                          const isSelected = c.code === canton
                          const max = results.divImposables * 0.44
                          return (
                            <div
                              key={c.code}
                              className={`flex items-center gap-3 rounded-lg px-3 py-1.5 cursor-pointer transition-colors ${
                                isSelected ? 'bg-[#2B6B5A]/10 border border-[#2B6B5A]/30' : 'hover:bg-[#F5F3EF] dark:hover:bg-[#1B2D3E]'
                              }`}
                              onClick={() => setCanton(c.code)}
                            >
                              <span className="text-xs font-mono w-6 text-[#9E9A93]">{c.code}</span>
                              <div className="flex-1 h-1.5 rounded-full bg-[#F5F3EF] dark:bg-[#0F1E2C]">
                                <div
                                  className="h-1.5 rounded-full transition-all"
                                  style={{
                                    width: `${(impot / max) * 100}%`,
                                    backgroundColor: isSelected ? '#2B6B5A' : '#DDD9D1',
                                  }}
                                />
                              </div>
                              <span className={`text-xs font-mono w-20 text-right ${isSelected ? 'text-[#2B6B5A] font-semibold' : 'text-[#5C6880]'}`}>
                                {fmt(impot)}
                              </span>
                            </div>
                          )
                        })}
                    </div>
                  ) : (
                    <p className="text-sm text-[#9E9A93]">Entrez vos dividendes pour voir la comparaison.</p>
                  )}
                </div>

                {/* Note légale */}
                <p className="text-xs text-[#9E9A93] px-1">
                  ⚠️ Estimation à titre indicatif basée sur les barèmes 2024. Les taux cantonaux sont des moyennes pour le chef-lieu.
                  Consultez un conseiller fiscal pour votre situation précise.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
