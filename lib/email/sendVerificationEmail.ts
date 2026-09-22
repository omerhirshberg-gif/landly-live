import 'server-only'
import { translations, type Lang } from '@/lib/i18n/translations'
import { sendBrandedEmail } from './brandedEmail'

export async function sendVerificationEmail(params: {
  to: string
  lang: Lang
  verifyLink: string
  origin: string
}): Promise<void> {
  const { to, lang, verifyLink, origin } = params
  const t = translations[lang]
  await sendBrandedEmail({
    to,
    lang,
    origin,
    subject: t.verifyEmail_subject,
    heading: t.verifyEmail_heading,
    body: t.verifyEmail_body,
    buttonLabel: t.verifyEmail_button,
    buttonLink: verifyLink,
    footnote: t.verifyEmail_ignoreNote,
  })
}
