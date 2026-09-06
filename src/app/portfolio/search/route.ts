import { NextRequest, NextResponse } from 'next/server'

const DEVISE_MAP: Record<string, string> = {
  CHF: 'CHF', USD: 'USD', EUR: 'EUR', GBP: 'GBP',
  JPY: 'JPY', SEK: 'SEK', NOK: 'NOK', DKK: 'DKK',
}

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ results: [] })
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0&enableFuzzyQuery=true&enableCb=false`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    )
    if (!res.ok) return NextResponse.json({ results: [] })
    const json = await res.json()
    const quotes = json?.quotes ?? []
    const results = quotes
      .filter((q: Record<string, string>) =>
        ['EQUITY', 'ETF', 'CRYPTOCURRENCY', 'FUTURE', 'MUTUALFUND'].includes(q.quoteType)
      )
      .map((q: Record<string, string>) => ({
        ticker: q.symbol,
        nom: q.shortname || q.longname || q.symbol,
        bourse: q.exchDisp || '',
        type: q.typeDisp || '',
        devise: DEVISE_MAP[q.currency] ?? 'USD',
      }))
    return NextResponse.json({ results })
  } catch { return NextResponse.json({ results: [] }) }
}