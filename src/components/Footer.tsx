import Link from 'next/link'

export default function Footer() {
  return (
    <footer style={{ background: 'var(--finv-bg)', borderTop: '1px solid var(--finv-border)', marginTop: 'auto' }}>

      {/* Disclaimer financier */}
      <div style={{ borderBottom: '1px solid var(--finv-border)', padding: '16px 0' }}>
        <div style={{ maxWidth: 1152, margin: '0 auto', padding: '0 16px' }}>
          <p style={{ fontSize: 11.5, color: 'var(--finv-muted)', lineHeight: 1.6, textAlign: 'center', maxWidth: 800, margin: '0 auto' }}>
            <strong style={{ color: 'var(--finv-slate)' }}>Avertissement :</strong>{' '}
            Les informations publiées sur Finveria sont fournies à titre indicatif uniquement et ne constituent pas un conseil en investissement au sens de la loi suisse sur les services financiers (LSFin).
            Finveria n'est pas supervisé par la FINMA en qualité de conseiller financier. Tout investissement comporte des risques, y compris la perte du capital investi.
            Consultez un conseiller financier agréé avant toute décision.
          </p>
        </div>
      </div>

      {/* Corps du footer */}
      <div style={{ padding: '28px 0' }}>
        <div style={{ maxWidth: 1152, margin: '0 auto', padding: '0 16px', display: 'flex', flexWrap: 'wrap', gap: '2rem', justifyContent: 'space-between', alignItems: 'flex-start' }}>

          {/* Logo + baseline */}
          <div style={{ minWidth: 160 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--finv-text)', letterSpacing: '-0.02em', marginBottom: 6 }}>
              fin<span style={{ color: '#2B6B5A' }}>veria</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--finv-muted)', lineHeight: 1.5, maxWidth: 200 }}>
              Outils d'investissement pour résidents suisses.
            </p>
          </div>

          {/* Outils */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--finv-slate)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Outils</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Link href="/comparateur" style={{ fontSize: 13, color: 'var(--finv-muted)', textDecoration: 'none' }} className="hover:text-[#2B6B5A] transition-colors">Comparateur de courtiers</Link>
              <Link href="/portfolio" style={{ fontSize: 13, color: 'var(--finv-muted)', textDecoration: 'none' }} className="hover:text-[#2B6B5A] transition-colors">Suivi de portefeuille</Link>
              <Link href="/simulateur" style={{ fontSize: 13, color: 'var(--finv-muted)', textDecoration: 'none' }} className="hover:text-[#2B6B5A] transition-colors">Simulateur fiscal</Link>
            </div>
          </div>

          {/* Légal */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--finv-slate)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Légal</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Link href="/mentions-legales" style={{ fontSize: 13, color: 'var(--finv-muted)', textDecoration: 'none' }} className="hover:text-[#2B6B5A] transition-colors">Mentions légales</Link>
              <Link href="/confidentialite" style={{ fontSize: 13, color: 'var(--finv-muted)', textDecoration: 'none' }} className="hover:text-[#2B6B5A] transition-colors">Politique de confidentialité</Link>
              <Link href="/cookies" style={{ fontSize: 13, color: 'var(--finv-muted)', textDecoration: 'none' }} className="hover:text-[#2B6B5A] transition-colors">Cookies</Link>
            </div>
          </div>

          {/* Contact */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--finv-slate)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Contact</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <a href="mailto:support@finveria.ch" style={{ fontSize: 13, color: 'var(--finv-muted)', textDecoration: 'none' }} className="hover:text-[#2B6B5A] transition-colors">support@finveria.ch</a>
            </div>
          </div>

        </div>
      </div>

      {/* Copyright */}
      <div style={{ borderTop: '1px solid var(--finv-border)', padding: '14px 0' }}>
        <div style={{ maxWidth: 1152, margin: '0 auto', padding: '0 16px', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--finv-muted)' }}>© 2026 Finveria · Tous droits réservés</span>
          <span style={{ fontSize: 12, color: 'var(--finv-muted)' }}>🇨🇭 Suisse</span>
        </div>
      </div>

    </footer>
  )
}
