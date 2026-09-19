import { NextRequest, NextResponse } from 'next/server'
import { handleWebhook } from '@/lib/stripe/webhooks'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Signature manquante' }, { status: 400 })
  }

  try {
    await handleWebhook(body, signature)
    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[stripe/webhook] error:', err)
    return NextResponse.json({ error: 'Webhook invalide' }, { status: 400 })
  }
}

