import 'server-only'
import { translations, type Lang } from '@/lib/i18n/translations'
import { sendBrandedEmail, type BrandedEmailContent } from './brandedEmail'

/**
 * The welcome email's subject and shell content, built without sending.
 * Greets by first name when there is one; the shell escapes the heading.
 */
export function buildWelcomeEmail(lang: Lang, firstName: string, origin: string): { subject: string } & BrandedEmailContent {
  const t = translations[lang]
  const name = firstName.trim()
  return {
    subject: t.welcomeEmail_subject,
    heading: name ? t.welcomeEmail_headingNamed.replace('{firstName}', () => name) : t.welcomeEmail_heading,
    body: t.welcomeEmail_body,
    buttonLabel: t.welcomeEmail_button,
    buttonLink: `${origin}/member`,
    noteTitle: t.welcomeEmail_noteTitle,
    footnote: t.welcomeEmail_note,
  }
}

export async function sendWelcomeEmail(params: {
  to: string
  lang: Lang
  origin: string
  firstName: string
}): Promise<void> {
  const { to, lang, origin, firstName } = params
  await sendBrandedEmail({ to, lang, origin, ...buildWelcomeEmail(lang, firstName, origin) })
}
