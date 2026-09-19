'use client'

export default function CookieReset() {
  function reset() {
    try { localStorage.removeItem('finveria_cookie_consent') } catch {}
    window.location.reload()
  }

  return (
    <button
      onClick={reset}
      style={{
        marginTop: '1.25rem',
        padding: '9px 20px',
        borderRadius: '8px',
        border: '1px solid var(--finv-border)',
        background: 'transparent',
        color: 'var(--finv-slate)',
        fontSize: '0.875rem',
        cursor: 'pointer',
        fontWeight: 500,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
      }}
    >
      ↺ Modifier mes préférences cookies
    </button>
  )
}
