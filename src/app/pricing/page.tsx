'use client'
import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { createClient } from '@/lib/supabase/client'

const FEATURES_FREE = [
  'Comparateur de courtiers',
  'Simulateur fiscal (26 cantons)',
  'Suivi de portefeuille de base',
  'Simulation Monte Carlo',
]

const FEATURES_PREMIUM = [
  'Tout du plan Bêta',
  'Alertes de marché en temps réel',
  'Rapports fiscaux exportables (PDF)',
  'Historique illimité de portefeuille',
  "Accès prioritaire aux nouvelles fonctionnalités",
  'Support prioritaire',
]

export default function PricingPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push('/login')
      else setUser(data.user)
    })
  }, [])

  async function handleCheckout() {
    if (!user) { router.push('/login'); return }
    setLoading(true)
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID }),
    })
    const { url, error } = await res.json()
    if (error || !url) { alert('Erreur, réessayez.'); setLoading(false); return }
    window.location.href = url
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--finv-bg)', color: 'var(--finv-text)', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <Header />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-[#1B3050] dark:text-white mb-3" style={{ fontFamily: 'Georgia, serif' }}>
            Tarifs simples et transparents
          </h1>
          <p className="text-[#5C6880] dark:text-[#A8B8C8] text-base max-w-lg mx-auto">
            Pendant la bêta, tous les outils sont gratuits. Le plan Premium sera disponible à la fin de la période bêta.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Plan Beta */}
          <div className="bg-white dark:bg-[#162534] rounded-2xl border border-[#DDD9D1] dark:border-[#1e3347] p-8 flex flex-col">
            <div className="mb-6">
              <span className="inline-block text-xs font-semibold bg-[#2B6B5A]/10 text-[#2B6B5A] px-3 py-1 rounded-full mb-3">Actuel</span>
              <h2 className="text-xl font-bold text-[#1B3050] dark:text-white mb-1">Plan Bêta</h2>
              <p className="text-[#9E9A93] text-sm">Accès complet pendant la phase de test</p>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-bold text-[#1B3050] dark:text-white">0 CHF</span>
              <span className="text-[#9E9A93] text-sm ml-2">/ mois</span>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {FEATURES_FREE.map(f => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-[#5C6880] dark:text-[#A8B8C8]">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                    <circle cx="8" cy="8" r="8" fill="#2B6B5A" fillOpacity="0.12"/>
                    <path d="M5 8l2 2 4-4" stroke="#2B6B5A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            <div className="py-2.5 px-4 rounded-xl bg-[#F5F3EF] dark:bg-[#1B2D3E] text-center text-sm font-medium text-[#2B6B5A]">
              ✓ Votre plan actuel
            </div>
          </div>

          {/* Plan Premium */}
          <div className="bg-[#1B3050] dark:bg-[#0F1E2C] rounded-2xl border border-[#2B6B5A]/40 p-8 flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-[#2B6B5A]/10 -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            <div className="mb-6 relative">
              <span className="inline-block text-xs font-semibold bg-[#2B6B5A] text-white px-3 py-1 rounded-full mb-3">Bientôt disponible</span>
              <h2 className="text-xl font-bold text-white mb-1">Plan Premium</h2>
              <p className="text-[#7B8DA6] text-sm">Pour les investisseurs sérieux</p>
            </div>
            <div className="mb-6 relative">
              <span className="text-4xl font-bold text-white">14 CHF</span>
              <span className="text-[#7B8DA6] text-sm ml-2">/ mois</span>
            </div>
            <ul className="space-y-3 mb-8 flex-1 relative">
              {FEATURES_PREMIUM.map(f => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-[#A8B8C8]">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                    <circle cx="8" cy="8" r="8" fill="#2B6B5A" fillOpacity="0.25"/>
                    <path d="M5 8l2 2 4-4" stroke="#2B6B5A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            <button
              disabled
              className="w-full py-3 rounded-xl bg-[#2B6B5A] opacity-40 cursor-not-allowed text-white text-sm font-semibold"
            >
              Passer au Premium
            </button>
            <p className="text-xs text-[#7B8DA6] text-center mt-2">Disponible à la fin de la période bêta</p>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-16 max-w-2xl mx-auto">
          <h3 className="text-base font-semibold text-[#1B3050] dark:text-white mb-6 text-center">Questions fréquentes</h3>
          <div className="space-y-4">
            {[
              { q: 'Quand se termine la période bêta ?', r: 'La bêta est prévue pour 3 mois. Vous serez notifié par email avant tout changement de tarification.' },
              { q: 'Puis-je annuler à tout moment ?', r: "Oui, vous pouvez annuler votre abonnement à tout moment depuis votre profil. Vous gardez l'accès jusqu'à la fin de la période payée." },
              { q: 'Quels moyens de paiement sont acceptés ?', r: 'Toutes les cartes bancaires (Visa, Mastercard, American Express) via Stripe, la plateforme de paiement sécurisée.' },
            ].map(({ q, r }) => (
              <div key={q} className="bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-5">
                <p className="text-sm font-semibold text-[#1B3050] dark:text-white mb-1.5">{q}</p>
                <p className="text-sm text-[#5C6880] dark:text-[#A8B8C8]">{r}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
