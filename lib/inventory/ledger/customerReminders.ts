import 'server-only'
import { Timestamp, type Firestore } from 'firebase-admin/firestore'
import { getAdminAuth } from '@/lib/firebase/admin'
import { applicationOrigin, isValidLang } from '@/lib/auth/requestContext'
import { emailConfigProblem, sendBrandedEmail } from '@/lib/email/brandedEmail'
import { translations } from '@/lib/i18n/translations'

// Reminds a member 30 and 7 days before a Raayonit voucher of theirs expires. Marked on the wallet voucher
// (expiryReminders.d30 / d7) once sent, so a re-run never mails twice. Always the neutral multi-chain wording: it never names
// Raayonit, so it is safe while the display flag is off.
const DAY_MS = 86_400_000
export const REMINDER_WINDOWS = [{ key: 'd7', days: 7 }, { key: 'd30', days: 30 }] as const

/** Which reminder (if any) a voucher is due for now. The nearer window wins, and a window never repeats. Pure. */
export function dueReminder(expiresAtMs: number, nowMs: number, sent: { d7?: boolean; d30?: boolean } | undefined): 'd7' | 'd30' | null {
  const left = expiresAtMs - nowMs
  if (left <= 0) return null
  if (left <= 7 * DAY_MS && !sent?.d7) return 'd7'
  if (left <= 30 * DAY_MS && left > 7 * DAY_MS && !sent?.d30 && !sent?.d7) return 'd30'
  return null
}

export async function sendExpiryReminders(db: Firestore, now: Timestamp = Timestamp.now(), limit = 300): Promise<{ sent: number; skipped: number }> {
  const horizon = Timestamp.fromMillis(now.toMillis() + 30 * DAY_MS)
  const snap = await db.collection('vouchers').where('fulfillmentType', '==', 'raayonit_pool').where('status', '==', 'active').where('expiresAt', '<=', horizon).limit(limit).get()
  let sent = 0
  let skipped = 0
  const problem = emailConfigProblem()
  for (const doc of snap.docs) {
    const v = doc.data()
    const which = v.expiresAt instanceof Timestamp ? dueReminder(v.expiresAt.toMillis(), now.toMillis(), v.expiryReminders) : null
    if (!which || typeof v.userId !== 'string') { skipped++; continue }
    if (problem) { skipped++; continue }
    try {
      const [user, profile] = await Promise.all([getAdminAuth().getUser(v.userId), db.collection('users').doc(v.userId).get()])
      if (!user.email) { skipped++; continue }
      const preferred = profile.data()?.preferredLanguage
      const lang = isValidLang(preferred) ? preferred : 'en'
      const t = translations[lang] ?? translations.en
      const days = which === 'd7' ? 7 : 30
      const fill = (text: string) => text.replace('{days}', String(days))
      const origin = applicationOrigin()
      await sendBrandedEmail({
        to: user.email, lang, origin, subject: fill(t.expiry_reminder_subject), heading: fill(t.expiry_reminder_heading), body: fill(t.expiry_reminder_body),
        buttonLabel: t.expiry_reminder_button, buttonLink: `${origin}/member/vouchers/${encodeURIComponent(doc.id)}`, footnote: t.expiry_reminder_footnote,
      })
      await doc.ref.update({ [`expiryReminders.${which}`]: true })
      sent++
    } catch (error) {
      console.error('Expiry reminder failed', { voucherId: doc.id, reason: error instanceof Error ? error.message : 'unknown' })
      skipped++
    }
  }
  return { sent, skipped }
}
