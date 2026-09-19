'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function Header() {
  const router = useRouter()
  const [user, setUser] = useState<{ email?: string } | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Fermer le menu si on resize vers desktop
  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 768) setMenuOpen(false) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    setMenuOpen(false)
  }

  const navLinks = [
    { href: '/comparateur', label: 'Comparateur de courtiers' },
    { href: '/simulateur',  label: 'Simulateur fiscal' },
    { href: '/portfolio',   label: 'Portfolio' },
  ]

  return (
    <nav className="sticky top-0 z-50 border-b border-[#DDD9D1] dark:border-[#1e3347] bg-white dark:bg-[#162534]">
      <div className="h-14 px-4 md:px-6 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="text-lg font-bold text-[#1B3050] dark:text-white no-underline" style={{ letterSpacing: '-0.02em' }}>
          fin<span className="text-[#2B6B5A]">veria</span>
        </Link>

        {/* Nav desktop */}
        <div className="hidden md:flex items-center gap-7">
          {navLinks.map(({ href, label }) => (
            <Link key={href} href={href} className="text-sm font-medium text-[#5C6880] dark:text-[#94a3b8] no-underline hover:text-[#1B3050] dark:hover:text-white transition-colors">
              {label}
            </Link>
          ))}
          {user ? (
            <div className="flex items-center gap-3">
              <Link href="/profil" className="text-[13px] font-semibold text-white no-underline px-4 py-1.5 rounded-[7px]" style={{ background: '#2B6B5A' }}>Profil</Link>
              <button onClick={handleLogout} className="text-[13px] font-medium text-[#9E9A93] hover:text-[#5C6880] transition-colors">Déconnexion</button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link href="/login" className="text-[13px] font-medium text-[#5C6880] dark:text-[#94a3b8] no-underline hover:text-[#1B3050] dark:hover:text-white transition-colors">Connexion</Link>
              <Link href="/signup" className="text-[13px] font-semibold text-white no-underline px-4 py-1.5 rounded-[7px]" style={{ background: '#2B6B5A' }}>S&apos;inscrire</Link>
            </div>
          )}
        </div>

        {/* Hamburger mobile */}
        <button
          className="md:hidden flex flex-col justify-center items-center w-9 h-9 gap-[5px]"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Menu"
        >
          <span className={`block w-5 h-0.5 bg-[#1B3050] dark:bg-white transition-all duration-200 ${menuOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
          <span className={`block w-5 h-0.5 bg-[#1B3050] dark:bg-white transition-all duration-200 ${menuOpen ? 'opacity-0' : ''}`} />
          <span className={`block w-5 h-0.5 bg-[#1B3050] dark:bg-white transition-all duration-200 ${menuOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
        </button>
      </div>

      {/* Menu mobile déroulant */}
      {menuOpen && (
        <div className="md:hidden border-t border-[#DDD9D1] dark:border-[#1e3347] bg-white dark:bg-[#162534] px-4 py-4 flex flex-col gap-4">
          {navLinks.map(({ href, label }) => (
            <Link key={href} href={href} onClick={() => setMenuOpen(false)}
              className="text-[15px] font-medium text-[#1B3050] dark:text-[#e2e8f0] no-underline py-1">
              {label}
            </Link>
          ))}
          <div className="border-t border-[#DDD9D1] dark:border-[#1e3347] pt-4 flex flex-col gap-3">
            {user ? (
              <>
                <Link href="/profil" onClick={() => setMenuOpen(false)}
                  className="text-center text-[14px] font-semibold text-white no-underline py-2.5 rounded-[8px]" style={{ background: '#2B6B5A' }}>
                  Mon profil
                </Link>
                <button onClick={handleLogout}
                  className="text-[14px] font-medium text-[#9E9A93] py-1">
                  Déconnexion
                </button>
              </>
            ) : (
              <>
                <Link href="/signup" onClick={() => setMenuOpen(false)}
                  className="text-center text-[14px] font-semibold text-white no-underline py-2.5 rounded-[8px]" style={{ background: '#2B6B5A' }}>
                  S&apos;inscrire
                </Link>
                <Link href="/login" onClick={() => setMenuOpen(false)}
                  className="text-center text-[14px] font-medium text-[#5C6880] dark:text-[#94a3b8] no-underline py-1">
                  Connexion
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
