import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch { /* read-only context (Server Component) */ }
        },
      },
    }
  )
}

// ── GET /api/investor-profile ─────────────────────────────────────────────────
export async function GET() {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('investor_profile')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('[API /investor-profile GET] Supabase error:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    })
    return NextResponse.json(
      { error: error.message || 'Erreur base de données', code: error.code, details: error.details, hint: error.hint },
      { status: 500 }
    )
  }

  return NextResponse.json({ data })
}

// ── POST /api/investor-profile ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { horizon?: unknown; loss?: unknown; liquidity?: unknown; objective?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const payload = {
    user_id: user.id,
    horizon: Number(body.horizon ?? 10),
    loss: Number(body.loss ?? 25),
    liquidity: String(body.liquidity ?? 'moyenne'),
    objective: String(body.objective ?? 'modéré'),
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('investor_profile')
    .upsert(payload, { onConflict: 'user_id' })

  if (error) {
    console.error('[API /investor-profile POST] Supabase error:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    })
    return NextResponse.json(
      { error: error.message || 'Erreur base de données', code: error.code, details: error.details, hint: error.hint },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
