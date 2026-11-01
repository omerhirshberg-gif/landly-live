import { NextResponse } from 'next/server'
import { corsHeaders } from '@/lib/auth/cors'
import { checkUidRateLimit } from '@/lib/auth/uidRateLimit'
import { getAdminDb } from '@/lib/firebase/admin'
import { RequestAuthError, requireVerifiedCustomerUid } from '@/lib/firebase/verifyRequestUser'
import { discountPercent } from '@/lib/perks/perksFilter'
import { buildPkpass, PassBuildError, PKPASS_MIME_TYPE } from '@/lib/wallet/applePass'
import { getPassConfig } from '@/lib/wallet/passConfig'
import { createPassTicket, verifyPassTicket } from '@/lib/wallet/passTicket'
import { isPassEligible, isVoucherId, readPassVoucher, type PassVoucher } from '@/lib/wallet/passVoucher'

// POST (Bearer ID token): checks the member owns an active voucher and answers
// with a 60-second URL (lib/wallet/passTicket.ts). GET (?ticket=): that URL,
// which checks the voucher again and returns the .pkpass. Failures carry a
// coarse `reason` the clients map to copy (lib/wallet/walletClient.ts). Sessions
// revoked in Firestore's authFresh() sense are already refused here: revoking
// also revokes the refresh tokens verifyIdToken checks.
type Params = { params: Promise<{ voucherId: string }> }

const METHODS = 'POST, OPTIONS'

function replyFor(request: Request) {
  const headers = corsHeaders(request, METHODS)
  return (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers })
}

async function loadVoucher(voucherId: string): Promise<PassVoucher | null> {
  if (!isVoucherId(voucherId)) return null
  return readPassVoucher(await getAdminDb().collection('vouchers').doc(voucherId).get())
}

export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request, METHODS) })
}

export async function POST(request: Request, { params }: Params) {
  const reply = replyFor(request)
  const config = getPassConfig()
  if (config.mode === 'unavailable') return reply({ error: 'Apple Wallet is unavailable.', reason: 'unavailable' }, 503)

  let uid: string
  try {
    uid = await requireVerifiedCustomerUid(request)
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return reply({ error: error.message, reason: error.status === 503 ? 'unavailable' : 'unauthorized' }, error.status)
    }
    return reply({ error: 'Authorization service unavailable.', reason: 'unavailable' }, 503)
  }
  if (checkUidRateLimit('wallet', uid)) return reply({ error: 'Too many requests.', reason: 'rateLimited' }, 429)

  const { voucherId } = await params
  let voucher: PassVoucher | null
  try {
    voucher = await loadVoucher(voucherId)
  } catch {
    return reply({ error: 'Service unavailable.', reason: 'unavailable' }, 503)
  }
  // Missing and foreign read alike, as the Firestore rules deny both.
  if (!voucher || voucher.userId !== uid) return reply({ error: 'Voucher not found.', reason: 'notFound' }, 404)
  if (!isPassEligible(voucher)) return reply({ error: 'This voucher can\'t be added.', reason: 'notEligible' }, 409)

  const ticket = createPassTicket(config.ticketSecret, voucher.id, uid)
  const url = new URL(request.url)
  url.search = new URLSearchParams({ ticket }).toString()
  return reply({ url: url.toString(), mock: config.mode === 'mock' })
}

export async function GET(request: Request, { params }: Params) {
  const config = getPassConfig()
  if (config.mode === 'unavailable') return NextResponse.json({ error: 'Apple Wallet is unavailable.' }, { status: 503 })

  const { voucherId } = await params
  const uid = verifyPassTicket(config.ticketSecret, new URL(request.url).searchParams.get('ticket'), voucherId)
  if (!uid) {
    console.warn('Apple Wallet: a pass ticket was refused (expired, forged or for another voucher).')
    return NextResponse.json({ error: 'This link has expired.' }, { status: 401 })
  }

  try {
    const voucher = await loadVoucher(voucherId)
    if (!voucher || voucher.userId !== uid) return NextResponse.json({ error: 'Voucher not found.' }, { status: 404 })
    if (!isPassEligible(voucher)) return NextResponse.json({ error: 'This voucher can\'t be added.' }, { status: 409 })

    const db = getAdminDb()
    // Decoration: the frozen order gives the discount, the offer its photo, the
    // member their name. A pass works without any of them.
    const [order, offer, member] = await Promise.all([
      db.collection('orders').doc(voucher.id).get().catch(() => null),
      db.collection('offers').doc(voucher.offerId).get().catch(() => null),
      db.collection('users').doc(uid).get().catch(() => null),
    ])
    const original = order?.get('originalPrice')
    const paid = order?.get('amount')
    const name = member?.get('displayName')
    const pass = await buildPkpass(voucher, config, {
      discountPercent: typeof original === 'number' && typeof paid === 'number' ? discountPercent(original, paid) : null,
      imageUrl: typeof offer?.get('imageUrl') === 'string' ? offer.get('imageUrl') : '',
      category: typeof offer?.get('category') === 'string' ? offer.get('category') : '',
      holderName: typeof name === 'string' ? name.trim() : null,
    })

    return new NextResponse(new Uint8Array(pass), {
      headers: {
        'Content-Type': PKPASS_MIME_TYPE,
        'Content-Disposition': 'attachment; filename="landly-voucher.pkpass"',
        'Cache-Control': 'private, no-store',
        ...(config.mode === 'mock' ? { 'X-Landly-Pass-Mock': '1' } : {}),
      },
    })
  } catch (error) {
    // The stage and the library's message only: never the ticket, the voucher id (it holds the uid) or a credential.
    const stage = error instanceof PassBuildError ? error.stage : 'voucher'
    console.error(`Apple Wallet: building a pass failed at ${stage}.`, error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json({ error: 'Service unavailable.' }, { status: 503 })
  }
}
