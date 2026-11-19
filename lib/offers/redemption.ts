// How a perk is redeemed ("אופן מימוש ההטבה"): a fixed method plus optional
// merchant instructions, one step per line. Set by the admin on the offer,
// frozen onto the order at checkout and onto the voucher at payment -- like
// the redemption terms in lib/payments/voucherTerms.ts -- so a later offer
// edit never changes what a bought voucher says. Pure; shared with Expo.

import type { TranslationKey } from '../i18n/translations'

export const REDEMPTION_METHODS = ['in_store', 'online', 'phone_booking', 'advance_booking', 'phone_order'] as const
export type RedemptionMethod = (typeof REDEMPTION_METHODS)[number]

/** Offers and vouchers from before methods existed were all redeemed at the business. */
export const DEFAULT_REDEMPTION_METHOD: RedemptionMethod = 'in_store'
export const MAX_REDEMPTION_INSTRUCTIONS_LENGTH = 1000

export const REDEMPTION_METHOD_LABEL_KEYS: Record<RedemptionMethod, TranslationKey> = {
  in_store: 'redeem_method_in_store',
  online: 'redeem_method_online',
  phone_booking: 'redeem_method_phone_booking',
  advance_booking: 'redeem_method_advance_booking',
  phone_order: 'redeem_method_phone_order',
}

// What to do once the voucher is in hand, when the merchant gave no
// instructions of their own. The offer page puts "buy it" in front.
const DEFAULT_STEP_KEYS: Record<RedemptionMethod, TranslationKey[]> = {
  in_store: ['redeem_step_in_store_show', 'redeem_step_in_store_done'],
  online: ['redeem_step_online_use', 'redeem_step_online_done'],
  phone_booking: ['redeem_step_phone_call', 'redeem_step_phone_show'],
  advance_booking: ['redeem_step_advance_call', 'redeem_step_advance_code'],
  phone_order: ['redeem_step_phone_order_call', 'redeem_step_phone_order_only'],
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
  codeOnly = false,
): string[] {
  const own = instructionSteps(instructions)
  if (own.length > 0) return own
  // A code-only voucher (Raayonit) has no QR code, so the usual steps that mention one don't apply.
  return codeOnly ? [t('redeem_step_code_only_show'), t('redeem_step_code_only_done')] : DEFAULT_STEP_KEYS[method].map((key) => t(key))
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

/**
 * Where a perk can be redeemed, in the three words a card shows: 'online' (a web shop, no storefront), 'both' (the website and
 * the stores) or 'in_store'. `redemptionModes` is what the Raayonit sync writes; an offer without it reads from its method.
 */
export const REDEMPTION_MODES = ['online', 'in_store'] as const
export type RedemptionMode = (typeof REDEMPTION_MODES)[number]
export type RedemptionChannel = 'online' | 'both' | 'in_store'

export function normalizeRedemptionModes(value: unknown): RedemptionMode[] {
  if (!Array.isArray(value)) return []
  return REDEMPTION_MODES.filter((mode) => value.includes(mode))
}

export function redemptionChannel(offer: { redemptionModes?: unknown; redemptionMethod?: unknown }): RedemptionChannel {
  const modes = normalizeRedemptionModes(offer.redemptionModes)
  if (modes.length === 2) return 'both'
  if (modes[0] === 'online') return 'online'
  if (modes[0] === 'in_store') return 'in_store'
  return offer.redemptionMethod === 'online' ? 'online' : 'in_store'
}

export const REDEMPTION_CHANNEL_LABEL_KEYS: Record<RedemptionChannel, TranslationKey> = {
  online: 'redeem_channel_online',
  both: 'redeem_channel_both',
  in_store: 'redeem_channel_in_store',
}

/**
 * The tag a card and an offer page show for how a perk is redeemed. Booking and phone methods keep their own wording; a plain
 * "in store" or "online" method reads as the channel, which also covers "online and in store".
 */
export function redemptionTagKey(offer: { redemptionModes?: unknown; redemptionMethod?: unknown }): TranslationKey {
  const method = normalizeRedemptionMethod(offer.redemptionMethod)
  if (method !== 'in_store' && method !== 'online') return REDEMPTION_METHOD_LABEL_KEYS[method]
  return REDEMPTION_CHANNEL_LABEL_KEYS[redemptionChannel(offer)]
}
