import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Link from 'next/link'
import CookieReset from '@/components/CookieReset'

export const metadata = {
  title: 'Politique des cookies – Finveria',
  description: "Politique d'utilisation des cookies sur Finveria.",
}

export default function CookiesPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--finv-bg)', color: 'var(--finv-text)' }}>
      <Header />

      <main style={{ flex: 1, maxWidth: 800, margin: '0 auto', padding: '40px 20px 60px', width: '100%' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--finv-text)' }}>
          Politique des cookies
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--finv-muted)', marginBottom: '2.5rem' }}>
          Dernière mise à jour : septembre 2026
        </p>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--finv-text)' }}>
            1. Qu&apos;est-ce qu&apos;un cookie ?
          </h2>
          <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--finv-slate)' }}>
            Un cookie est un petit fichier texte déposé sur votre appareil (ordinateur, tablette ou smartphone)
            lors de la visite d&apos;un site web. Il permet au site de mémoriser certaines informations sur votre visite,
            comme votre langue préférée ou d&apos;autres paramètres, afin de vous faciliter la prochaine visite.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--finv-text)' }}>
            2. Cookies utilisés par Finveria
          </h2>

          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--finv-text)', marginBottom: '0.5rem' }}>
              Cookies strictement nécessaires
            </h3>
            <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--finv-slate)' }}>
              Ces cookies sont indispensables au fonctionnement du site. Ils permettent notamment de maintenir votre
              session authentifiée, de sécuriser vos connexions et de mémoriser vos préférences d&apos;affichage (thème clair/sombre).
              Ils ne peuvent pas être désactivés sans altérer le fonctionnement du service.
            </p>
            <div style={{ overflowX: 'auto', marginTop: '0.75rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--finv-border)' }}>
                    <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--finv-text)', fontWeight: 600 }}>Nom</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--finv-text)', fontWeight: 600 }}>Finalité</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--finv-text)', fontWeight: 600 }}>Durée</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid var(--finv-border)' }}>
                    <td style={{ padding: '8px 12px', color: 'var(--finv-slate)', fontFamily: 'monospace' }}>sb-auth-token</td>
                    <td style={{ padding: '8px 12px', color: 'var(--finv-slate)' }}>Session d&apos;authentification Supabase</td>
                    <td style={{ padding: '8px 12px', color: 'var(--finv-slate)' }}>Session</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--finv-border)' }}>
                    <td style={{ padding: '8px 12px', color: 'var(--finv-slate)', fontFamily: 'monospace' }}>finv-theme</td>
                    <td style={{ padding: '8px 12px', color: 'var(--finv-slate)' }}>Préférence de thème (clair/sombre)</td>
                    <td style={{ padding: '8px 12px', color: 'var(--finv-slate)' }}>1 an</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--finv-text)', marginBottom: '0.5rem' }}>
              Cookies analytiques
            </h3>
            <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--finv-slate)' }}>
              Ces cookies nous permettent de comprendre comment les visiteurs utilisent le site (pages consultées,
              durée de visite, erreurs rencontrées) afin d&apos;améliorer nos contenus et fonctionnalités. Les données
              collectées sont agrégées et anonymisées — aucune information personnelle identifiable n&apos;est transmise.
            </p>
            <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--finv-slate)', marginTop: '0.5rem' }}>
              Finveria n&apos;utilise pas de solution analytique tierce (Google Analytics ou équivalent) à ce stade.
              Si cela venait à changer, cette politique serait mise à jour avec les détails correspondants.
            </p>
          </div>

          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--finv-text)', marginBottom: '0.5rem' }}>
              Cookies de tiers (affiliation)
            </h3>
            <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--finv-slate)' }}>
              Lorsque vous cliquez sur un lien d&apos;affiliation vers un courtier partenaire, ce courtier peut déposer
              ses propres cookies sur votre appareil afin de suivre l&apos;origine de votre inscription et de nous attribuer
              une éventuelle commission. Ces cookies sont gérés par les courtiers concernés et soumis à leurs propres
              politiques de confidentialité.
            </p>
          </div>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--finv-text)' }}>
            3. Gestion de vos cookies
          </h2>
          <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--finv-slate)', marginBottom: '0.75rem' }}>
            Vous pouvez configurer votre navigateur pour refuser ou supprimer les cookies. Voici les liens vers les
            paramètres des principaux navigateurs :
          </p>
          <ul style={{ paddingLeft: '1.5rem', color: 'var(--finv-slate)', fontSize: '0.95rem', lineHeight: 2 }}>
            <li>
              <a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--finv-green)', textDecoration: 'none' }}>
                Google Chrome
              </a>
            </li>
            <li>
              <a href="https://support.mozilla.org/fr/kb/protection-renforcee-contre-pistage-firefox" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--finv-green)', textDecoration: 'none' }}>
                Mozilla Firefox
              </a>
            </li>
            <li>
              <a href="https://support.apple.com/fr-ch/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--finv-green)', textDecoration: 'none' }}>
                Apple Safari
              </a>
            </li>
            <li>
              <a href="https://support.microsoft.com/fr-fr/microsoft-edge/supprimer-les-cookies-dans-microsoft-edge" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--finv-green)', textDecoration: 'none' }}>
                Microsoft Edge
              </a>
            </li>
          </ul>
          <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--finv-slate)', marginTop: '0.75rem' }}>
            Attention : désactiver les cookies strictement nécessaires peut perturber le fonctionnement du site
            (perte de session, impossibilité de se connecter).
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--finv-text)' }}>
            4. Modifications de cette politique
          </h2>
          <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--finv-slate)' }}>
            Finveria se réserve le droit de modifier la présente politique à tout moment. La date de dernière mise à
            jour est indiquée en tête de page. Pour toute question, contactez-nous à{' '}
            <a href="mailto:support@finveria.ch" style={{ color: 'var(--finv-green)', textDecoration: 'none' }}>
              support@finveria.ch
            </a>.
          </p>
          <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--finv-slate)', marginTop: '0.75rem' }}>
            Pour en savoir plus sur le traitement de vos données personnelles, consultez notre{' '}
            <Link href="/confidentialite" style={{ color: 'var(--finv-green)', textDecoration: 'none' }}>
              Politique de confidentialité
            </Link>.
          </p>
        </section>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 20px 48px", width: "100%" }}>
        <CookieReset />
      </div>
      </main>

      <Footer />
    </div>
  )
}
