import { formatPrice, formatSavings } from '@shared/format'

// The website's savings format ("₪1,250", "1,250 ₪" in Hebrew). Hermes builds
// without full Intl currency support throw on narrowSymbol; those fall back
// to the plain "₪1250" the offer cards use.
export function formatSavingsSafe(amount: number, lang: string): string {
  try {
    return formatSavings(amount, lang)
  } catch {
    return formatPrice(amount)
  }
}
