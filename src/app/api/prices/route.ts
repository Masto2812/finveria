import { NextRequest, NextResponse } from 'next/server'
 
const FX_SYMBOL: Record<string, string> = {
  USD: 'USDCHF=X',
  EUR: 'EURCHF=X',
  GBP: 'GBPCHF=X',
  JPY: 'JPYCHF=X',
  SEK: 'SEKCHF=X',
  NOK: 'NOKCHF=X',
  DKK: 'DKKCHF=X',
}
 
async function fetchYahoo(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    )
    if (!res.ok) return null
    const json = await res.json()
    const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice
    return typeof price === 'number' ? price : null
  } catch {
    return null
  }
}
 
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const ticker = searchParams.get('ticker')?.trim().toUpperCase()
  const devise  = searchParams.get('devise')?.trim().toUpperCase()
 
  if (!ticker || !devise) {
    return NextResponse.json(
      { error: 'Paramètres manquants : ticker et devise requis' },
      { status: 400 }
    )
  }
 
  const [price, fxRate] = await Promise.all([
    fetchYahoo(ticker),
    devise === 'CHF' ? Promise.resolve(1) : fetchYahoo(FX_SYMBOL[devise] ?? ''),
  ])
 
  return NextResponse.json(
    { ticker, devise, price, fxRate },
    {
      headers: {
        // Cache navigateur 5 minutes
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
      },
    }
  )
}
 