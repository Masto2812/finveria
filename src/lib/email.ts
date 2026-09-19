import nodemailer from 'nodemailer'

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? 'mail.infomaniak.com',
  port: parseInt(process.env.SMTP_PORT ?? '465'),
  secure: true, // SSL sur le port 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export const FROM = process.env.SMTP_FROM ?? 'Finveria <support@finveria.ch>'

// ── Envoi ─────────────────────────────────────────────────────────────────────

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  return transporter.sendMail({ from: FROM, to, subject, html })
}

// ── Templates HTML ────────────────────────────────────────────────────────────

function baseLayout(content: string, preheader = '') {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Finveria</title>
</head>
<body style="margin:0;padding:0;background:#F5F3EF;font-family:'Inter',Arial,sans-serif;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>` : ''}
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F3EF;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr>
          <td style="background:#1B3050;border-radius:12px 12px 0 0;padding:24px 32px;">
            <span style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#ffffff;">Finveria</span>
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;padding:32px;border-radius:0 0 12px 12px;">
            ${content}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 0;text-align:center;">
            <p style="font-size:12px;color:#9E9A93;margin:0;">
              © ${new Date().getFullYear()} Finveria &middot; <a href="https://finveria.ch" style="color:#2B6B5A;text-decoration:none;">finveria.ch</a><br/>
              <a href="https://finveria.ch/profil?tab=prefs" style="color:#9E9A93;font-size:11px;">Gérer mes notifications</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export function welcomeEmail(prenom: string) {
  return baseLayout(`
    <h1 style="font-family:Georgia,serif;font-size:24px;color:#1B3050;margin:0 0 12px;">Bienvenue, ${prenom || 'cher investisseur'} 👋</h1>
    <p style="font-size:15px;color:#5C6880;line-height:1.7;margin:0 0 24px;">
      Vous avez activé les notifications par email sur Finveria. Vous recevrez des mises à jour sur votre portefeuille et les actualités financières pertinentes.
    </p>
    <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;width:100%;">
      <tr>
        <td style="background:#F5F3EF;border-radius:10px;padding:20px 24px;border-left:3px solid #2B6B5A;">
          <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#1B3050;">Ce que vous recevrez :</p>
          <ul style="margin:0;padding-left:18px;color:#5C6880;font-size:14px;line-height:2;">
            
            <li>Alertes sur vos positions</li>
            <li>Nouveautés Finveria</li>
          </ul>
        </td>
      </tr>
    </table>
    <a href="https://finveria.ch/portfolio"
      style="display:inline-block;background:#2B6B5A;color:#ffffff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none;">
      Voir mon portefeuille →
    </a>
    <p style="font-size:12px;color:#9E9A93;margin:24px 0 0;">
      Vous pouvez désactiver les notifications à tout moment dans vos
      <a href="https://finveria.ch/profil?tab=prefs" style="color:#2B6B5A;">préférences</a>.
    </p>`,
    `Notifications activées — bienvenue ${prenom || ''} !`
  )
}

export function farewellEmail(prenom: string) {
  return baseLayout(`
    <h1 style="font-family:Georgia,serif;font-size:22px;color:#1B3050;margin:0 0 12px;">Notifications désactivées</h1>
    <p style="font-size:15px;color:#5C6880;line-height:1.7;margin:0 0 20px;">
      Bonjour ${prenom || ''},<br/><br/>
      Vous avez désactivé les notifications par email. Vous ne recevrez plus d'emails de Finveria, à l'exception des emails liés à la sécurité de votre compte.
    </p>
    <p style="font-size:14px;color:#5C6880;">
      Vous pouvez les réactiver à tout moment depuis vos
      <a href="https://finveria.ch/profil?tab=prefs" style="color:#2B6B5A;font-weight:600;">préférences de profil</a>.
    </p>`)
}
