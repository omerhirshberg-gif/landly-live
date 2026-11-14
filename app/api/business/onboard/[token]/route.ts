import { NextResponse } from 'next/server'
import { clientIp } from '@/lib/auth/clientIp'
import { CipherConfigError } from '@/lib/crypto/fieldCipher'
import { getAdminAuth, getAdminBucket, getAdminDb } from '@/lib/firebase/admin'
import { sendContractEmails } from '@/lib/merchants/contractEmail'
import {
  InviteUnavailableError, MAX_CHEQUE_BYTES, OnboardingInputError, completeOnboarding, loadInvite,
} from '@/lib/merchants/onboarding'

// The public onboarding link. Every failure to find a usable invite answers the
// same 404, whether the token never existed, expired, was used or was revoked.
// A per-IP floor stops token guessing (256-bit tokens make that hopeless anyway).
const WINDOW_MS = 15 * 60 * 1000
const MAX_HITS = 60
const hits = new Map<string, { count: number; resetAt: number }>()
function limited(request: Request): boolean {
  const key = clientIp(request)
  const now = Date.now()
  const entry = hits.get(key)
  if (!entry || now > entry.resetAt) { hits.set(key, { count: 1, resetAt: now + WINDOW_MS }); return false }
  return ++entry.count > MAX_HITS
}

const NO_STORE = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' }
const gone = () => NextResponse.json({ error: 'This link is no longer valid.' }, { status: 404, headers: NO_STORE })

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  if (limited(request)) return NextResponse.json({ error: 'Too many requests.' }, { status: 429, headers: NO_STORE })
  const { token } = await params
  try {
    return NextResponse.json(await loadInvite(getAdminDb(), token, { markOpened: true }), { headers: NO_STORE })
  } catch (err) {
    if (err instanceof InviteUnavailableError) return gone()
    console.error('Onboarding lookup failed', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500, headers: NO_STORE })
  }
}

// multipart: the text fields, `signature` (PNG) and `cheque` (JPG, PNG or PDF).
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  if (limited(request)) return NextResponse.json({ error: 'Too many requests.' }, { status: 429, headers: NO_STORE })
  const { token } = await params
  const declared = Number(request.headers.get('content-length') ?? 0)
  if (declared > MAX_CHEQUE_BYTES + 1024 * 1024) return NextResponse.json({ error: 'The upload is too large.' }, { status: 413, headers: NO_STORE })
  let form: FormData
  try { form = await request.formData() } catch { return NextResponse.json({ error: 'Invalid form.' }, { status: 400, headers: NO_STORE }) }
  const signature = form.get('signature')
  const cheque = form.get('cheque')
  if (!(signature instanceof File) || !(cheque instanceof File)) {
    return NextResponse.json({ error: 'Signature and cheque are required.', fields: { signature: signature instanceof File ? undefined : 'invalid', cheque: cheque instanceof File ? undefined : 'invalid' } }, { status: 400, headers: NO_STORE })
  }
  const raw: Record<string, unknown> = {}
  for (const [key, value] of form.entries()) if (typeof value === 'string') raw[key] = value
  const db = getAdminDb()
  const auth = getAdminAuth()
  try {
    const result = await completeOnboarding(db, auth, {
      async save(path, bytes, contentType) {
        await getAdminBucket().file(path).save(Buffer.from(bytes), { contentType, resumable: false, metadata: { cacheControl: 'private, no-store' } })
      },
    }, {
      token, raw, request,
      signaturePng: new Uint8Array(await signature.arrayBuffer()),
      cheque: { bytes: new Uint8Array(await cheque.arrayBuffer()), type: cheque.type },
    })
    const emails = await sendContractEmails(auth, result)
    return NextResponse.json({ ok: true, emailed: emails.merchant }, { headers: NO_STORE })
  } catch (err) {
    if (err instanceof InviteUnavailableError) return gone()
    if (err instanceof OnboardingInputError) return NextResponse.json({ error: err.message, fields: err.fields }, { status: 400, headers: NO_STORE })
    if (err instanceof CipherConfigError) {
      console.error('Onboarding blocked: encryption key missing', err.message)
      return NextResponse.json({ error: 'We could not save this securely right now. Please try again later.' }, { status: 503, headers: NO_STORE })
    }
    if ((err as { code?: string })?.code === 'auth/email-already-exists') {
      return NextResponse.json({ error: 'An account with this email already exists. Contact GoLandly to continue.' }, { status: 409, headers: NO_STORE })
    }
    console.error('Onboarding failed', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500, headers: NO_STORE })
  }
}
