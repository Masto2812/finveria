'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function Header() {
  const router = useRouter()
  const [user, setUser] = useState<{ email?: string } | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-[#DDD9D1] dark:border-[#1e3347] bg-white dark:bg-[#162534]">
      <div className="h-14 px-6 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold text-[#1B3050] dark:text-white no-underline" style={{ letterSpacing: '-0.02em' }}>
          fin<span className="text-[#2B6B5A]">veria</span>
        </Link>
        <div className="flex items-center gap-7">
          <Link href="/comparateur" className="text-sm font-medium text-[#5C6880] dark:text-[#94a3b8] no-underline hover:text-[#1B3050] dark:hover:text-white transition-colors">Comparateur de courtiers</Link>
          <Link href="/simulateur"  className="text-sm font-medium text-[#5C6880] dark:text-[#94a3b8] no-underline hover:text-[#1B3050] dark:hover:text-white transition-colors">Simulateur fiscal</Link>
          <Link href="/portfolio"   className="text-sm font-medium text-[#5C6880] dark:text-[#94a3b8] no-underline hover:text-[#1B3050] dark:hover:text-white transition-colors">Portfolio</Link>
          {user ? (
            <div className="flex items-center gap-3">
              <Link href="/profil" className="text-[13px] font-semibold text-white no-underline px-4 py-1.5 rounded-[7px]" style={{ background: '#2B6B5A' }}>
                Profil
              </Link>
              <button onClick={handleLogout} className="text-[13px] font-medium text-[#9E9A93] hover:text-[#5C6880] transition-colors">
                Déconnexion
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link href="/login" className="text-[13px] font-medium text-[#5C6880] dark:text-[#94a3b8] no-underline hover:text-[#1B3050] dark:hover:text-white transition-colors">
                Connexion
              </Link>
              <Link href="/signup" className="text-[13px] font-semibold text-white no-underline px-4 py-1.5 rounded-[7px]" style={{ background: '#2B6B5A' }}>
                S'inscrire
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
