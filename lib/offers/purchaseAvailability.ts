// Whether an offer is listed but cannot be bought yet. Pure; the server applies it when it builds the public offers
// (lib/firebase/offersCache.server.ts), the website and the app read it as `offer.comingSoon`.
//  - A Raayonit voucher while the Raayonit launch-pending flag is on.
//  - Any offer while no payment gateway is live (no Tranzila terminal, no dev sandbox): the Buy action is hidden or disabled
//    instead of leading to a checkout that cannot charge.
export function isOfferComingSoon(input: { fulfillmentType?: string; raayonitComingSoon: boolean; paymentsLive: boolean }): boolean {
  if (!input.paymentsLive) return true
  return input.raayonitComingSoon && input.fulfillmentType === 'raayonit_pool'
}
