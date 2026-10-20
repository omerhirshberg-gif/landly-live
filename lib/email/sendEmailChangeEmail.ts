import 'server-only'
import { translations, type Lang } from '@/lib/i18n/translations'
import { escapeHtml, FONT_STACK, sendBrandedEmail, type BrandedEmailContent } from './brandedEmail'

/**
 * The 6-digit code to the new address, built without sending. The digits sit
 * in their own left-to-right box (Hebrew too), large and spaced so they read
 * at a glance and copy cleanly; there's nothing to click.
 */
export function buildEmailChangeCodeEmail(lang: Lang, code: string): { subject: string } & BrandedEmailContent {
  const t = translations[lang]
  const detailsHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="#F1F5F9" style="padding:20px 16px;background-color:#F1F5F9;border:1px solid #E2E8F0;border-radius:12px;font-family:${FONT_STACK};">
                    <p style="margin:0 0 8px 0;font-size:12px;line-height:16px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#64748B;">${escapeHtml(t.emailChange_codeLabel)}</p>
                    <p dir="ltr" style="margin:0;font-family:'SF Mono',Menlo,Consolas,'Courier New',monospace;font-size:34px;line-height:40px;font-weight:800;letter-spacing:10px;color:#0F172A;">${escapeHtml(code)}</p>
                  </td>
                </tr>
              </table>`
  return {
    subject: t.emailChange_subject,
    heading: t.emailChange_heading,
    body: t.emailChange_body,
    detailsHtml,
    footnote: t.emailChange_ignoreNote,
  }
}

/** Sends the code; the account's email changes only once it's typed back in the profile. */
export async function sendEmailChangeCode(params: { to: string; lang: Lang; origin: string; code: string }): Promise<void> {
  const { to, lang, origin, code } = params
  await sendBrandedEmail({ to, lang, origin, ...buildEmailChangeCodeEmail(lang, code) })
}

/** The security notice to the previous address once the change is applied. */
export async function sendEmailChangedAlert(params: { to: string; newEmail: string; lang: Lang; origin: string }): Promise<void> {
  const { to, newEmail, lang, origin } = params
  const t = translations[lang]
  await sendBrandedEmail({
    to,
    lang,
    origin,
    subject: t.emailChanged_subject,
    heading: t.emailChanged_heading,
    body: t.emailChanged_body.replace('{email}', newEmail),
    buttonLabel: t.emailChanged_button,
    buttonLink: `${origin}/support`,
    footnote: t.emailChanged_note,
  })
}
