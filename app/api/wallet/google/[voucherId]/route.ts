import { NextResponse } from 'next/server'
import { corsHeaders } from '@/lib/auth/cors'
import { checkUidRateLimit } from '@/lib/auth/uidRateLimit'
import { getAdminDb } from '@/lib/firebase/admin'
import { RequestAuthError, requireVerifiedCustomerUid } from '@/lib/firebase/verifyRequestUser'
import { discountPercent } from '@/lib/perks/perksFilter'
import { isRaayonitMultiChain } from '@/lib/offers/multiChainNote'
import { isRaayonitDisplayEnabled } from '@/lib/flags/featureFlags.server'
import { liveChainNetworkCount } from '@/lib/offers/networkCount.server'
import { buildOfferObject, googleObjectId, googleSaveUrl, signSaveJwt } from '@/lib/wallet/googlePass'
import { ensureOfferClass, getWalletAccessToken, GoogleWalletError, upsertOfferObject } from '@/lib/wallet/googleWalletApi'
import { getGoogleWalletConfig } from '@/lib/wallet/passConfig'
import { isPassEligible, isVoucherId, readPassVoucher, type PassVoucher } from '@/lib/wallet/passVoucher'

// POST (Bearer ID token): checks the member owns an active voucher, upserts its Google
// Wallet object and answers with the save link (https://pay.google.com/gp/v/save/<jwt>).
// Google fetches nothing from this site, so there is no ticket step; the link names only
// an opaque object id. It is answered to the owner alone, with `Cache-Control: no-store`.
// Failures carry the same coarse `reason` as the Apple route (lib/wallet/walletClient.ts).
type Params = { params: Promise<{ voucherId: string }> }

const METHODS = 'POST, OPTIONS'

function replyFor(request: Request) {
  const headers = { ...corsHeaders(request, METHODS), 'Cache-Control': 'no-store' }
  return (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers })
}

export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request, METHODS) })
}

export async function POST(request: Request, { params }: Params) {
  const reply = replyFor(request)
  const config = getGoogleWalletConfig()
  if (config.mode === 'unavailable') return reply({ error: 'Google Wallet is unavailable.', reason: 'unavailable' }, 503)

  let uid: string
  try {
    uid = await requireVerifiedCustomerUid(request)
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return reply({ error: error.message, reason: error.status === 503 ? 'unavailable' : 'unauthorized' }, error.status)
    }
    return reply({ error: 'Authorization service unavailable.', reason: 'unavailable' }, 503)
  }
  if (await checkUidRateLimit('wallet', uid)) return reply({ error: 'Too many requests.', reason: 'rateLimited' }, 429)

  const { voucherId } = await params
  try {
    const db = getAdminDb()
    const voucher: PassVoucher | null = isVoucherId(voucherId) ? readPassVoucher(await db.collection('vouchers').doc(voucherId).get()) : null
    // Missing and foreign read alike, as the Firestore rules deny both.
    if (!voucher || voucher.userId !== uid) return reply({ error: 'Voucher not found.', reason: 'notFound' }, 404)
    if (!isPassEligible(voucher)) return reply({ error: 'This voucher can\'t be added.', reason: 'notEligible' }, 409)

    // Raayonit's name stays off the pass until the display flag is on (written approval); the pass then reads as a plain multi-chain voucher.
    if (voucher.issuer && !(await isRaayonitDisplayEnabled())) voucher.issuer = null
    if (isRaayonitMultiChain(voucher)) voucher.chainCount = await liveChainNetworkCount()
    // Decoration: the frozen order gives the discount, the offer its photo, the member their name. A pass works without any of them.
    const [order, offer, member] = await Promise.all([
      db.collection('orders').doc(voucher.id).get().catch(() => null),
      db.collection('offers').doc(voucher.offerId).get().catch(() => null),
      db.collection('users').doc(uid).get().catch(() => null),
    ])
    const original = order?.get('originalPrice')
    const paid = order?.get('amount')
    const name = member?.get('displayName')
    const object = buildOfferObject(voucher, config, {
      discountPercent: typeof original === 'number' && typeof paid === 'number' ? discountPercent(original, paid) : null,
      imageUrl: typeof offer?.get('imageUrl') === 'string' ? offer.get('imageUrl') : '',
      holderName: typeof name === 'string' ? name.trim() : null,
    })

    const token = await getWalletAccessToken(config)
    await ensureOfferClass(config, token)
    await upsertOfferObject(token, object)
    return reply({ url: googleSaveUrl(signSaveJwt(config, googleObjectId(config, voucher.id))) })
  } catch (error) {
    // The stage and the HTTP status only: never a token, the voucher id (it holds the uid) or a credential.
    const detail = error instanceof GoogleWalletError ? `${error.stage} ${error.status}` : 'voucher'
    console.error(`Google Wallet: saving a pass failed at ${detail}.`)
    return reply({ error: 'Service unavailable.', reason: 'unavailable' }, 503)
  }
}
