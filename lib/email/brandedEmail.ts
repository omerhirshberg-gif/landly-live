import 'server-only'
import { Resend } from 'resend'
import { RTL_LANGS, translations, type Lang } from '@/lib/i18n/translations'
import { PRODUCTION_API_ORIGIN } from '@/lib/apiOrigin'
import { SUPPORT_EMAIL } from '@/lib/config'

// Shared shell for every transactional email we send ourselves via Resend
// (password reset, email verification) so they stay visually identical; each
// email supplies only its heading, body, button and security footnote.

let resend: Resend | undefined

export function getResend(): Resend {
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY)
  return resend
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

export interface BrandedEmailContent {
  heading: string
  body: string
  buttonLabel: string
  buttonLink: string
  footnote: string
}

// Always the production asset, never `${origin}/...`: mail clients fetch
// images through their own proxies, which can't reach a LAN or localhost
// APP_URL, so a dev-built email would otherwise show a broken image.
// 117x112 source shown at 48x46, so it stays sharp on 2x/3x screens.
export const EMAIL_LOGO_URL = `${PRODUCTION_API_ORIGIN}/logo-mark.png`

const FONT_STACK = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

// Layout: all-light. A pale slate canvas (#F8FAFC) around one white card with
// a brand-blue accent bar on top; header (emblem + live "Landly" text, readable
// with images off), body, button, security note and a muted footer all sit on
// white. Tables and inline styles only; the button has a VML twin because
// Outlook on Windows ignores padding/radius on <a>.
function buildHtml(params: { lang: Lang; origin: string } & BrandedEmailContent): string {
  const { lang, origin, heading, body, buttonLabel, buttonLink, footnote } = params
  const t = translations[lang]
  const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
  const dir = isRtl ? 'rtl' : 'ltr'
  const align = isRtl ? 'right' : 'left'
  // The security note's accent border sits on the reading-start side.
  const startBorder = isRtl ? 'border-right' : 'border-left'
  const link = escapeHtml(buttonLink)
  const label = escapeHtml(buttonLabel)
  const supportHref = escapeHtml(`mailto:${SUPPORT_EMAIL}`)
  const year = new Date().getFullYear()

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${escapeHtml(heading)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;width:100%;background-color:#F8FAFC;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:#F8FAFC;">${escapeHtml(body)}&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F8FAFC" style="background-color:#F8FAFC;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <!--[if mso]><table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td><![endif]-->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" dir="${dir}" bgcolor="#FFFFFF" style="max-width:560px;width:100%;background-color:#FFFFFF;border:1px solid #E2E8F0;border-radius:16px;border-collapse:separate;overflow:hidden;">
          <tr>
            <td height="4" bgcolor="#0066FF" style="height:4px;line-height:4px;font-size:4px;background-color:#0066FF;background-image:linear-gradient(90deg,#0066FF,#2563EB);border-radius:16px 16px 0 0;">&nbsp;</td>
          </tr>
          <tr>
            <td align="center" bgcolor="#FFFFFF" style="padding:36px 32px 8px 32px;background-color:#FFFFFF;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" dir="${dir}" align="center">
                <tr>
                  <td valign="middle" style="padding-${isRtl ? 'left' : 'right'}:12px;">
                    <img src="${escapeHtml(EMAIL_LOGO_URL)}" alt="Landly" width="48" height="46" style="display:block;width:48px;height:46px;border:0;outline:none;text-decoration:none;">
                  </td>
                  <td valign="middle" style="font-family:${FONT_STACK};font-size:26px;line-height:30px;font-weight:800;color:#0038B8;letter-spacing:-0.5px;">Landly</td>
                </tr>
              </table>
              <p style="margin:10px 0 0 0;font-family:${FONT_STACK};font-size:11px;line-height:16px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#64748B;">${escapeHtml(t.email_tagline)}</p>
            </td>
          </tr>
          <tr>
            <td bgcolor="#FFFFFF" dir="${dir}" style="padding:28px 40px 8px 40px;background-color:#FFFFFF;text-align:${align};font-family:${FONT_STACK};">
              <h1 style="margin:0 0 14px 0;font-family:${FONT_STACK};font-size:26px;line-height:34px;font-weight:800;color:#0F172A;letter-spacing:-0.3px;">${escapeHtml(heading)}</h1>
              <p style="margin:0;font-family:${FONT_STACK};font-size:16px;line-height:1.6;color:#475569;">${escapeHtml(body)}</p>
            </td>
          </tr>
          <tr>
            <td align="center" bgcolor="#FFFFFF" style="padding:32px 40px 8px 40px;background-color:#FFFFFF;">
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${link}" style="height:52px;v-text-anchor:middle;width:300px;" arcsize="23%" stroke="f" fillcolor="#0066FF">
                <w:anchorlock/>
                <center style="color:#FFFFFF;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">${label}</center>
              </v:roundrect>
              <![endif]-->
              <!--[if !mso]><!-->
              <a href="${link}" target="_blank" style="display:inline-block;background-color:#0066FF;color:#FFFFFF;font-family:${FONT_STACK};font-size:16px;line-height:20px;font-weight:700;text-decoration:none;padding:16px 36px;border-radius:12px;border:1px solid #0058DD;box-shadow:0 6px 16px rgba(0,102,255,0.22);mso-hide:all;">${label}</a>
              <!--<![endif]-->
            </td>
          </tr>
          <tr>
            <td bgcolor="#FFFFFF" dir="${dir}" style="padding:20px 40px 0 40px;background-color:#FFFFFF;text-align:${align};font-family:${FONT_STACK};">
              <p style="margin:0 0 4px 0;font-size:13px;line-height:20px;color:#64748B;">${escapeHtml(t.email_linkFallback)}</p>
              <p dir="ltr" style="margin:0;font-size:13px;line-height:20px;word-break:break-all;text-align:${align};"><a href="${link}" target="_blank" style="color:#2563EB;text-decoration:underline;">${link}</a></p>
            </td>
          </tr>
          <tr>
            <td bgcolor="#FFFFFF" style="padding:28px 40px 40px 40px;background-color:#FFFFFF;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" dir="${dir}">
                <tr>
                  <td bgcolor="#F1F5F9" style="padding:16px 18px;background-color:#F1F5F9;border:1px solid #E2E8F0;${startBorder}:3px solid #2563EB;border-radius:10px;text-align:${align};font-family:${FONT_STACK};">
                    <p style="margin:0 0 4px 0;font-size:13px;line-height:20px;font-weight:700;color:#0F172A;">&#128274;&nbsp;${escapeHtml(t.email_securityTitle)}</p>
                    <p style="margin:0;font-size:13px;line-height:20px;color:#475569;">${escapeHtml(footnote)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" bgcolor="#FFFFFF" style="padding:24px 32px 32px 32px;background-color:#FFFFFF;border-top:1px solid #E2E8F0;border-radius:0 0 16px 16px;font-family:${FONT_STACK};">
              <p style="margin:0 0 6px 0;font-size:13px;line-height:20px;color:#64748B;">${escapeHtml(t.email_footerHelp)}</p>
              <p style="margin:0 0 18px 0;font-size:13px;line-height:20px;"><a href="${supportHref}" style="color:#2563EB;text-decoration:none;font-weight:600;">${escapeHtml(SUPPORT_EMAIL)}</a>&nbsp;&nbsp;<span style="color:#CBD5E1;">|</span>&nbsp;&nbsp;<a href="${escapeHtml(`${origin}/support`)}" target="_blank" style="color:#2563EB;text-decoration:none;font-weight:600;">${escapeHtml(t.email_footerSupport)}</a></p>
              <p style="margin:0;font-size:12px;line-height:18px;color:#94A3B8;">&copy; ${year} Landly. ${escapeHtml(t.footer_copyright_notice)}<br>${escapeHtml(t.footer_location)}</p>
            </td>
          </tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`
}

/** Resend rejected the send; `code` is Resend's error name (e.g. validation_error, daily_quota_exceeded). */
export class EmailProviderError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number | null,
    message: string
  ) {
    super(`Resend send failed: ${message}`)
    this.name = 'EmailProviderError'
  }
}

/** Names the first missing email setting, or null when sending is configured. */
export function emailConfigProblem(): string | null {
  if (!process.env.RESEND_API_KEY) return 'RESEND_API_KEY is not configured'
  if (!process.env.EMAIL_FROM) return 'EMAIL_FROM is not configured'
  return null
}

export async function sendBrandedEmail(
  params: { to: string; lang: Lang; origin: string; subject: string } & BrandedEmailContent
): Promise<void> {
  const { to, subject, ...content } = params
  const problem = emailConfigProblem()
  if (problem) throw new Error(problem)

  const { error } = await getResend().emails.send({ from: process.env.EMAIL_FROM!, to, subject, html: buildHtml(content) })
  if (error) throw new EmailProviderError(error.name, error.statusCode, error.message)
}
