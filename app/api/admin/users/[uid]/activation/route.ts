import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { writeAudit } from '@/lib/admin/auditLog'
import { applicationOrigin, isValidLang } from '@/lib/auth/requestContext'
import { sendVerificationEmail } from '@/lib/email/sendVerificationEmail'
import { EmailProviderError, emailConfigProblem } from '@/lib/email/brandedEmail'
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin'

// Re-sends the verification email to a member whose address isn't verified yet.
export async function POST(request: Request, { params }: { params: Promise<{ uid: string }> }) {
  const authError = requireAdminAuth(request)
  if (authError) return authError
  const { uid } = await params
  const db = getAdminDb()
  const [user, snap] = await Promise.all([getAdminAuth().getUser(uid).catch(() => null), db.collection('users').doc(uid).get()])
  if (!user?.email || !snap.exists) return NextResponse.json({ error: 'Member not found.' }, { status: 404 })
  if (user.emailVerified) return NextResponse.json({ error: 'Email is already verified.' }, { status: 409 })
  if (user.disabled) return NextResponse.json({ error: 'This account is suspended.' }, { status: 409 })
  const problem = emailConfigProblem()
  if (problem) return NextResponse.json({ error: problem }, { status: 503 })
  try {
    const origin = applicationOrigin()
    const oobCode = new URL(await getAdminAuth().generateEmailVerificationLink(user.email)).searchParams.get('oobCode')
    if (!oobCode) throw new Error('No oobCode')
    const lang = isValidLang(snap.get('preferredLanguage')) ? snap.get('preferredLanguage') : 'en'
    await sendVerificationEmail({ to: user.email, lang, verifyLink: `${origin}/verify-email?oobCode=${encodeURIComponent(oobCode)}`, origin })
    await writeAudit(db, request, { action: 'user.resendActivation', targetType: 'user', targetId: uid })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof EmailProviderError) return NextResponse.json({ error: 'The email provider refused the message.' }, { status: 502 })
    console.error('Admin resend activation failed', err)
    return NextResponse.json({ error: 'Could not send the email.' }, { status: 500 })
  }
}
