import 'server-only'
import { SUPPORT_EMAIL } from '@/lib/config'
import { applicationOrigin } from '@/lib/auth/requestContext'
import { EmailProviderError, emailConfigProblem, escapeHtml, getResend } from '@/lib/email/brandedEmail'
import { sendPasswordResetEmail } from '@/lib/email/sendPasswordResetEmail'
import type { Auth } from 'firebase-admin/auth'

// Sends the signed agreement to the merchant and a copy to the GoLandly team,
// and (for a new login) the link to set a password. Best effort: the contract
// is already stored and signed, so an email problem is reported, never thrown.
export async function sendContractEmails(
  auth: Auth,
  c: { email: string; lang: 'he' | 'en'; businessName: string; contractId: string; pdf: Uint8Array; createdAccount: boolean },
): Promise<{ merchant: boolean; team: boolean; passwordLink: boolean }> {
  const result = { merchant: false, team: false, passwordLink: false }
  if (emailConfigProblem()) return result
  const he = c.lang === 'he'
  const attachments = [{ filename: `landly-agreement-${c.contractId}.pdf`, content: Buffer.from(c.pdf) }]
  const send = async (to: string, subject: string, html: string) => {
    const { error } = await getResend().emails.send({ from: process.env.EMAIL_FROM!, to, replyTo: SUPPORT_EMAIL, subject, html, attachments })
    if (error) throw new EmailProviderError(error.name, error.statusCode, error.message)
  }
  const wrap = (text: string) => `<div dir="${he ? 'rtl' : 'ltr'}" style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;line-height:1.6;color:#0b1b3d">${text}</div>`
  try {
    await send(c.email, he ? 'ההסכם החתום שלכם עם GoLandly' : 'Your signed agreement with GoLandly',
      wrap(he ? `<p>תודה! ההסכם עבור ${escapeHtml(c.businessName)} נחתם. עותק מצורף.</p>` : `<p>Thank you! The agreement for ${escapeHtml(c.businessName)} is signed. A copy is attached.</p>`))
    result.merchant = true
  } catch (err) { console.error('Contract email to merchant failed', err) }
  try {
    await send(SUPPORT_EMAIL, `Merchant onboarded: ${c.businessName}`, wrap(`<p>${escapeHtml(c.businessName)} completed onboarding and signed the agreement (${escapeHtml(c.contractId)}).</p>`))
    result.team = true
  } catch (err) { console.error('Contract email to team failed', err) }
  if (c.createdAccount) {
    try {
      const origin = applicationOrigin()
      const oobCode = new URL(await auth.generatePasswordResetLink(c.email)).searchParams.get('oobCode')
      if (!oobCode) throw new Error('No oobCode')
      await sendPasswordResetEmail({ to: c.email, lang: c.lang, resetLink: `${origin}/reset-password?oobCode=${encodeURIComponent(oobCode)}`, origin })
      result.passwordLink = true
    } catch (err) { console.error('Merchant password link failed', err) }
  }
  return result
}
