import 'server-only'
import { Timestamp, type DocumentSnapshot } from 'firebase-admin/firestore'
import { parseBusinessTranslations } from '@/lib/business/businessText'
import type { VoucherDocument } from '@/lib/firebase/vouchers'
import { parseCoordinates, parsePlaceSnapshot } from '@/lib/geo'
import { parseOfferTranslations } from '@/lib/offers/offerText'
import { normalizeRedemptionInstructions, normalizeRedemptionMethod } from '@/lib/offers/redemption'
import { parseVoucherStatus } from '@/lib/vouchers/status'
import { normalizeDisplayOrderNumber } from '@/lib/payments/orderNumber'
import { parseIssuer } from '@/lib/payments/issuer'
import { normalizeRedemptionTerms } from '@/lib/payments/voucherTerms'

// The part of a voucher a Wallet pass is built from, read with the Admin SDK.
export type PassVoucher = Pick<
  VoucherDocument,
  | 'userId' | 'offerId' | 'businessName' | 'offerTitle' | 'redemptionCode' | 'redeemToken' | 'status' | 'expiresAt'
  | 'redemptionTerms' | 'redemptionMethod' | 'redemptionInstructions' | 'displayOrderNumber'
  | 'translations' | 'businessTranslations' | 'businessAddress' | 'businessGeo' | 'redemptionKind' | 'issuer' | 'externalCode'
  | 'amountAgorot' | 'faceValueAgorot' | 'savingsAgorot'
> & { id: string; /** The live size of the Raayonit network, set by the pass route for a Raayonit voucher; absent or 0 leaves it out of the sentence. */ chainCount?: number }

const REDEEM_TOKEN_PATTERN = /^[0-9a-f]{32}$/
const VOUCHER_ID_PATTERN = /^[\w-]{1,256}$/

export const isVoucherId = (value: string) => VOUCHER_ID_PATTERN.test(value)

export function readPassVoucher(snap: DocumentSnapshot): PassVoucher | null {
  const data = snap.data()
  if (!data) return null
  const token = data.redeemToken
  return {
    id: snap.id,
    userId: typeof data.userId === 'string' ? data.userId : '',
    offerId: typeof data.offerId === 'string' ? data.offerId : '',
    businessName: typeof data.businessName === 'string' ? data.businessName : '',
    offerTitle: typeof data.offerTitle === 'string' ? data.offerTitle : '',
    redemptionCode: typeof data.redemptionCode === 'string' ? data.redemptionCode : '',
    redeemToken: typeof token === 'string' && REDEEM_TOKEN_PATTERN.test(token) ? token : null,
    status: parseVoucherStatus(data.status),
    expiresAt: data.expiresAt instanceof Timestamp ? data.expiresAt.toDate() : null,
    redemptionTerms: normalizeRedemptionTerms(data.redemptionTerms),
    redemptionMethod: normalizeRedemptionMethod(data.redemptionMethod),
    redemptionInstructions: normalizeRedemptionInstructions(data.redemptionInstructions),
    displayOrderNumber: normalizeDisplayOrderNumber(data.displayOrderNumber),
    translations: parseOfferTranslations(data.translations),
    businessTranslations: parseBusinessTranslations(data.businessTranslations),
    businessAddress: parsePlaceSnapshot(data.businessAddress),
    businessGeo: parseCoordinates(data.businessGeo),
    redemptionKind: data.redemptionKind === 'code_only' ? 'code_only' : null,
    issuer: parseIssuer(data.issuer),
    externalCode: typeof data.externalCode === 'string' && data.externalCode ? data.externalCode : null,
    amountAgorot: typeof data.amountAgorot === 'number' && data.amountAgorot > 0 ? data.amountAgorot : null,
    faceValueAgorot: typeof data.faceValueAgorot === 'number' && data.faceValueAgorot > 0 ? data.faceValueAgorot : null,
    savingsAgorot: typeof data.savingsAgorot === 'number' && data.savingsAgorot > 0 ? data.savingsAgorot : null,
  }
}

/**
 * Whether this voucher may go into Wallet. A voucher with no redeemToken is
 * refused: its QR would fall back to its predictable id, and a static pass
 * would keep that code long after the backfill replaced it.
 */
export function isPassEligible(voucher: PassVoucher, nowMs = Date.now()): boolean {
  if (voucher.status !== 'active') return false
  // A code-only voucher (Raayonit) has no QR code, so no redeem token: it needs its own code instead.
  if (voucher.redemptionKind === 'code_only') {
    if (!voucher.externalCode) return false
  } else if (!voucher.redeemToken || !voucher.redemptionCode) return false
  return !voucher.expiresAt || voucher.expiresAt.getTime() > nowMs
}
