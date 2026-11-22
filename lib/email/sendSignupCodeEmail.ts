import 'server-only'
import { translations, type Lang } from '@/lib/i18n/translations'
import { sendBrandedEmail } from './brandedEmail'
import { buildEmailChangeCodeEmail } from './sendEmailChangeEmail'

/**
 * The sign-up verification code: the same large left-to-right code box as the
 * email-change code, with its own sign-up wording. Nothing to click.
 */
export function buildSignupCodeEmail(lang: Lang, code: string) {
  const t = translations[lang]
  return buildEmailChangeCodeEmail(lang, code, {
    subject: t.signupOtp_subject,
    heading: t.signupOtp_heading,
    body: t.signupOtp_body,
    footnote: t.signupOtp_ignoreNote,
  })
}

/** Sends the code to the new account's own address (replies go to the team inbox: sendBrandedEmail). */
export async function sendSignupCodeEmail(params: { to: string; lang: Lang; origin: string; code: string }): Promise<void> {
  const { to, lang, origin, code } = params
  await sendBrandedEmail({ to, lang, origin, ...buildSignupCodeEmail(lang, code) })
}
