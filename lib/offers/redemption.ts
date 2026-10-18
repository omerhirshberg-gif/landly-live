// How a perk is redeemed ("אופן מימוש ההטבה"): a fixed method plus optional
// merchant instructions, one step per line. Set by the admin on the offer,
// frozen onto the order at checkout and onto the voucher at payment -- like
// the redemption terms in lib/payments/voucherTerms.ts -- so a later offer
// edit never changes what a bought voucher says. Pure; shared with Expo.

import type { TranslationKey } from '../i18n/translations'

export const REDEMPTION_METHODS = ['in_store', 'online', 'phone_booking'] as const
export type RedemptionMethod = (typeof REDEMPTION_METHODS)[number]

/** Offers and vouchers from before methods existed were all redeemed at the business. */
export const DEFAULT_REDEMPTION_METHOD: RedemptionMethod = 'in_store'
export const MAX_REDEMPTION_INSTRUCTIONS_LENGTH = 1000

export const REDEMPTION_METHOD_LABEL_KEYS: Record<RedemptionMethod, TranslationKey> = {
  in_store: 'redeem_method_in_store',
  online: 'redeem_method_online',
  phone_booking: 'redeem_method_phone_booking',
}

// What to do once the voucher is in hand, when the merchant gave no
// instructions of their own. The offer page puts "buy it" in front.
const DEFAULT_STEP_KEYS: Record<RedemptionMethod, TranslationKey[]> = {
  in_store: ['redeem_step_in_store_show', 'redeem_step_in_store_done'],
  online: ['redeem_step_online_use', 'redeem_step_online_done'],
  phone_booking: ['redeem_step_phone_call', 'redeem_step_phone_show'],
}

export function isRedemptionMethod(value: unknown): value is RedemptionMethod {
  return typeof value === 'string' && (REDEMPTION_METHODS as readonly string[]).includes(value)
}

export function normalizeRedemptionMethod(value: unknown): RedemptionMethod {
  return isRedemptionMethod(value) ? value : DEFAULT_REDEMPTION_METHOD
}

export function normalizeRedemptionInstructions(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** Instructions as steps: one per non-empty line, without the admin's own "1." or "-" bullets. */
export function instructionSteps(instructions: string): string[] {
  return instructions
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^(?:\d{1,2}[.)]|[-*•])\s*/, '').trim())
    .filter(Boolean)
}

/** The steps to show: the merchant's own, or the method's defaults (translated by the caller). */
export function redemptionSteps(
  method: RedemptionMethod,
  instructions: string,
  t: (key: TranslationKey) => string,
): string[] {
  const own = instructionSteps(instructions)
  return own.length > 0 ? own : DEFAULT_STEP_KEYS[method].map((key) => t(key))
}

/**
 * Validates the redemption fields of an admin offer write. Missing fields fall
 * back to the defaults (older admin clients don't send them).
 */
export function parseOfferRedemption(input: { redemptionMethod?: unknown; redemptionInstructions?: unknown }):
  | { ok: true; redemptionMethod: RedemptionMethod; redemptionInstructions: string }
  | { ok: false; error: string } {
  const method = input.redemptionMethod ?? DEFAULT_REDEMPTION_METHOD
  if (!isRedemptionMethod(method)) {
    return { ok: false, error: `offer.redemptionMethod must be one of: ${REDEMPTION_METHODS.join(', ')}.` }
  }
  const raw = input.redemptionInstructions
  if (raw !== undefined && raw !== null && typeof raw !== 'string') {
    return { ok: false, error: 'offer.redemptionInstructions must be text.' }
  }
  const redemptionInstructions = normalizeRedemptionInstructions(raw)
  if (redemptionInstructions.length > MAX_REDEMPTION_INSTRUCTIONS_LENGTH) {
    return { ok: false, error: `offer.redemptionInstructions must be at most ${MAX_REDEMPTION_INSTRUCTIONS_LENGTH} characters.` }
  }
  return { ok: true, redemptionMethod: method, redemptionInstructions }
}
