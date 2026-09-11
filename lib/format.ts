// Every price in the app is ILS today (offers, orders) — kept as a tiny
// standalone helper (previously lived in the now-deleted lib/plans.ts) so
// nothing here is coupled to subscriptions or any other pricing concept.
export function formatPrice(amount: number): string {
  return `₪${amount}`
}
