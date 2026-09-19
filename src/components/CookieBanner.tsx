'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      const consent = localStorage.getItem('finveria_cookie_consent')
      if (!consent) setVisible(true)
    } catch {}
  }, [])

  function accept() {
    try { localStorage.setItem('finveria_cookie_consent', 'accepted') } catch {}
    setVisible(false)
  }

  function decline() {
    try { localStorage.setItem('finveria_cookie_consent', 'declined') } catch {}
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      padding: '16px',
      display: 'flex',
      justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--finv-card)',
        border: '1px solid var(--finv-border)',
        borderRadius: '12px',
        boxShadow: '0 -2px 24px rgba(0,0,0,0.12)',
        padding: '16px 20px',
        maxWidth: 680,
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        flexWrap: 'wrap',
      }}>
        {/* Icône */}
        <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>🍪</span>

        {/* Texte */}
        <p style={{ flex: 1, fontSize: '0.875rem', color: 'var(--finv-slate)', lineHeight: 1.5, margin: 0, minWidth: 200 }}>
          Finveria utilise des cookies strictement nécessaires au bon fonctionnement du site (session, thème).
          Aucun cookie publicitaire.{' '}
          <Link href="/cookies" style={{ color: 'var(--finv-green, #2B6B5A)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
            En savoir plus
          </Link>
        </p>

        {/* Boutons */}
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <button
            onClick={decline}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid var(--finv-border)',
              background: 'transparent',
              color: 'var(--finv-slate)',
              fontSize: '0.85rem',
              cursor: 'pointer',
              fontWeight: 500,
              whiteSpace: 'nowrap',
            }}
          >
            Refuser
          </button>
          <button
            onClick={accept}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: 'none',
              background: '#2B6B5A',
              color: 'white',
              fontSize: '0.85rem',
              cursor: 'pointer',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            Accepter
          </button>
        </div>
      </div>
    </div>
  )
}
