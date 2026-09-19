'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [acceptPolicy, setAcceptPolicy] = useState(false)
  const [acceptNotifications, setAcceptNotifications] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (!acceptPolicy) {
      setError('Vous devez accepter la politique de confidentialité pour continuer.')
      return
    }
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          notifications_email: acceptNotifications,
        }
      }
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/comparateur')
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid #DDD9D1',
    borderRadius: '8px',
    fontSize: '0.95rem',
    boxSizing: 'border-box' as const,
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F3EF' }}>
      <div style={{ background: 'white', padding: '2.5rem', borderRadius: '12px', width: '100%', maxWidth: '420px', boxShadow: '0 2px 20px rgba(0,0,0,0.08)' }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '1.8rem', color: '#1B3050', marginBottom: '0.5rem' }}>Créer un compte</h1>
        <p style={{ color: '#5C6880', marginBottom: '2rem', fontSize: '0.9rem' }}>Rejoignez Finveria gratuitement</p>

        <form onSubmit={handleSignup}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#1B3050', marginBottom: '0.4rem', fontWeight: 500 }}>Prénom et nom</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              style={inputStyle}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#1B3050', marginBottom: '0.4rem', fontWeight: 500 }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={inputStyle}
            />
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#1B3050', marginBottom: '0.4rem', fontWeight: 500 }}>Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
              style={inputStyle}
            />
          </div>

          {/* ── Consentements ── */}
          <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {/* Politique de confidentialité — obligatoire */}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', cursor: 'pointer' }}>
              <div style={{ position: 'relative', flexShrink: 0, marginTop: '1px' }}>
                <input
                  type="checkbox"
                  checked={acceptPolicy}
                  onChange={e => { setAcceptPolicy(e.target.checked); if (e.target.checked) setError('') }}
                  style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                />
                <div style={{
                  width: '18px', height: '18px', borderRadius: '4px',
                  border: `2px solid ${acceptPolicy ? '#2B6B5A' : '#DDD9D1'}`,
                  background: acceptPolicy ? '#2B6B5A' : 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}>
                  {acceptPolicy && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L4 7L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
              </div>
              <span style={{ fontSize: '0.85rem', color: '#1B3050', lineHeight: 1.5 }}>
                J'ai lu et j'accepte la{' '}
                <Link href="/confidentialite" target="_blank" style={{ color: '#2B6B5A', fontWeight: 600, textDecoration: 'none' }}>
                  politique de confidentialité
                </Link>
                {' '}<span style={{ color: '#c0392b', fontWeight: 600 }}>*</span>
              </span>
            </label>

            {/* Notifications email — facultatif */}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', cursor: 'pointer' }}>
              <div style={{ position: 'relative', flexShrink: 0, marginTop: '1px' }}>
                <input
                  type="checkbox"
                  checked={acceptNotifications}
                  onChange={e => setAcceptNotifications(e.target.checked)}
                  style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                />
                <div style={{
                  width: '18px', height: '18px', borderRadius: '4px',
                  border: `2px solid ${acceptNotifications ? '#2B6B5A' : '#DDD9D1'}`,
                  background: acceptNotifications ? '#2B6B5A' : 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}>
                  {acceptNotifications && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L4 7L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
              </div>
              <span style={{ fontSize: '0.85rem', color: '#5C6880', lineHeight: 1.5 }}>
                J'accepte de recevoir des notifications par email (mises à jour, conseils, actualités financières)
                {' '}<span style={{ color: '#9E9A93', fontSize: '0.8rem' }}>(facultatif)</span>
              </span>
            </label>
          </div>

          {error && <p style={{ color: '#c0392b', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '0.85rem', background: '#2B6B5A',
              color: 'white', border: 'none', borderRadius: '8px',
              fontSize: '1rem', fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Création...' : 'Créer mon compte'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem', color: '#5C6880' }}>
          Déjà un compte ?{' '}
          <Link href="/login" style={{ color: '#2B6B5A', fontWeight: 600 }}>Se connecter</Link>
        </p>
      </div>
    </main>
  )
}
