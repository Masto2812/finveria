import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Link from 'next/link'

export const metadata = {
  title: 'Mentions légales – Finveria',
  description: "Mentions légales et informations juridiques de Finveria, plateforme d'information financière suisse.",
}

export default function MentionsLegalesPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--finv-bg)', color: 'var(--finv-text)' }}>
      <Header />

      <main style={{ flex: 1, maxWidth: 800, margin: '0 auto', padding: '40px 20px 60px', width: '100%' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--finv-text)' }}>
          Mentions légales
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--finv-muted)', marginBottom: '2.5rem' }}>
          Dernière mise à jour : septembre 2026
        </p>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--finv-text)' }}>
            1. Éditeur du site
          </h2>
          <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--finv-slate)' }}>
            Le site <strong>Finveria</strong> (finveria.ch) est édité à titre privé par son créateur, domicilié en Suisse.
            Pour toute question, vous pouvez nous contacter à l&apos;adresse :{' '}
            <a href="mailto:support@finveria.ch" style={{ color: 'var(--finv-green)', textDecoration: 'none' }}>
              support@finveria.ch
            </a>
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--finv-text)' }}>
            2. Hébergeur
          </h2>
          <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--finv-slate)' }}>
            Le site est hébergé par <strong>Vercel Inc.</strong>, 340 Pine Street, Suite 900, San Francisco, CA 94104, États-Unis.
            Site web : <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--finv-green)', textDecoration: 'none' }}>vercel.com</a>
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--finv-text)' }}>
            3. Nature des informations publiées
          </h2>
          <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--finv-slate)' }}>
            Finveria est une plateforme d&apos;information et de comparaison à destination des investisseurs particuliers suisses.
            Les contenus publiés (comparatifs de courtiers, simulateurs, données de marché, articles) sont fournis à titre
            informatif et éducatif uniquement.
          </p>
          <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--finv-slate)', marginTop: '0.75rem' }}>
            <strong>Les informations publiées sur Finveria ne constituent pas un conseil en investissement</strong> au sens de la
            Loi fédérale sur les services financiers (LSFin, RS 950.1) ni une recommandation d&apos;achat ou de vente d&apos;instruments financiers.
            Finveria n&apos;est pas agréé en qualité de conseiller financier par la FINMA (Autorité fédérale de surveillance des marchés financiers).
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--finv-text)' }}>
            4. Avertissement sur les risques
          </h2>
          <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--finv-slate)' }}>
            Tout investissement comporte des risques, y compris le risque de perte totale du capital investi.
            Les performances passées ne préjugent pas des performances futures. Les données affichées sur le site
            (cours boursiers, frais de courtage, conditions tarifaires) sont susceptibles d&apos;évoluer et ne sont pas
            contractuelles vis-à-vis des courtiers cités.
          </p>
          <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--finv-slate)', marginTop: '0.75rem' }}>
            Nous vous recommandons de consulter un conseiller financier agréé avant toute décision d&apos;investissement.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--finv-text)' }}>
            5. Liens d&apos;affiliation
          </h2>
          <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--finv-slate)' }}>
            Certains liens présents sur Finveria sont des liens d&apos;affiliation. Cela signifie que si vous ouvrez un compte
            auprès d&apos;un courtier via notre lien, nous pouvons percevoir une commission de la part de ce courtier, sans coût
            supplémentaire pour vous. Cette rémunération ne conditionne pas les avis ou classements publiés sur le site,
            qui reposent sur des critères objectifs (frais, réglementation, fonctionnalités).
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--finv-text)' }}>
            6. Propriété intellectuelle
          </h2>
          <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--finv-slate)' }}>
            L&apos;ensemble du contenu de Finveria (textes, graphiques, logo, code source) est protégé par les lois suisses
            sur la propriété intellectuelle. Toute reproduction, même partielle, sans autorisation écrite préalable est interdite.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--finv-text)' }}>
            7. Protection des données
          </h2>
          <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--finv-slate)' }}>
            Le traitement de vos données personnelles est régi par notre{' '}
            <Link href="/confidentialite" style={{ color: 'var(--finv-green)', textDecoration: 'none' }}>
              Politique de confidentialité
            </Link>
            , conforme à la Loi fédérale sur la protection des données (LPD, RS 235.1).
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--finv-text)' }}>
            8. Droit applicable et for juridique
          </h2>
          <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--finv-slate)' }}>
            Les présentes mentions légales sont régies par le droit suisse. Tout litige relatif à l&apos;utilisation du site
            sera soumis à la juridiction des tribunaux suisses compétents.
          </p>
        </section>
      </main>

      <Footer />
    </div>
  )
}
