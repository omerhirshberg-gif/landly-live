import { isRaayonitMultiChain, type MultiChainSubject } from './multiChainNote'
import { cardTitle } from './cardTitle'
import { resolveVoucherValue, shekels } from '../vouchers/voucherValue'

// The one headline of every Raayonit / Super Tav offer, voucher and order: "Super Tav — ₪100 Value" (or "₪100 / ₪150" for a
// card with two values). It says at once how much the voucher buys; the business is never inside it, it sits on the
// line below. Pure, shared by web, Expo and the emails. The stored title is never changed.
export interface SuperTavSubject extends MultiChainSubject {
  /** An offer's purchasable values (Raayonit pools). */
  variants?: { faceValueAgorot: number }[] | null
  /** A voucher's full worth. */
  faceValueAgorot?: number | null
  amountAgorot?: number | null
  savingsAgorot?: number | null
  /** The offer's or order's pre-discount price in shekels. */
  originalPrice?: number | null
}

const positive = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0

/** The distinct face values in agorot, ascending; [] when none is known. */
export function superTavFaceValues(x: SuperTavSubject): number[] {
  const fromVariants = (x.variants ?? []).map((v) => v.faceValueAgorot).filter(positive)
  if (fromVariants.length > 0) return [...new Set(fromVariants.map(Math.round))].sort((a, b) => a - b)
  if (positive(x.faceValueAgorot)) return [Math.round(x.faceValueAgorot)]
  const value = resolveVoucherValue({ amountAgorot: x.amountAgorot, savingsAgorot: x.savingsAgorot, originalPrice: x.originalPrice })
  if (value) return [value.faceValueAgorot]
  return positive(x.originalPrice) ? [Math.round(x.originalPrice * 100)] : []
}

/** "₪100" or "₪100 / ₪150", wrapped so it keeps its left-to-right order inside any text. */
export function superTavValueText(values: number[]): string {
  // Non-breaking spaces: a two-value run ("₪100 / ₪150") wraps whole, never mid-value.
  return `⁦${values.map(shekels).join(' / ')}⁩`
}

/** "Super Tav — ₪100 Value", or null when this is not a Super Tav or its value is unknown. `template` is `super_tav_headline`. */
export function superTavHeadline(x: SuperTavSubject | null | undefined, template: string, only?: number): string | null {
  if (!x || !isRaayonitMultiChain(x)) return null
  const values = only && only > 0 ? [Math.round(only)] : superTavFaceValues(x)
  if (values.length === 0) return null
  return template.replace('{value}', superTavValueText(values))
}

/** What a surface shows as the title: the Super Tav headline, else the title itself (a stray "— Super Tav" label removed). */
export function displayTitle(x: SuperTavSubject | null | undefined, title: string, template: string, only?: number): string {
  return superTavHeadline(x, template, only) ?? cardTitle(title, { raayonit: isRaayonitMultiChain(x) })
}
