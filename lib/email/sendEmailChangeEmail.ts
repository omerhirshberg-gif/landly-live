import 'server-only'
import { translations, type Lang } from '@/lib/i18n/translations'
import { sendBrandedEmail } from './brandedEmail'

/** The link to the new address; the account's email changes only once it's opened. */
export async function sendEmailChangeVerification(params: { to: string; lang: Lang; confirmLink: string; origin: string }): Promise<void> {
  const { to, lang, confirmLink, origin } = params
  const t = translations[lang]
  await sendBrandedEmail({
    to,
    lang,
    origin,
    subject: t.emailChange_subject,
    heading: t.emailChange_heading,
    body: t.emailChange_body,
    buttonLabel: t.emailChange_button,
    buttonLink: confirmLink,
    footnote: t.emailChange_ignoreNote,
  })
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
