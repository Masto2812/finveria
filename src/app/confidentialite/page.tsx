import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Link from 'next/link'

export const metadata = {
  title: 'Politique de confidentialité – Finveria',
  description: 'Politique de confidentialité et traitement des données personnelles de Finveria.',
}

export default function ConfidentialitePage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--finv-bg)', color: 'var(--finv-text)' }}>
      <Header />

      <main style={{ flex: 1, maxWidth: 800, margin: '0 auto', padding: '40px 20px 60px', width: '100%' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--finv-text)' }}>
          Politique de confidentialité
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--finv-muted)', marginBottom: '2.5rem' }}>
          Dernière mise à jour : septembre 2026
        </p>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--finv-text)' }}>
            1. Responsable du traitement
          </h2>
          <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--finv-slate)' }}>
            Le responsable du traitement des données personnelles collectées via Finveria (finveria.ch) est son éditeur,
            domicilié en Suisse. Contact :{' '}
            <a href="mailto:support@finveria.ch" style={{ color: 'var(--finv-green)', textDecoration: 'none' }}>
              support@finveria.ch
            </a>
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--finv-text)' }}>
            2. Base légale
          </h2>
          <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--finv-slate)' }}>
            Le traitement de vos données est régi par la <strong>Loi fédérale sur la protection des données (nLPD, RS 235.1)</strong>,
            en vigueur depuis le 1er septembre 2023. Finveria s&apos;engage à traiter vos données dans le respect de cette loi et
            des réglementations applicables en Suisse.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--finv-text)' }}>
            3. Données collectées
          </h2>
          <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--finv-slate)', marginBottom: '0.75rem' }}>
            Finveria collecte les catégories de données suivantes :
          </p>
          <ul style={{ paddingLeft: '1.5rem', color: 'var(--finv-slate)', fontSize: '0.95rem', lineHeight: 1.8 }}>
            <li>
              <strong>Données de compte</strong> : adresse e-mail, nom et prénom, et mot de passe fournis lors de la création de compte. Le mot de passe est haché de manière irréversible (bcrypt) avant stockage — ni Finveria ni ses prestataires ne peuvent le lire en clair.
            </li>
            <li>
              <strong>Données de portfolio</strong> : informations sur vos positions (titres, quantités, prix d&apos;achat, dates),
              saisies volontairement par l&apos;utilisateur. Ces données sont stockées sur des serveurs sécurisés (Supabase / PostgreSQL).
            </li>
            <li>
              <strong>Données de navigation</strong> : adresse IP, navigateur, pages consultées, durée de visite.
              Ces données sont collectées à des fins d&apos;analyse statistique anonymisée.
            </li>
            <li>
              <strong>Cookies</strong> : voir notre{' '}
              <Link href="/cookies" style={{ color: 'var(--finv-green)', textDecoration: 'none' }}>
                Politique des cookies
              </Link>.
            </li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--finv-text)' }}>
            4. Finalités du traitement
          </h2>
          <ul style={{ paddingLeft: '1.5rem', color: 'var(--finv-slate)', fontSize: '0.95rem', lineHeight: 1.8 }}>
            <li>Fourniture du service de suivi de portefeuille et de simulation</li>
            <li>Authentification et sécurité du compte</li>
            <li>Amélioration des fonctionnalités du site</li>
            <li>Statistiques d&apos;utilisation agrégées et anonymisées</li>
            <li>Communication transactionnelle (confirmation de compte, réinitialisation de mot de passe)</li>
          </ul>
          <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--finv-slate)', marginTop: '0.75rem' }}>
            Finveria ne vend pas vos données personnelles à des tiers et ne les utilise pas à des fins publicitaires.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--finv-text)' }}>
            5. Sous-traitants et transferts de données
          </h2>
          <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--finv-slate)', marginBottom: '0.75rem' }}>
            Finveria fait appel aux sous-traitants suivants pour assurer le service :
          </p>
          <ul style={{ paddingLeft: '1.5rem', color: 'var(--finv-slate)', fontSize: '0.95rem', lineHeight: 1.8 }}>
            <li>
              <strong>Supabase Inc.</strong> (États-Unis) – base de données et authentification. Supabase offre des garanties
              de conformité conformes aux normes internationales (SOC 2 Type 2).
            </li>
            <li>
              <strong>Vercel Inc.</strong> (États-Unis) – hébergement et déploiement. Les données transitent via des
              infrastructures conformes aux standards de sécurité en vigueur.
            </li>
          </ul>
          <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--finv-slate)', marginTop: '0.75rem' }}>
            Ces transferts vers des pays tiers sont effectués sur la base de garanties appropriées conformément à la nLPD.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--finv-text)' }}>
            6. Durée de conservation
          </h2>
          <ul style={{ paddingLeft: '1.5rem', color: 'var(--finv-slate)', fontSize: '0.95rem', lineHeight: 1.8 }}>
            <li>Données de compte : conservées jusqu&apos;à suppression du compte, puis 30 jours supplémentaires.</li>
            <li>Données de portfolio : supprimées immédiatement lors de la suppression du compte.</li>
            <li>Logs de navigation : 12 mois maximum.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--finv-text)' }}>
            7. Vos droits
          </h2>
          <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--finv-slate)', marginBottom: '0.75rem' }}>
            Conformément à la nLPD, vous disposez des droits suivants :
          </p>
          <ul style={{ paddingLeft: '1.5rem', color: 'var(--finv-slate)', fontSize: '0.95rem', lineHeight: 1.8 }}>
            <li><strong>Droit d&apos;accès</strong> : obtenir une copie de vos données personnelles.</li>
            <li><strong>Droit de rectification</strong> : corriger des données inexactes.</li>
            <li><strong>Droit à l&apos;effacement</strong> : demander la suppression de vos données.</li>
            <li><strong>Droit à la portabilité</strong> : recevoir vos données dans un format structuré.</li>
            <li><strong>Droit d&apos;opposition</strong> : vous opposer à certains traitements.</li>
          </ul>
          <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--finv-slate)', marginTop: '0.75rem' }}>
            Pour exercer ces droits, contactez-nous à{' '}
            <a href="mailto:support@finveria.ch" style={{ color: 'var(--finv-green)', textDecoration: 'none' }}>
              support@finveria.ch
            </a>.
            En cas de désaccord, vous pouvez saisir le{' '}
            <a href="https://www.edoeb.admin.ch" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--finv-green)', textDecoration: 'none' }}>
              Préposé fédéral à la protection des données et à la transparence (PFPDT)
            </a>.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--finv-text)' }}>
            8. Sécurité
          </h2>
          <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--finv-slate)' }}>
            Finveria met en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données
            contre tout accès non autorisé, perte ou destruction (chiffrement en transit via HTTPS, authentification
            sécurisée, accès restreint aux données).
          </p>
        </section>
      </main>

      <Footer />
    </div>
  )
}
