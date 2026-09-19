'use client'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import Link from 'next/link'
import { useState } from 'react'

export default function Home() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (email) setSubmitted(true)
  }

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: 'var(--finv-bg)', color: 'var(--finv-text)', minHeight: '100vh' }}>

      <Header />

      {/* HERO */}
      <section style={{ background: 'var(--finv-hero)', padding: '88px 0 80px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 60% at 65% 50%, rgba(43,107,90,0.2) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div className="hero-grid" style={{ maxWidth: 1152, margin: '0 auto', padding: '0 16px', position: 'relative', display: 'grid', gridTemplateColumns: '1fr 400px', gap: 72, alignItems: 'center' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(43,107,90,0.25)', border: '1px solid rgba(43,107,90,0.4)', borderRadius: 20, padding: '4px 14px', marginBottom: 28 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(245,243,239,0.8)', letterSpacing: 0.2 }}>🇨🇭 Conçu pour les investisseurs en Suisse</span>
            </div>
            <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(38px, 5vw, 56px)', fontWeight: 700, color: '#F5F3EF', marginBottom: 20, lineHeight: 1.1 }}>
              Le bon courtier.<br />
              Le bon portefeuille.<br />
              <em style={{ fontStyle: 'italic', color: 'rgba(245,243,239,0.5)' }}>Le bon impôt.</em>
            </h1>
            <p style={{ fontSize: 17, color: 'rgba(245,243,239,0.65)', lineHeight: 1.75, maxWidth: '46ch', marginBottom: 36 }}>
              Comparez les courtiers sur leurs vrais frais, suivez vos positions en temps réel et calculez votre charge fiscale par canton — trois outils pour investir intelligemment depuis la Suisse.
            </p>
            <div style={{ display: 'flex', gap: 40, paddingTop: 32, borderTop: '1px solid rgba(245,243,239,0.1)' }}>
              {[
                ['7', 'Courtiers comparés'],
                ['26', 'Cantons fiscaux'],
                ['+10 000', 'Actifs disponibles'],
              ].map(([n, l]) => (
                <div key={l}>
                  <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, fontWeight: 600, color: '#F5F3EF', display: 'block', lineHeight: 1 }}>{n}</span>
                  <span style={{ fontSize: 12, color: 'rgba(245,243,239,0.4)', marginTop: 5, display: 'block' }}>{l}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Waitlist */}
          <div id="waitlist" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 32, backdropFilter: 'blur(8px)' }}>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 600, color: '#F5F3EF', marginBottom: 6 }}>Accès anticipé</div>
            <div style={{ fontSize: 13, color: 'rgba(245,243,239,0.5)', marginBottom: 24, lineHeight: 1.55 }}>
              Soyez parmi les premiers à tester Finveria et contribuez à façonner les prochaines fonctionnalités.
            </div>
            {submitted ? (
              <div style={{ background: 'rgba(43,107,90,0.25)', border: '1px solid rgba(43,107,90,0.4)', borderRadius: 10, padding: '20px', textAlign: 'center' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>✓</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#F5F3EF' }}>Vous êtes inscrit !</div>
                <div style={{ fontSize: 12, color: 'rgba(245,243,239,0.5)', marginTop: 6 }}>On vous contacte dès l&apos;ouverture.</div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(245,243,239,0.6)', display: 'block', marginBottom: 5 }}>Adresse e-mail</label>
                  <input
                    type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="vous@exemple.ch"
                    style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '11px 14px', fontSize: 14, color: '#F5F3EF', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <button type="submit" style={{ background: '#2B6B5A', color: '#fff', border: 'none', borderRadius: 8, padding: '13px', fontSize: 15, fontWeight: 600, cursor: 'pointer', width: '100%' }}>
                  Rejoindre la bêta
                </button>
                <p style={{ fontSize: 11, color: 'rgba(245,243,239,0.3)', textAlign: 'center', margin: 0 }}>Gratuit · Aucun engagement</p>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* OUTILS */}
      <section style={{ padding: '80px 0' }}>
        <div style={{ maxWidth: 1152, margin: '0 auto', padding: '0 16px' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: '#2B6B5A', marginBottom: 12 }}>Trois outils</div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(30px,4vw,42px)', fontWeight: 700, color: 'var(--finv-text)' }}>
              Tout ce dont vous avez besoin pour bien investir en Suisse.
            </h2>
          </div>

          <div className="features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>

            {/* Comparateur */}
            <Link href="/comparateur" style={{ background: 'var(--finv-card)', borderRadius: 16, border: '1px solid var(--finv-border)', padding: 32, textDecoration: 'none', display: 'flex', flexDirection: 'column' }}>
              <div style={{ width: 44, height: 44, background: 'var(--finv-bg)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 20 }}>⚖️</div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: '#2B6B5A', marginBottom: 10 }}>Comparateur</div>
              <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 700, color: 'var(--finv-text)', marginBottom: 14, lineHeight: 1.2 }}>
                Quel courtier pour votre profil ?
              </h3>
              <p style={{ fontSize: 14, color: 'var(--finv-slate)', lineHeight: 1.7, marginBottom: 24, flexGrow: 1 }}>
                Comparez 7 courtiers accessibles depuis la Suisse — IBKR, DEGIRO, Swissquote, Trade Republic, Saxo Bank, Yuh, Neon — sur leurs frais réels par type d&apos;actif (ETF, actions, options, forex…), leur réglementation, le droit de timbre suisse et leur adéquation selon votre horizon d&apos;investissement.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
                {['Frais par actif', 'Droit de timbre', 'Court / long terme', 'Rapport fiscal CH'].map(t => (
                  <span key={t} style={{ fontSize: 11, background: 'var(--finv-bg)', border: '1px solid var(--finv-border)', borderRadius: 20, padding: '3px 10px', color: 'var(--finv-slate)', fontWeight: 500 }}>{t}</span>
                ))}
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#2B6B5A' }}>Comparer les courtiers →</span>
            </Link>

            {/* Simulateur */}
            <Link href="/simulateur" style={{ background: 'var(--finv-card)', borderRadius: 16, border: '1px solid var(--finv-border)', padding: 32, textDecoration: 'none', display: 'flex', flexDirection: 'column' }}>
              <div style={{ width: 44, height: 44, background: 'var(--finv-bg)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 20 }}>🧾</div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: '#2B6B5A', marginBottom: 10 }}>Simulateur fiscal</div>
              <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 700, color: 'var(--finv-text)', marginBottom: 14, lineHeight: 1.2 }}>
                Combien d&apos;impôt sur vos dividendes ?
              </h3>
              <p style={{ fontSize: 14, color: 'var(--finv-slate)', lineHeight: 1.7, marginBottom: 24, flexGrow: 1 }}>
                Calculez votre charge fiscale sur les dividendes selon votre canton (26 cantons), votre situation familiale et votre statut (investisseur privé ou trader professionnel). Intègre l&apos;impôt anticipé (35%), l&apos;IFD et le calendrier fiscal suisse. Les plus-values restent exonérées pour l&apos;investisseur privé.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
                {['26 cantons', 'Impôt anticipé', 'IFD', 'Privé / Professionnel'].map(t => (
                  <span key={t} style={{ fontSize: 11, background: 'var(--finv-bg)', border: '1px solid var(--finv-border)', borderRadius: 20, padding: '3px 10px', color: 'var(--finv-slate)', fontWeight: 500 }}>{t}</span>
                ))}
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#2B6B5A' }}>Simuler mon impôt →</span>
            </Link>

            {/* Portfolio */}
            <Link href="/portfolio" style={{ background: 'var(--finv-card)', borderRadius: 16, border: '1px solid var(--finv-border)', padding: 32, textDecoration: 'none', display: 'flex', flexDirection: 'column' }}>
              <div style={{ width: 44, height: 44, background: 'var(--finv-bg)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 20 }}>📊</div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: '#2B6B5A', marginBottom: 10 }}>Portfolio</div>
              <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 700, color: 'var(--finv-text)', marginBottom: 14, lineHeight: 1.2 }}>
                Suivez vos positions en temps réel.
              </h3>
              <p style={{ fontSize: 14, color: 'var(--finv-slate)', lineHeight: 1.7, marginBottom: 24, flexGrow: 1 }}>
                Ajoutez vos positions par ticker (données de marché réelles), visualisez votre performance nominale et corrigée de l&apos;inflation, votre drawdown et la répartition de votre portefeuille par classe d&apos;actif. Finveria évalue votre portefeuille globalement et vous suggère une répartition optimale des actifs.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
                {['Prix réels', 'Inflation CPI', 'Drawdown', 'Évaluation globale', 'Répartition optimale'].map(t => (
                  <span key={t} style={{ fontSize: 11, background: 'var(--finv-bg)', border: '1px solid var(--finv-border)', borderRadius: 20, padding: '3px 10px', color: 'var(--finv-slate)', fontWeight: 500 }}>{t}</span>
                ))}
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#2B6B5A' }}>Analyser mon portfolio →</span>
            </Link>

          </div>
        </div>
      </section>

      {/* POURQUOI FINVERIA */}
      <section style={{ padding: '72px 0', background: 'var(--finv-card)', borderTop: '1px solid var(--finv-border)', borderBottom: '1px solid var(--finv-border)' }}>
        <div className="why-grid" style={{ maxWidth: 1152, margin: '0 auto', padding: '0 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: '#2B6B5A', marginBottom: 16 }}>Pourquoi Finveria</div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(28px,3.5vw,38px)', fontWeight: 700, color: 'var(--finv-text)', marginBottom: 20, lineHeight: 1.2 }}>
              Pensé pour la réalité suisse.
            </h2>
            <p style={{ fontSize: 15, color: 'var(--finv-slate)', lineHeight: 1.75, marginBottom: 28 }}>
              Investir en Suisse a ses particularités : droit de timbre, impôt anticipé, 26 régimes cantonaux, courtiers réglementés FINMA ou non. Finveria les intègre tous.
            </p>
            <p style={{ fontSize: 15, color: 'var(--finv-slate)', lineHeight: 1.75 }}>
              Aucun conflit d&apos;intérêt : nos comparaisons sont basées sur des données objectives et mises à jour manuellement.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {[
              { icon: '🏦', title: 'Réglementation suisse intégrée', desc: 'FINMA vs réglementation internationale, protection des dépôts en CHF ou EUR, rapport fiscal suisse.' },
              { icon: '📅', title: 'Calendrier fiscal inclus', desc: 'Dates limites de déclaration, remboursement de l\'impôt anticipé, traitement des dividendes étrangers.' },
              { icon: '🔒', title: 'Vos données restent privées', desc: 'Vos calculs et positions ne sont jamais partagés. Un compte est requis pour accéder aux outils.' },
            ].map(item => (
              <div key={item.title} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ width: 40, height: 40, background: 'var(--finv-bg)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{item.icon}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--finv-text)', marginBottom: 4 }}>{item.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--finv-slate)', lineHeight: 1.6 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* TARIFS */}
      <section style={{ padding: '80px 0', background: 'var(--finv-card)', borderTop: '1px solid var(--finv-border)', borderBottom: '1px solid var(--finv-border)' }}>
        <div style={{ maxWidth: 1152, margin: '0 auto', padding: '0 16px' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: '#2B6B5A', marginBottom: 12 }}>Tarifs</div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(30px,4vw,42px)', fontWeight: 700, color: 'var(--finv-text)', marginBottom: 16 }}>Simple et transparent.</h2>
            <p style={{ fontSize: 16, color: 'var(--finv-slate)', maxWidth: '52ch', margin: '0 auto' }}>Le comparateur est accessible sans compte. Le simulateur est gratuit après inscription. Le portefeuille est en Premium.</p>
          </div>

          <div className="beta-banner" style={{ background: 'var(--finv-hero)', borderRadius: 14, padding: '18px 24px', marginBottom: 32, maxWidth: 960, margin: '0 auto 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#F5F3EF', marginBottom: 4 }}>🚀 Bêta fermée — 50 places disponibles</div>
              <div style={{ fontSize: 13, color: 'rgba(245,243,239,0.6)', lineHeight: 1.5 }}>Accès complet aux 3 outils pendant 3 mois gratuits. Ensuite, essai Premium 14 jours offerts.</div>
            </div>
            <a href="/signup" style={{ flexShrink: 0, background: '#2B6B5A', color: 'white', borderRadius: 8, padding: '10px 18px', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>Rejoindre →</a>
          </div>

          <div className="pricing-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, maxWidth: 960, margin: '0 auto' }}>
            {/* Gratuit sans compte */}
            <div style={{ background: 'var(--finv-bg)', borderRadius: 16, padding: 28, border: '1px solid var(--finv-border)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--finv-slate)', marginBottom: 12 }}>Sans compte</div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 42, fontWeight: 700, color: 'var(--finv-text)', lineHeight: 1, marginBottom: 4 }}>Gratuit</div>
              <div style={{ fontSize: 13, color: 'var(--finv-muted)', marginBottom: 24 }}>Aucune inscription requise</div>
              <ul style={{ listStyle: 'none', padding: 0, marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {['Comparateur de courtiers (7 courtiers)', 'Frais par actif, droit de timbre', 'Filtres horizon et réglementation'].map(f => (
                  <li key={f} style={{ fontSize: 13, color: 'var(--finv-slate)', display: 'flex', gap: 10 }}>
                    <span style={{ color: '#2B6B5A', flexShrink: 0 }}>✓</span>{f}
                  </li>
                ))}
                {['Simulateur fiscal', 'Suivi de portefeuille'].map(f => (
                  <li key={f} style={{ fontSize: 13, color: 'var(--finv-muted2)', display: 'flex', gap: 10 }}>
                    <span style={{ flexShrink: 0 }}>–</span>{f}
                  </li>
                ))}
              </ul>
              <a href="/comparateur" style={{ display: 'block', textAlign: 'center', background: '#2B6B5A', color: 'white', borderRadius: 8, padding: '11px 16px', fontWeight: 600, fontSize: 13, textDecoration: 'none', marginTop: 'auto' }}>
                Accéder au comparateur
              </a>
            </div>

            {/* Compte gratuit */}
            <div style={{ background: 'var(--finv-bg)', borderRadius: 16, padding: 28, border: '2px solid #2B6B5A', position: 'relative', display: 'flex', flexDirection: 'column' }}>
              <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#2B6B5A', color: 'white', fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '3px 12px', whiteSpace: 'nowrap' }}>Compte requis</div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#2B6B5A', marginBottom: 12 }}>Avec compte</div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 42, fontWeight: 700, color: 'var(--finv-text)', lineHeight: 1, marginBottom: 4 }}>Gratuit</div>
              <div style={{ fontSize: 13, color: 'var(--finv-muted)', marginBottom: 24 }}>Inscription gratuite</div>
              <ul style={{ listStyle: 'none', padding: 0, marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {['Tout le plan Sans compte', 'Simulateur fiscal suisse (26 cantons)', 'Impôt anticipé, IFD, calendrier fiscal', 'Mode privé et professionnel'].map(f => (
                  <li key={f} style={{ fontSize: 13, color: 'var(--finv-slate)', display: 'flex', gap: 10 }}>
                    <span style={{ color: '#2B6B5A', flexShrink: 0 }}>✓</span>{f}
                  </li>
                ))}
                {['Suivi de portefeuille'].map(f => (
                  <li key={f} style={{ fontSize: 13, color: 'var(--finv-muted2)', display: 'flex', gap: 10 }}>
                    <span style={{ flexShrink: 0 }}>–</span>{f}
                  </li>
                ))}
              </ul>
              <a href="/signup" style={{ display: 'block', textAlign: 'center', background: '#2B6B5A', color: 'white', borderRadius: 8, padding: '11px 16px', fontWeight: 600, fontSize: 13, textDecoration: 'none', marginTop: 'auto' }}>
                Créer un compte gratuit
              </a>
            </div>

            {/* Premium */}
            <div style={{ background: 'var(--finv-hero)', borderRadius: 16, padding: 28, position: 'relative', display: 'flex', flexDirection: 'column' }}>
              <div style={{ position: 'absolute', top: 16, right: 16, background: '#2B6B5A', color: 'white', fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '3px 10px' }}>14 jours offerts</div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(245,243,239,0.5)', marginBottom: 12 }}>Premium</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, lineHeight: 1, marginBottom: 4 }}>
                <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 42, fontWeight: 700, color: '#F5F3EF' }}>14 CHF</span>
                <span style={{ fontSize: 13, color: 'rgba(245,243,239,0.5)' }}>/mois</span>
              </div>
              <div style={{ fontSize: 13, color: 'rgba(245,243,239,0.4)', marginBottom: 24 }}>Tout le plan Compte, plus :</div>
              <ul style={{ listStyle: 'none', padding: 0, marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  'Suivi de portefeuille (tickers réels)',
                  'Performance nominale & inflation',
                  'Drawdown & évaluation globale',
                  'Répartition optimale des actifs',
                ].map(f => (
                  <li key={f} style={{ fontSize: 13, color: 'rgba(245,243,239,0.75)', display: 'flex', gap: 10 }}>
                    <span style={{ color: '#2B6B5A', flexShrink: 0 }}>✓</span>{f}
                  </li>
                ))}
              </ul>
              <a href="/signup" style={{ display: 'block', textAlign: 'center', background: '#2B6B5A', color: 'white', borderRadius: 8, padding: '11px 16px', fontWeight: 600, fontSize: 13, textDecoration: 'none', marginTop: 'auto' }}>
                Essayer 14 jours gratuitement
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: 'var(--finv-bg)', borderTop: '1px solid var(--finv-border)', padding: '72px 0', textAlign: 'center' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 28px' }}>
          <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(28px,4vw,40px)', fontWeight: 700, color: 'var(--finv-text)', marginBottom: 16 }}>
            Commencez maintenant.
          </h2>
          <p style={{ fontSize: 16, color: 'var(--finv-slate)', marginBottom: 36, lineHeight: 1.7 }}>
            Créez votre compte pour accéder aux outils Finveria.
          </p>
          <div className="cta-buttons" style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Link href="/comparateur" style={{ background: 'var(--finv-card)', color: 'var(--finv-text)', border: '1px solid var(--finv-border)', borderRadius: 9, padding: '13px 28px', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>Comparer les courtiers</Link>
            <Link href="/simulateur"  style={{ background: 'var(--finv-card)', color: 'var(--finv-text)', border: '1px solid var(--finv-border)', borderRadius: 9, padding: '13px 28px', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>Simuler mon impôt</Link>
            <Link href="/portfolio"   style={{ background: 'var(--finv-card)', color: 'var(--finv-text)', border: '1px solid var(--finv-border)', borderRadius: 9, padding: '13px 28px', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>Mon portfolio</Link>
          </div>
        </div>
      </section>

      <Footer />

    </div>
  )
}
