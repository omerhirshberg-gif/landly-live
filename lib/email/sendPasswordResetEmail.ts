import 'server-only'
import { Resend } from 'resend'
import { translations, RTL_LANGS, type Lang } from '@/lib/i18n/translations'

let resend: Resend | undefined

function getResend(): Resend {
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY)
  return resend
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

function buildHtml(params: { lang: Lang; origin: string; resetLink: string }): string {
  const { lang, origin, resetLink } = params
  const t = translations[lang]
  const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
  const dir = isRtl ? 'rtl' : 'ltr'
  const align = isRtl ? 'right' : 'left'

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" dir="${dir}" style="max-width:480px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;">
          <tr>
            <td align="center" style="padding:32px 32px 8px 32px;">
              <img src="${origin}/logo.jpg" alt="Landly" width="96" style="display:block;border-radius:8px;">
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 0 32px;text-align:${align};">
              <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:800;color:#0f172a;">${escapeHtml(t.resetEmail_heading)}</h1>
              <p style="margin:0 0 24px 0;font-size:14px;line-height:1.6;color:#475569;">${escapeHtml(t.resetEmail_body)}</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 32px 24px 32px;">
              <a href="${resetLink}" style="display:inline-block;background-color:#0038b8;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:9999px;">${escapeHtml(t.resetEmail_button)}</a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px 32px;text-align:${align};">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">${escapeHtml(t.resetEmail_ignoreNote)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export async function sendPasswordResetEmail(params: {
  to: string
  lang: Lang
  resetLink: string
  origin: string
}): Promise<void> {
  const { to, lang, resetLink, origin } = params
  const from = process.env.EMAIL_FROM
  if (!from) throw new Error('EMAIL_FROM is not configured')

  const { error } = await getResend().emails.send({
    from,
    to,
    subject: translations[lang].resetEmail_subject,
    html: buildHtml({ lang, origin, resetLink }),
  })
  if (error) throw new Error(`Resend send failed: ${error.message}`)
}
