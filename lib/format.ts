// Every price in the app is ILS today (offers, orders) — kept as a tiny
// standalone helper (previously lived in the now-deleted lib/plans.ts) so
// nothing here is coupled to subscriptions or any other pricing concept.
export function formatPrice(amount: number): string {
  return `₪${amount}`
}

// A shekel amount in the reader's language: "₪1,250" in English, "1,250 ₪"
// in Hebrew, "1 250 ₪" in French. narrowSymbol keeps it "₪" everywhere
// (Spanish would otherwise write "ILS"). Its spaces are non-breaking, so the
// number and the symbol never split across lines.
export function formatSavings(amount: number, lang: string): string {
  return new Intl.NumberFormat(lang, { style: 'currency', currency: 'ILS', currencyDisplay: 'narrowSymbol', maximumFractionDigits: 0 }).format(amount)
}

// When a voucher was redeemed, in the reader's language: "17 Oct 2026",
// "17 באוק׳ 2026". Engines without full Intl (some Hermes builds) fall back
// to the platform's own date string.
export function formatRedeemedDate(date: Date, lang: string): string {
  try {
    return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
  } catch {
    return date.toLocaleDateString()
  }
}
