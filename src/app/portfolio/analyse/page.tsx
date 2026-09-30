'use client'

import React, { useState, useEffect, useMemo, useTransition } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { computePositionsCalc } from '@/lib/portfolio/api'
import type { Position, PositionCalc, InvProfile } from '@/lib/portfolio/types'
import { InvestorProfileSection, InvProfileCard } from '../_components/InvestorProfileSection'

export default function AnalysePage() {
  const [positions, setPositions] = useState<Position[]>([])
  const [profile, setProfile] = useState<InvProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Shared controls between stats-only (left) and no-stats (right) instances
  const [showFX, setShowFX] = useState(false)
  const [longMode, setLongMode] = useState(false)
  // Personnalisé mode — shared across all InvestorProfileSection instances
  const [propsMode, setPropsMode] = useState<'portfolio' | 'custom'>('portfolio')
  const [customAssets, setCustomAssets] = useState<{id: string, nom: string, ticker: string, categorie: string, devise: string, quantite: number, prix: number}[]>([])
  // isPending=true pendant le render de transition → les spinners s'affichent immédiatement au clic
  const [isPending, startTransition] = useTransition()

  // ── Load data from Supabase ────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          try {
            const raw = localStorage.getItem('finveria_portfolio')
            if (raw) setPositions(JSON.parse(raw))
          } catch {}
          setLoading(false)
          return
        }

        // Positions
        const { data: rows, error: posErr } = await supabase
          .from('portfolio_positions')
          .select('*')
          .eq('user_id', user.id)

        if (posErr) throw posErr

        if (rows && rows.length > 0) {
          setPositions(rows.map((r: Record<string, unknown>) => ({
            id: r.id as string,
            nom: r.nom as string,
            ticker: r.ticker as string,
            categorie: r.categorie as string,
            devise: r.devise as string,
            quantite: Number(r.quantite),
            prixAchat: Number(r.prix_achat),
            tauxAchatCHF: Number(r.taux_achat_chf),
            dateAchat: r.date_achat as string,
            prixActuel: Number(r.prix_actuel),
            tauxActuelCHF: Number(r.taux_actuel_chf),
            courtier: (r.courtier as string) ?? undefined,
            derniereMaj: (r.derniere_maj as string) ?? undefined,
            dateVente: (r.date_vente as string) ?? undefined,
            prixVente: r.prix_vente !== undefined && r.prix_vente !== null ? Number(r.prix_vente) : undefined,
            tauxVenteCHF: r.taux_vente_chf !== undefined && r.taux_vente_chf !== null ? Number(r.taux_vente_chf) : undefined,
          })))
        }

        // Investor profile
        const { data: prof } = await supabase
          .from('investor_profile')
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (prof) {
          setProfile({
            horizon: Number(prof.horizon),
            loss: Number(prof.loss),
            liquidity: prof.liquidity as 'haute' | 'moyenne' | 'faible',
            objective: (prof.objective === 'défensif' ? 'inflation' : prof.objective) as 'inflation' | 'modéré' | 'croissance' | 'agressif',
          })
        }
      } catch (e) {
        console.error(e)
        setError('Erreur lors du chargement des données.')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  // ── Compute positionsCalc ──────────────────────────────────────────────────
  const currentPositions = useMemo(
    () => positions.filter(p => !p.dateVente),
    [positions]
  )

  const positionsCalc = useMemo(
    () => computePositionsCalc(currentPositions),
    [currentPositions]
  )

  // Si aucune position réelle, passer automatiquement en mode Personnalisé
  useEffect(() => {
    if (!loading && positionsCalc.length === 0) {
      setPropsMode('custom')
    }
  }, [loading, positionsCalc.length])

  // Portefeuille personnalisé → PositionCalc synthetic
  const customPositionsCalc = useMemo((): PositionCalc[] => {
    return customAssets.map(a => ({
      id: a.id, nom: a.nom, ticker: a.ticker, categorie: a.categorie, devise: a.devise,
      quantite: a.quantite, prixAchat: a.prix, tauxAchatCHF: 1, dateAchat: '',
      prixActuel: a.prix, tauxActuelCHF: 1,
      valeurCHF: a.quantite * a.prix,
      coutCHF: a.quantite * a.prix, gainCHF: 0, gainPctCHF: 0,
      gainDevise: 0, gainPctDevise: 0, impactFX: 0, gainReel: 0, gainPctReel: 0,
    } as PositionCalc))
  }, [customAssets])

  // Données effectives transmises aux sections d'analyse
  const effectiveData = propsMode === 'custom'
    ? customPositionsCalc   // vide si aucun actif personnalisé → tout affiche 0
    : positionsCalc

  const effectiveProfile: InvProfile = profile ?? {
    horizon: 10,
    loss: 20,
    liquidity: 'moyenne',
    objective: 'croissance',
  }

  return (
    <div className="min-h-screen bg-[#F5F3EF] dark:bg-[#181C22] flex flex-col">
      <Header />
      <main className="flex-1 w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-10 xl:px-16 py-10 flex flex-col gap-6">
        {/* Page title */}
        <div className="mb-2">
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold tracking-tight">Analyse</h1>
          </div>
          <p className="text-[#5C6880] dark:text-[#7B8DA6] text-sm">Performances historiques de votre portefeuille actuel — simulation Monte Carlo, stress tests et frontière efficiente calculés sur les vraies proportions de vos positions.</p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-24 text-[#9E9A93] text-sm">
            Chargement…
          </div>
        )}

        {!loading && error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-sm px-5 py-4 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
          {positionsCalc.length === 0 && (
            <div className="flex items-center justify-between gap-3 bg-[#FAFAF8] dark:bg-[#1E2530] border border-[#DDD9D1] dark:border-[#2A3240] rounded-sm px-4 py-3">
              <p className="text-sm text-[#1E40AF] dark:text-[#7B8DA6]">
                Aucune position ouverte — mode <strong>Personnalisé</strong> actif. Ajoutez des actifs dans la section Proportions ou{' '}
                <Link href="/portfolio" className="underline hover:opacity-80">ajoutez des positions à votre portefeuille</Link>.
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
            {/* ── LEFT: Profil investisseur + Statistiques ── */}
            <div className="lg:col-span-1 flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
              {!profile ? (
                <div className="bg-[#FAFAF8] dark:bg-[#1E2530] rounded-sm border border-[#DDD9D1] dark:border-[#2A3240] px-5 py-4 text-sm text-[#5C6880] dark:text-[#7B8DA6]">
                  Profil investisseur non configuré.{' '}
                  <a href="/profil?tab=investisseur" className="underline text-[#1B3050] dark:text-white hover:opacity-80">
                    Configurer mon profil
                  </a>
                </div>
              ) : (
                <InvProfileCard profile={profile} />
              )}
              {/* Proportions — actifs et leur poids dans le portefeuille */}
              <div className="bg-[#FAFAF8] dark:bg-[#1E2530] rounded-sm border border-[#DDD9D1] dark:border-[#2A3240] overflow-hidden">
                <InvestorProfileSection
                data={positionsCalc} profile={effectiveProfile} variant="proportions-only"
                showFX={showFX} longMode={longMode}
                controlledPropsMode={propsMode} onPropsModeChange={(mode) => startTransition(() => setPropsMode(mode))}
                controlledCustomAssets={customAssets} onCustomAssetsChange={(assets) => startTransition(() => setCustomAssets(assets))}
              />
              </div>
              {/* Score du portefeuille — donut entre Proportions et Statistiques */}
              <div className="bg-[#FAFAF8] dark:bg-[#1E2530] rounded-sm border border-[#DDD9D1] dark:border-[#2A3240] overflow-hidden">
                <InvestorProfileSection data={effectiveData} profile={effectiveProfile} variant="score-only" showFX={showFX} longMode={longMode} modeKey={propsMode} forceLoading={isPending} />
              </div>
              {/* Statistiques standalone below score card */}
              <div className="bg-[#FAFAF8] dark:bg-[#1E2530] rounded-sm border border-[#DDD9D1] dark:border-[#2A3240] overflow-hidden">
                <InvestorProfileSection data={effectiveData} profile={effectiveProfile} variant="stats-only" showFX={showFX} onShowFXChange={setShowFX} longMode={longMode} onLongModeChange={setLongMode} modeKey={propsMode} forceLoading={isPending} />
              </div>
            </div>
            {/* ── RIGHT: Monte Carlo, Stress Tests, Frontière, Historique ── */}
            <div className="lg:col-span-2 flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
              <InvestorProfileSection data={effectiveData} profile={effectiveProfile} variant="no-stats" showFX={showFX} longMode={longMode} modeKey={propsMode} forceLoading={isPending} />
            </div>
          </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  )
}
