import 'server-only'
import { translations, type Lang } from '@/lib/i18n/translations'
import { sendBrandedEmail, type BrandedEmailContent } from './brandedEmail'

/**
 * "A passkey was added to your account": sent after every new passkey, so a
 * member whose session was misused finds out and can remove it in Settings.
 * The passkey's name goes through the shell's escaping like any body text.
 */
export function buildPasskeyAddedEmail(lang: Lang, passkeyName: string, origin: string): { subject: string } & BrandedEmailContent {
  const t = translations[lang]
  return {
    subject: t.passkeyEmail_subject,
    heading: t.passkeyEmail_heading,
    body: t.passkeyEmail_body.replace('{name}', () => passkeyName),
    buttonLabel: t.passkeyEmail_button,
    buttonLink: `${origin}/settings/privacy-security`,
    footnote: t.passkeyEmail_note,
  }
}

export async function sendPasskeyAddedEmail(params: { to: string; lang: Lang; origin: string; passkeyName: string }): Promise<void> {
  const { to, lang, origin, passkeyName } = params
  await sendBrandedEmail({ to, lang, origin, ...buildPasskeyAddedEmail(lang, passkeyName, origin) })
}
