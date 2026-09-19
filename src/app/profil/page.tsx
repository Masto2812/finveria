'use client'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Profile = {
  prenom: string
  nom: string
  email: string
  theme: string
  notifications: boolean
}

type InvProfile = {
  horizon: number      // 1–30 ans
  loss: number         // % perte acceptable : 10 | 20 | 30 | 50
  liquidity: string    // 'haute' | 'moyenne' | 'faible'
  objective: string    // 'inflation' | 'modéré' | 'croissance' | 'agressif'
}

const PROFIL_TABS = [
  { id: 'info',        label: 'Informations' },
  { id: 'investisseur', label: 'Profil' },
  { id: 'prefs',       label: 'Préférences' },
  { id: 'compte',      label: 'Compte' },
  { id: 'plan',        label: 'Abonnement' },
] as const

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium border transition-colors text-center ${active ? 'bg-[#2B6B5A] text-white border-[#2B6B5A]' : 'border-[#DDD9D1] dark:border-[#1e3347] text-[#5C6880] hover:border-[#2B6B5A]'}`}>
      {children}
    </button>
  )
}

export default function ProfilPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])

  const [user, setUser] = useState<{ id: string; email?: string; user_metadata?: Record<string, string> } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeTab, setActiveTab] = useState<'info' | 'prefs' | 'compte' | 'plan' | 'investisseur'>(
    (searchParams.get('tab') as 'info' | 'prefs' | 'compte' | 'plan' | 'investisseur') || 'info'
  )
  const [profile, setProfile] = useState<Profile>({
    prenom: '', nom: '', email: '', theme: 'system', notifications: true,
  })
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)

  // ── Profil investisseur ──────────────────────────────────────────────────────
  const [invProfile, setInvProfile] = useState<InvProfile>({
    horizon: 10, loss: 25, liquidity: 'moyenne', objective: 'modéré',
  })
  const [invSaving, setInvSaving] = useState(false)
  const [invSaved, setInvSaved] = useState(false)
  const [invError, setInvError] = useState('')
  const [invLoading, setInvLoading] = useState(false)
  const [savedInvProfile, setSavedInvProfile] = useState<InvProfile>({
    horizon: 10, loss: 25, liquidity: 'moyenne', objective: 'modéré',
  })
  const [showUnsavedModal, setShowUnsavedModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [editingEmail, setEditingEmail] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailMsg, setEmailMsg] = useState('')
  const [emailError, setEmailError] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [notifSaving, setNotifSaving] = useState(false)
  const [notifError, setNotifError] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [cropModal, setCropModal] = useState(false)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [cropScale, setCropScale] = useState(1)
  const [cropFitScale, setCropFitScale] = useState(1)
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 })
  const [dragStart, setDragStart] = useState<{ mx: number; my: number; ox: number; oy: number } | null>(null)
  const cropCanvasRef = useRef<HTMLCanvasElement>(null)
  const cropImgRef = useRef<HTMLImageElement | null>(null)
  const pendingNavRef = useRef<string | null>(null)

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(invProfile) !== JSON.stringify(savedInvProfile),
    [invProfile, savedInvProfile]
  )

  useEffect(() => {
    try {
      const stored = localStorage.getItem('finveria_theme')
      if (stored) setProfile(p => ({ ...p, theme: stored }))
    } catch {}
    supabase.auth.getUser().then(({ data }: { data: { user: { id: string; email?: string; user_metadata?: Record<string,string> } | null } }) => {
      const u = data.user
      if (!u) { router.push('/login'); return }
      setUser(u)
      const fullName: string = u.user_metadata?.full_name ?? ''
      const parts = fullName.trim().split(' ')
      const prenom = parts[0] ?? ''
      const nom = parts.slice(1).join(' ')
      const notifEnabled = (u.user_metadata?.notifications_email as unknown) !== false
      setProfile(p => ({ ...p, email: u.email ?? '', prenom: p.prenom || prenom, nom: p.nom || nom, notifications: notifEnabled }))
      // Load avatar from user_metadata
      const avatarPath = u.user_metadata?.avatar_url
      if (avatarPath) {
        const { data } = supabase.storage.from('avatars').getPublicUrl(avatarPath)
        if (data?.publicUrl) setAvatarUrl(data.publicUrl)
      }
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
          const loaded = {
            horizon: data.horizon ?? 10,
            loss: data.loss ?? 25,
            liquidity: data.liquidity ?? 'moyenne',
            objective: data.objective ?? 'modéré',
          }
          setInvProfile(loaded)
          setSavedInvProfile(loaded)
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

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !user) return
    if (file.size > 10 * 1024 * 1024) { alert('La photo doit faire moins de 10 Mo.'); return }
    if (!file.type.startsWith('image/')) { alert('Format invalide. Utilisez JPG, PNG ou WEBP.'); return }
    const reader = new FileReader()
    reader.onload = ev => {
      const src = ev.target?.result as string
      const img = new Image()
      img.onload = () => {
        cropImgRef.current = img
        // Scale that makes the image fill the circle snugly (cover)
        const SIZE = 280
        const fit = Math.max(SIZE / img.naturalWidth, SIZE / img.naturalHeight)
        setCropFitScale(fit)
        setCropScale(fit)
        setCropSrc(src)
        setCropOffset({ x: 0, y: 0 })
        setCropModal(true)
      }
      img.src = src
    }
    reader.readAsDataURL(file)
  }

  function drawCrop() {
    const canvas = cropCanvasRef.current
    const img = cropImgRef.current
    if (!canvas || !img) return
    const SIZE = 280
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, SIZE, SIZE)
    // Draw image
    const scale = cropScale
    const iw = img.naturalWidth * scale
    const ih = img.naturalHeight * scale
    const dx = SIZE / 2 - iw / 2 + cropOffset.x
    const dy = SIZE / 2 - ih / 2 + cropOffset.y
    ctx.drawImage(img, dx, dy, iw, ih)
    // Dark overlay outside circle
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.fillRect(0, 0, SIZE, SIZE)
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    // Circle border
    ctx.strokeStyle = '#2B6B5A'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 4, 0, Math.PI * 2)
    ctx.stroke()
  }

  async function handleCropConfirm() {
    const img = cropImgRef.current
    if (!img || !user) return
    setAvatarUploading(true)
    setCropModal(false)
    // Render final 400x400 crop to offscreen canvas
    const OUT = 400
    const SIZE = 280
    const off = document.createElement('canvas')
    off.width = OUT; off.height = OUT
    const ctx = off.getContext('2d')!
    const scale = (OUT / SIZE) * cropScale
    const iw = img.naturalWidth * scale
    const ih = img.naturalHeight * scale
    const dx = OUT / 2 - iw / 2 + cropOffset.x * (OUT / SIZE)
    const dy = OUT / 2 - ih / 2 + cropOffset.y * (OUT / SIZE)
    // Clip circle
    ctx.beginPath()
    ctx.arc(OUT / 2, OUT / 2, OUT / 2, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(img, dx, dy, iw, ih)
    off.toBlob(async blob => {
      if (!blob) { setAvatarUploading(false); return }
      const path = `${user.id}/avatar.jpg`
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
      if (upErr) { alert('Erreur upload : ' + upErr.message); setAvatarUploading(false); return }
      await supabase.auth.updateUser({ data: { avatar_url: path } })
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      if (data?.publicUrl) setAvatarUrl(data.publicUrl + '?t=' + Date.now())
      setAvatarUploading(false)
    }, 'image/jpeg', 0.9)
  }

  async function handleToggleNotif(enabled: boolean) {
    setNotifSaving(true)
    setNotifError('')
    setProfile(p => ({ ...p, notifications: enabled }))
    const res = await fetch('/api/notifications/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    })
    const json = await res.json()
    setNotifSaving(false)
    if (!res.ok || json.error) {
      setNotifError('Erreur, réessayez.')
      setProfile(p => ({ ...p, notifications: !enabled }))
    }
  }

  function applyTheme(t: string) {
    const html = document.documentElement
    if (t === 'dark') {
      html.classList.add('dark')
    } else if (t === 'light') {
      html.classList.remove('dark')
    } else {
      // system
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      html.classList.toggle('dark', prefersDark)
    }
    try { localStorage.setItem('finveria_theme', t) } catch {}
  }

  function handleSavePrefs() {
    applyTheme(profile.theme)
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
      setSavedInvProfile(invProfile)
      setTimeout(() => setInvSaved(false), 2500)
    } catch (e) {
      console.error('[InvProfile] unexpected error:', e)
      setInvError('Erreur réseau, réessayez.')
      setInvSaving(false)
    }
  }

  // Redraw crop canvas when scale or offset changes
  useEffect(() => {
    if (cropModal) drawCrop()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cropScale, cropOffset, cropModal])

  // Warn on browser refresh/close
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasUnsavedChanges])

  const navigateSafely = useCallback((href: string) => {
    if (hasUnsavedChanges) {
      pendingNavRef.current = href
      setShowUnsavedModal(true)
    } else {
      router.push(href)
    }
  }, [hasUnsavedChanges, router])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--finv-bg)]">
      <div className="w-6 h-6 border-2 border-[#2B6B5A] border-t-transparent rounded-full animate-spin" />
    </div>
  )



  // ── Helpers UI ───────────────────────────────────────────────────────────────
  const inputCls = 'w-full px-3 py-2 rounded-lg border border-[#DDD9D1] dark:border-[#1e3347] bg-[#F5F3EF] dark:bg-[#1B2D3E] text-[#1B3050] dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#2B6B5A]'

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--finv-bg)', color: 'var(--finv-text)', fontFamily: "'Inter', system-ui, sans-serif" }}>

      <Header />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()} title="Changer la photo de profil">
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              <div className="w-14 h-14 rounded-full bg-[#2B6B5A] flex items-center justify-center text-white text-xl font-bold select-none overflow-hidden">
                {avatarUploading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  profile.prenom ? profile.prenom[0].toUpperCase() : (user?.email?.[0].toUpperCase() ?? '?')
                )}
              </div>
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </div>
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
        <div className="flex gap-1 mb-6 bg-[#F5F3EF] dark:bg-[#1B2D3E] rounded-xl p-1 overflow-x-auto border border-[#DDD9D1] dark:border-transparent">
          {PROFIL_TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex-1 py-2.5 px-3 rounded-lg text-[13px] font-medium transition-all whitespace-nowrap ${activeTab === t.id ? 'bg-white dark:bg-[#0F1E2C] text-[#1B3050] dark:text-[#E8E4DC] shadow-sm border border-[#DDD9D1] dark:border-[#2a3f52]' : 'text-[#9E9A93] hover:text-[#5C6880] dark:hover:text-[#A8B8C8]'}`}>
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
                {!editingEmail ? (
                  <div className="flex items-center gap-3">
                    <input value={profile.email} disabled
                      className="flex-1 px-3 py-2 rounded-lg border border-[#DDD9D1] dark:border-[#1e3347] bg-[#F5F3EF] dark:bg-[#1B2D3E] text-[#9E9A93] text-sm cursor-not-allowed" />
                    <button type="button" onClick={() => { setNewEmail(''); setEmailMsg(''); setEmailError(''); setEditingEmail(true) }}
                      className="px-3 py-2 text-xs font-medium text-[#2B6B5A] border border-[#2B6B5A] rounded-lg hover:bg-[#2B6B5A] hover:text-white transition-colors whitespace-nowrap">
                      Modifier
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="email"
                      value={newEmail}
                      onChange={e => { setNewEmail(e.target.value); setEmailError('') }}
                      placeholder="nouveau@email.com"
                      className={inputCls}
                      autoFocus
                    />
                    {emailError && <p className="text-xs text-red-500">{emailError}</p>}
                    {emailMsg && <p className="text-xs text-[#2B6B5A]">{emailMsg}</p>}
                    <div className="flex items-center gap-2 pt-1">
                      <button type="button"
                        disabled={emailSending}
                        onClick={async () => {
                          if (!newEmail.trim()) { setEmailError('Veuillez saisir un email.'); return }
                          if (newEmail.trim() === profile.email) { setEmailError('C\'est déjà votre email actuel.'); return }
                          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())) { setEmailError('Format d\'email invalide.'); return }
                          setEmailSending(true)
                          const { error } = await supabase.auth.updateUser({ email: newEmail.trim() })
                          setEmailSending(false)
                          if (error) { setEmailError(error.message); return }
                          setEmailMsg(`Un email de confirmation a été envoyé à ${newEmail.trim()}. Cliquez sur le lien pour valider le changement.`)
                          setEditingEmail(false)
                        }}
                        className="px-4 py-2 bg-[#2B6B5A] hover:bg-[#225549] disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors">
                        {emailSending ? 'Envoi…' : 'Confirmer'}
                      </button>
                      <button type="button"
                        onClick={() => { setEditingEmail(false); setEmailError(''); setEmailMsg('') }}
                        className="px-4 py-2 text-xs font-medium text-[#5C6880] border border-[#DDD9D1] dark:border-[#1e3347] rounded-lg hover:border-[#5C6880] transition-colors">
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
                {emailMsg && !editingEmail && <p className="text-xs text-[#2B6B5A] mt-1">{emailMsg}</p>}
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
                        { val: 'haute',   label: 'Court terme', sub: 'Besoin de récupérer les fonds dans 1–3 ans' },
                        { val: 'moyenne', label: 'Moyen terme', sub: 'Horizon de 3–7 ans' },
                        { val: 'faible',  label: 'Long terme',  sub: 'Pas de besoin avant 7+ ans' },
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
                        { val: 'inflation',  label: 'Sécurisé',   sub: 'Préserver le capital contre l\'inflation, ~2–3 %/an' },
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
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={handleSaveInvProfile}
                        disabled={invSaving || !user}
                        className="px-5 py-2 bg-[#2B6B5A] hover:bg-[#225549] disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
                        {invSaving ? 'Enregistrement…' : 'Enregistrer le profil'}
                      </button>
                      {invSaved && <span className="text-sm text-[#2B6B5A] font-medium">✓ Sauvegardé</span>}
                    </div>
                    <button type="button" onClick={() => navigateSafely('/portfolio')}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#DDD9D1] dark:border-[#1e3347] text-sm font-medium text-[#5C6880] dark:text-[#7B8DA6] hover:border-[#2B6B5A] hover:text-[#2B6B5A] transition-colors">
                      Aller vers le portfolio
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
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
                <label className="block text-xs font-medium text-[#5C6880] mb-2">Thème</label>
                <div className="flex gap-2">
                  {[{ id: 'light', label: 'Clair' }, { id: 'dark', label: 'Sombre' }, { id: 'system', label: 'Système' }].map(t => (
                    <Chip key={t.id} active={profile.theme === t.id} onClick={() => setProfile(p => ({ ...p, theme: t.id }))}>{t.label}</Chip>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 py-3 border-t border-[#DDD9D1] dark:border-[#1e3347]">
                <div>
                  <p className="text-sm font-medium text-[#1B3050] dark:text-white">Notifications par email</p>
                  <p className="text-xs text-[#9E9A93] mt-0.5">
                    {profile.notifications ? 'Alertes et nouveautés Finveria activées' : 'Désactivées — aucun email ne sera envoyé'}
                  </p>
                  {notifError && <p className="text-xs text-red-500 mt-0.5">{notifError}</p>}
                </div>
                <button
                  type="button"
                  disabled={notifSaving}
                  onClick={() => handleToggleNotif(!profile.notifications)}
                  className={`flex-shrink-0 relative w-11 h-6 rounded-full transition-colors duration-200 ${profile.notifications ? 'bg-[#2B6B5A]' : 'bg-[#DDD9D1] dark:bg-[#2a3f52]'} ${notifSaving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  title={profile.notifications ? 'Désactiver les notifications' : 'Activer les notifications'}
                >
                  <span className={`absolute left-0 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${profile.notifications ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
              <button onClick={handleSavePrefs}
                className="px-5 py-2 bg-[#2B6B5A] hover:bg-[#225549] text-white text-sm font-semibold rounded-lg transition-colors">
                Enregistrer les préférences
              </button>
              {saved && <span className="ml-3 text-sm text-[#2B6B5A] font-medium">✓ Sauvegardé</span>}
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
                <button onClick={() => { setDeleteConfirm(''); setDeleteError(''); setShowDeleteModal(true) }}
                  className="px-5 py-2 border border-red-400 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium rounded-lg transition-colors">
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

      {/* ── Modal suppression de compte ── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#162534] rounded-2xl border border-[#DDD9D1] dark:border-[#1e3347] p-6 w-full max-w-sm mx-4 shadow-xl">
            <h3 className="text-base font-semibold text-red-500 mb-2">Supprimer mon compte</h3>
            <p className="text-sm text-[#5C6880] dark:text-[#7B8DA6] mb-4">
              Cette action est <strong>irréversible</strong>. Toutes vos données seront définitivement supprimées : portfolio, profil investisseur, préférences.
            </p>
            <p className="text-xs text-[#9E9A93] mb-2">Tapez <strong>SUPPRIMER</strong> pour confirmer :</p>
            <input
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder="SUPPRIMER"
              className="w-full px-3 py-2 rounded-lg border border-[#DDD9D1] dark:border-[#1e3347] bg-white dark:bg-[#1B2D3E] text-sm text-[#1B3050] dark:text-white mb-4 focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            {deleteError && <p className="text-sm text-red-500 mb-3">{deleteError}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2 rounded-lg border border-[#DDD9D1] dark:border-[#1e3347] text-sm font-medium text-[#5C6880] hover:text-[#1B3050] dark:hover:text-white transition-colors">
                Annuler
              </button>
              <button
                disabled={deleteConfirm !== 'SUPPRIMER' || deleting}
                onClick={async () => {
                  setDeleting(true)
                  setDeleteError('')
                  try {
                    const res = await fetch('/api/delete-account', { method: 'DELETE' })
                    if (!res.ok) {
                      const json = await res.json()
                      setDeleteError(json.error ?? 'Une erreur est survenue.')
                      setDeleting(false)
                      return
                    }
                    router.push('/')
                  } catch {
                    setDeleteError('Erreur réseau. Réessayez.')
                    setDeleting(false)
                  }
                }}
                className="flex-1 py-2 rounded-lg bg-red-500 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors">
                {deleting ? 'Suppression…' : 'Supprimer définitivement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal recadrage avatar ── */}
      {cropModal && cropSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#162534] rounded-2xl border border-[#DDD9D1] dark:border-[#1e3347] p-6 w-full max-w-sm mx-4 shadow-xl">
            <h3 className="text-base font-semibold text-[#1B3050] dark:text-white mb-1">Ajuster la photo</h3>
            <p className="text-xs text-[#9E9A93] mb-4">Glissez l'image pour la repositionner</p>
            {/* Canvas crop */}
            <div className="flex justify-center mb-4">
              <canvas
                ref={el => { (cropCanvasRef as React.MutableRefObject<HTMLCanvasElement | null>).current = el; if (el) setTimeout(drawCrop, 0) }}
                width={280} height={280}
                className="rounded-xl cursor-grab active:cursor-grabbing select-none"
                style={{ touchAction: 'none' }}
                onMouseDown={e => setDragStart({ mx: e.clientX, my: e.clientY, ox: cropOffset.x, oy: cropOffset.y })}
                onMouseMove={e => {
                  if (!dragStart) return
                  const nx = dragStart.ox + (e.clientX - dragStart.mx)
                  const ny = dragStart.oy + (e.clientY - dragStart.my)
                  setCropOffset({ x: nx, y: ny })
                  drawCrop()
                }}
                onMouseUp={() => setDragStart(null)}
                onMouseLeave={() => setDragStart(null)}
                onTouchStart={e => { const t = e.touches[0]; setDragStart({ mx: t.clientX, my: t.clientY, ox: cropOffset.x, oy: cropOffset.y }) }}
                onTouchMove={e => {
                  if (!dragStart) return
                  const t = e.touches[0]
                  const nx = dragStart.ox + (t.clientX - dragStart.mx)
                  const ny = dragStart.oy + (t.clientY - dragStart.my)
                  setCropOffset({ x: nx, y: ny })
                  drawCrop()
                }}
                onTouchEnd={() => setDragStart(null)}
              />
            </div>
            {/* Zoom slider */}
            <div className="flex items-center gap-3 mb-6">
              <span className="text-lg text-[#9E9A93]">🔍</span>
              <input type="range" min={cropFitScale * 0.4} max={cropFitScale * 4} step={cropFitScale * 0.02} value={cropScale}
                onChange={e => { setCropScale(parseFloat(e.target.value)); drawCrop() }}
                className="flex-1 accent-[#2B6B5A]" />
              <span className="text-xs text-[#9E9A93] w-8 text-right">{Math.round(cropScale * 100)}%</span>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => { setCropModal(false); setCropSrc(null) }}
                className="flex-1 py-2 rounded-lg border border-[#DDD9D1] dark:border-[#1e3347] text-sm font-medium text-[#5C6880] hover:text-[#1B3050] dark:hover:text-white transition-colors">
                Annuler
              </button>
              <button type="button" onClick={handleCropConfirm}
                className="flex-1 py-2 rounded-lg bg-[#2B6B5A] hover:bg-[#225549] text-white text-sm font-semibold transition-colors">
                Valider
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal modifications non sauvegardées ── */}
      {showUnsavedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#162534] rounded-2xl border border-[#DDD9D1] dark:border-[#1e3347] p-6 w-full max-w-sm mx-4 shadow-xl">
            <h3 className="text-base font-semibold text-[#1B3050] dark:text-white mb-2">Modifications non sauvegardées</h3>
            <p className="text-sm text-[#5C6880] dark:text-[#7B8DA6] mb-6">
              Vous avez des modifications non enregistrées sur votre profil. Voulez-vous les sauvegarder avant de quitter ?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowUnsavedModal(false)
                  if (pendingNavRef.current) router.push(pendingNavRef.current)
                }}
                className="flex-1 py-2 rounded-lg border border-[#DDD9D1] dark:border-[#1e3347] text-sm font-medium text-[#5C6880] hover:text-[#1B3050] dark:hover:text-white transition-colors">
                Quitter sans sauvegarder
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowUnsavedModal(false)
                  await handleSaveInvProfile()
                  if (pendingNavRef.current) router.push(pendingNavRef.current)
                }}
                className="flex-1 py-2 rounded-lg bg-[#2B6B5A] hover:bg-[#225549] text-white text-sm font-semibold transition-colors">
                Sauvegarder et quitter
              </button>
            </div>
            <button
              type="button"
              onClick={() => { setShowUnsavedModal(false); pendingNavRef.current = null }}
              className="mt-3 w-full py-2 text-xs text-[#9E9A93] hover:text-[#5C6880] transition-colors">
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
