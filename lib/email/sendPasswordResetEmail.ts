import 'server-only'
import { translations, type Lang } from '@/lib/i18n/translations'
import { sendBrandedEmail } from './brandedEmail'

export async function sendPasswordResetEmail(params: {
  to: string
  lang: Lang
  resetLink: string
  origin: string
}): Promise<void> {
  const { to, lang, resetLink, origin } = params
  const t = translations[lang]
  await sendBrandedEmail({
    to,
    lang,
    origin,
    subject: t.resetEmail_subject,
    heading: t.resetEmail_heading,
    body: t.resetEmail_body,
    buttonLabel: t.resetEmail_button,
    buttonLink: resetLink,
    footnote: t.resetEmail_ignoreNote,
  })
}
