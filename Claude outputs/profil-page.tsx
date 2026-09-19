'use client'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Profile = {
  prenom: string
  nom: string
  email: string
  devise: string
  theme: string
  notifications: boolean
}

type InvProfile = {
  horizon: number      // 1–30 ans
  loss: number         // % perte acceptable : 10 | 20 | 30 | 50
  liquidity: string    // 'court' | 'moyen' | 'long'
  objective: string    // 'sécurisé' | 'modéré' | 'croissance' | 'agressif'
}

export default function ProfilPage() {
  const router = useRouter()
  const supabase = createClient()

  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeTab, setActiveTab] = useState<'info' | 'prefs' | 'compte' | 'plan' | 'investisseur'>('info')
  const [profile, setProfile] = useState<Profile>({
    prenom: '', nom: '', email: '', devise: 'CHF', theme: 'system', notifications: true,
  })
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)

  // ── Profil investisseur ──────────────────────────────────────────────────────
  const [invProfile, setInvProfile] = useState<InvProfile>({
    horizon: 10, loss: 25, liquidity: 'moyen', objective: 'modéré',
  })
  const [invSaving, setInvSaving] = useState(false)
  const [invSaved, setInvSaved] = useState(false)
  const [invError, setInvError] = useState('')
  const [invLoading, setInvLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }: { data: { user: { id: string; email?: string } | null } }) => {
      const u = data.user
      if (!u) { router.push('/login'); return }
      setUser(u)
      setProfile(p => ({ ...p, email: u.email ?? '' }))
      setLoading(false)
    })
  }, [])

  // Charger le profil investisseur dès que l'utilisateur est connu
  useEffect(() => {
    if (!user) return
    setInvLoading(true)
    fetch('/api/investor-profile')
      .then(r => r.json())
      .then(({ data, error }) => {
        if (error) {
          console.warn('[InvProfile] load error:', error)
        } else if (data) {
          setInvProfile({
            horizon: data.horizon ?? 10,
            loss: data.loss ?? 25,
            liquidity: data.liquidity ?? 'moyen',
            objective: data.objective ?? 'modéré',
          })
        }
      })
      .catch(e => console.warn('[InvProfile] fetch error:', e))
      .finally(() => setInvLoading(false))
  }, [user])

  async function handleSaveInfo(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await new Promise(r => setTimeout(r, 600))
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwError(''); setPwSuccess(false)
    if (newPassword.length < 8) { setPwError('Le mot de passe doit contenir au moins 8 caractères.'); return }
    if (newPassword !== confirmPassword) { setPwError('Les mots de passe ne correspondent pas.'); return }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) { setPwError(error.message); return }
    setPwSuccess(true)
    setNewPassword(''); setConfirmPassword('')
  }

  async function handleSaveInvProfile() {
    setInvSaving(true)
    setInvError('')
    try {
      const res = await fetch('/api/investor-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invProfile),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        const msg = json.error || json.details || json.hint || `Erreur ${res.status}`
        console.error('[InvProfile] save error:', json)
        setInvError(msg)
        setInvSaving(false)
        return
      }
      setInvSaving(false)
      setInvSaved(true)
      setTimeout(() => setInvSaved(false), 2500)
    } catch (e) {
      console.error('[InvProfile] unexpected error:', e)
      setInvError('Erreur réseau, réessayez.')
      setInvSaving(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--finv-bg)]">
      <div className="w-6 h-6 border-2 border-[#2B6B5A] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const tabs = [
    { id: 'info',        label: 'Informations' },
    { id: 'investisseur', label: 'Profil inv.' },
    { id: 'prefs',       label: 'Préférences' },
    { id: 'compte',      label: 'Compte' },
    { id: 'plan',        label: 'Abonnement' },
  ] as const

  // ── Helpers UI ───────────────────────────────────────────────────────────────
  const inputCls = 'w-full px-3 py-2 rounded-lg border border-[#DDD9D1] dark:border-[#1e3347] bg-[#F5F3EF] dark:bg-[#1B2D3E] text-[#1B3050] dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#2B6B5A]'

  function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
      <button type="button" onClick={onClick}
        className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium border transition-colors text-center ${active ? 'bg-[#2B6B5A] text-white border-[#2B6B5A]' : 'border-[#DDD9D1] dark:border-[#1e3347] text-[#5C6880] hover:border-[#2B6B5A]'}`}>
        {children}
      </button>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--finv-bg)', color: 'var(--finv-text)', fontFamily: "'Inter', system-ui, sans-serif" }}>

      <Header />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#2B6B5A] flex items-center justify-center text-white text-xl font-bold select-none">
              {profile.prenom ? profile.prenom[0].toUpperCase() : (user?.email?.[0].toUpperCase() ?? '?')}
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#1B3050] dark:text-white">
                {profile.prenom || profile.nom ? `${profile.prenom} ${profile.nom}`.trim() : 'Mon profil'}
              </h1>
              <p className="text-sm text-[#9E9A93]">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-[#F5F3EF] dark:bg-[#1B2D3E] rounded-lg p-1 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap px-1 ${activeTab === t.id ? 'bg-white dark:bg-[#162534] text-[#1B3050] dark:text-white shadow-sm' : 'text-[#9E9A93] hover:text-[#5C6880]'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Panel */}
        <div className="bg-white dark:bg-[#162534] rounded-xl border border-[#DDD9D1] dark:border-[#1e3347] p-6">

          {/* ── Informations personnelles ── */}
          {activeTab === 'info' && (
            <form onSubmit={handleSaveInfo} className="space-y-5">
              <h2 className="text-base font-semibold text-[#1B3050] dark:text-white mb-4">Informations personnelles</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#5C6880] mb-1.5">Prénom</label>
                  <input value={profile.prenom} onChange={e => setProfile(p => ({ ...p, prenom: e.target.value }))}
                    placeholder="Jean" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5C6880] mb-1.5">Nom</label>
                  <input value={profile.nom} onChange={e => setProfile(p => ({ ...p, nom: e.target.value }))}
                    placeholder="Dupont" className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#5C6880] mb-1.5">Email</label>
                <input value={profile.email} disabled
                  className="w-full px-3 py-2 rounded-lg border border-[#DDD9D1] dark:border-[#1e3347] bg-[#F5F3EF] dark:bg-[#1B2D3E] text-[#9E9A93] text-sm cursor-not-allowed" />
                <p className="text-xs text-[#9E9A93] mt-1">L'email ne peut pas être modifié ici.</p>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button type="submit" disabled={saving}
                  className="px-5 py-2 bg-[#2B6B5A] hover:bg-[#225549] disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
                {saved && <span className="text-sm text-[#2B6B5A] font-medium">✓ Sauvegardé</span>}
              </div>
            </form>
          )}

          {/* ── Profil investisseur ── */}
          {activeTab === 'investisseur' && (
            <div className="space-y-7">
              <h2 className="text-base font-semibold text-[#1B3050] dark:text-white">Profil d'investisseur</h2>
              <p className="text-xs text-[#9E9A93] -mt-4">Ces informations personnalisent votre simulation Monte Carlo dans le portefeuille.</p>

              {invLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-5 h-5 border-2 border-[#2B6B5A] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  {/* Q1 – Horizon */}
                  <div>
                    <label className="block text-xs font-medium text-[#5C6880] mb-3">
                      Horizon de placement — <span className="text-[#2B6B5A] font-semibold">{invProfile.horizon} ans</span>
                    </label>
                    <input type="range" min={1} max={30} value={invProfile.horizon}
                      onChange={e => setInvProfile(p => ({ ...p, horizon: Number(e.target.value) }))}
                      className="w-full accent-[#2B6B5A]" />
                    <div className="flex justify-between text-xs text-[#9E9A93] mt-1">
                      <span>1 an</span><span>15 ans</span><span>30 ans</span>
                    </div>
                  </div>

                  {/* Q2 – Tolérance aux pertes */}
                  <div>
                    <label className="block text-xs font-medium text-[#5C6880] mb-3">Perte maximale acceptable</label>
                    <div className="flex gap-2">
                      {[
                        { val: 10, label: '−10 %', sub: 'Très faible' },
                        { val: 20, label: '−20 %', sub: 'Faible' },
                        { val: 30, label: '−30 %', sub: 'Modérée' },
                        { val: 50, label: '−50 %', sub: 'Élevée' },
                      ].map(({ val, label, sub }) => (
                        <button key={val} type="button"
                          onClick={() => setInvProfile(p => ({ ...p, loss: val }))}
                          className={`flex-1 py-2.5 px-1 rounded-lg border text-center transition-colors ${invProfile.loss === val ? 'bg-[#2B6B5A] text-white border-[#2B6B5A]' : 'border-[#DDD9D1] dark:border-[#1e3347] text-[#5C6880] hover:border-[#2B6B5A]'}`}>
                          <div className="text-sm font-semibold">{label}</div>
                          <div className={`text-[10px] mt-0.5 ${invProfile.loss === val ? 'text-white/70' : 'text-[#9E9A93]'}`}>{sub}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Q3 – Liquidité */}
                  <div>
                    <label className="block text-xs font-medium text-[#5C6880] mb-3">Besoin de liquidité</label>
                    <div className="flex flex-col gap-2">
                      {[
                        { val: 'court',  label: 'Court terme', sub: 'Besoin de récupérer les fonds dans 1–3 ans' },
                        { val: 'moyen',  label: 'Moyen terme', sub: 'Horizon de 3–7 ans' },
                        { val: 'long',   label: 'Long terme',  sub: 'Pas de besoin avant 7+ ans' },
                      ].map(({ val, label, sub }) => (
                        <button key={val} type="button"
                          onClick={() => setInvProfile(p => ({ ...p, liquidity: val }))}
                          className={`flex items-center gap-3 py-3 px-4 rounded-lg border text-left transition-colors ${invProfile.liquidity === val ? 'bg-[#2B6B5A]/10 border-[#2B6B5A]' : 'border-[#DDD9D1] dark:border-[#1e3347] hover:border-[#2B6B5A]'}`}>
                          <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${invProfile.liquidity === val ? 'border-[#2B6B5A]' : 'border-[#DDD9D1] dark:border-[#1e3347]'}`}>
                            {invProfile.liquidity === val && <div className="w-2 h-2 rounded-full bg-[#2B6B5A]" />}
                          </div>
                          <div>
                            <div className={`text-sm font-medium ${invProfile.liquidity === val ? 'text-[#2B6B5A]' : 'text-[#1B3050] dark:text-white'}`}>{label}</div>
                            <div className="text-xs text-[#9E9A93] mt-0.5">{sub}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Q4 – Objectif */}
                  <div>
                    <label className="block text-xs font-medium text-[#5C6880] mb-3">Objectif de rendement</label>
                    <div className="flex flex-col gap-2">
                      {[
                        { val: 'sécurisé',   label: 'Sécurisé',   sub: 'Préserver le capital, rendement ~2–3 %/an' },
                        { val: 'modéré',     label: 'Modéré',     sub: 'Équilibre risque/rendement, ~5–7 %/an' },
                        { val: 'croissance', label: 'Croissance',  sub: 'Maximiser le rendement à long terme, ~8–10 %/an' },
                        { val: 'agressif',   label: 'Agressif',   sub: 'Rendement maximal, forte volatilité acceptée' },
                      ].map(({ val, label, sub }) => (
                        <button key={val} type="button"
                          onClick={() => setInvProfile(p => ({ ...p, objective: val }))}
                          className={`flex items-center gap-3 py-3 px-4 rounded-lg border text-left transition-colors ${invProfile.objective === val ? 'bg-[#2B6B5A]/10 border-[#2B6B5A]' : 'border-[#DDD9D1] dark:border-[#1e3347] hover:border-[#2B6B5A]'}`}>
                          <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${invProfile.objective === val ? 'border-[#2B6B5A]' : 'border-[#DDD9D1] dark:border-[#1e3347]'}`}>
                            {invProfile.objective === val && <div className="w-2 h-2 rounded-full bg-[#2B6B5A]" />}
                          </div>
                          <div>
                            <div className={`text-sm font-medium ${invProfile.objective === val ? 'text-[#2B6B5A]' : 'text-[#1B3050] dark:text-white'}`}>{label}</div>
                            <div className="text-xs text-[#9E9A93] mt-0.5">{sub}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Save */}
                  {invError && (
                    <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3">
                      <p className="text-sm text-red-600 dark:text-red-400">{invError}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-3 pt-1">
                    <button type="button" onClick={handleSaveInvProfile}
                      disabled={invSaving || !user}
                      className="px-5 py-2 bg-[#2B6B5A] hover:bg-[#225549] disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
                      {invSaving ? 'Enregistrement…' : 'Enregistrer le profil'}
                    </button>
                    {invSaved && <span className="text-sm text-[#2B6B5A] font-medium">✓ Sauvegardé</span>}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Préférences ── */}
          {activeTab === 'prefs' && (
            <div className="space-y-6">
              <h2 className="text-base font-semibold text-[#1B3050] dark:text-white mb-4">Préférences</h2>
              <div>
                <label className="block text-xs font-medium text-[#5C6880] mb-2">Devise d'affichage</label>
                <div className="flex gap-2">
                  {['CHF', 'EUR', 'USD'].map(d => (
                    <Chip key={d} active={profile.devise === d} onClick={() => setProfile(p => ({ ...p, devise: d }))}>{d}</Chip>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#5C6880] mb-2">Thème</label>
                <div className="flex gap-2">
                  {[{ id: 'light', label: 'Clair' }, { id: 'dark', label: 'Sombre' }, { id: 'system', label: 'Système' }].map(t => (
                    <Chip key={t.id} active={profile.theme === t.id} onClick={() => setProfile(p => ({ ...p, theme: t.id }))}>{t.label}</Chip>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between py-3 border-t border-[#DDD9D1] dark:border-[#1e3347]">
                <div>
                  <p className="text-sm font-medium text-[#1B3050] dark:text-white">Notifications par email</p>
                  <p className="text-xs text-[#9E9A93] mt-0.5">Mises à jour produit et alertes importantes</p>
                </div>
                <button onClick={() => setProfile(p => ({ ...p, notifications: !p.notifications }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${profile.notifications ? 'bg-[#2B6B5A]' : 'bg-[#DDD9D1] dark:bg-[#1e3347]'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${profile.notifications ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
              <button onClick={handleSaveInfo}
                className="px-5 py-2 bg-[#2B6B5A] hover:bg-[#225549] text-white text-sm font-semibold rounded-lg transition-colors">
                Enregistrer les préférences
              </button>
            </div>
          )}

          {/* ── Compte ── */}
          {activeTab === 'compte' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-base font-semibold text-[#1B3050] dark:text-white mb-4">Changer le mot de passe</h2>
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-[#5C6880] mb-1.5">Nouveau mot de passe</label>
                    <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                      placeholder="••••••••" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#5C6880] mb-1.5">Confirmer le mot de passe</label>
                    <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="••••••••" className={inputCls} />
                  </div>
                  {pwError && <p className="text-sm text-red-500">{pwError}</p>}
                  {pwSuccess && <p className="text-sm text-[#2B6B5A] font-medium">✓ Mot de passe mis à jour</p>}
                  <button type="submit" className="px-5 py-2 bg-[#2B6B5A] hover:bg-[#225549] text-white text-sm font-semibold rounded-lg transition-colors">
                    Mettre à jour
                  </button>
                </form>
              </div>
              <div className="border-t border-[#DDD9D1] dark:border-[#1e3347] pt-6">
                <h3 className="text-sm font-semibold text-red-500 mb-2">Zone de danger</h3>
                <p className="text-xs text-[#9E9A93] mb-4">La suppression de votre compte est irréversible. Toutes vos données seront effacées.</p>
                <button className="px-5 py-2 border border-red-400 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium rounded-lg transition-colors">
                  Supprimer mon compte
                </button>
              </div>
            </div>
          )}

          {/* ── Plan ── */}
          {activeTab === 'plan' && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-[#1B3050] dark:text-white mb-4">Abonnement</h2>
              <div className="rounded-xl border border-[#2B6B5A]/30 bg-[#2B6B5A]/5 p-5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-[#2B6B5A]">Plan Bêta — Accès anticipé</span>
                  <span className="text-xs bg-[#2B6B5A] text-white px-2 py-0.5 rounded-full font-medium">Actif</span>
                </div>
                <p className="text-xs text-[#9E9A93]">Accès complet aux 3 outils pendant 3 mois gratuits.</p>
              </div>
              <div className="text-xs text-[#9E9A93] space-y-1 pt-2">
                <p>✓ Comparateur de courtiers</p>
                <p>✓ Simulateur fiscal (26 cantons)</p>
                <p>✓ Suivi de portefeuille Premium</p>
              </div>
              <p className="text-xs text-[#9E9A93] pt-2">Les options d'abonnement payant seront disponibles à la fin de la période bêta.</p>
            </div>
          )}

        </div>
      </main>

      <Footer />
    </div>
  )
}
