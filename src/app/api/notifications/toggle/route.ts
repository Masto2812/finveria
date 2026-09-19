import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { sendEmail, welcomeEmail, farewellEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { enabled } = await req.json() as { enabled: boolean }

  // Sauvegarde la préférence dans user_metadata
  const { error: updateErr } = await supabase.auth.updateUser({
    data: { notifications_email: enabled }
  })
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // Envoie l'email de confirmation
  const prenom: string = user.user_metadata?.full_name?.split(' ')[0] ?? ''
  try {
    await sendEmail({
      to: user.email!,
      subject: enabled
        ? 'Notifications activées sur Finveria'
        : 'Notifications désactivées sur Finveria',
      html: enabled ? welcomeEmail(prenom) : farewellEmail(prenom),
    })
  } catch (err) {
    // On ne bloque pas si l'envoi échoue — la préférence est déjà sauvegardée
    console.error('[notifications/toggle] email send failed:', err)
  }

  return NextResponse.json({ success: true })
}
