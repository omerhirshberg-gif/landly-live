'use client'

import Link from 'next/link'
import { useLang } from '@/lib/i18n/useLang'
import type { FlagshipPurchaseState } from './useFlagshipPurchase'

/**
 * "Order voucher — ₪174". On the hub and Home (`to="details"`) it opens the details page with the chosen value; on the details page
 * (`to="checkout"`) "Continue to order" goes on to checkout. The price is isolated left to right so Hebrew keeps it in reading order.
 */
export default function FlagshipCta({ purchase, className, to = 'details' }: { purchase: FlagshipPurchaseState; className: string; to?: 'details' | 'checkout' }) {
  const { t } = useLang()
  const { block, card, href, detailsHref, ready } = purchase
  const target = to === 'details' ? detailsHref : href
  if (block) {
    return <button type="button" disabled className={`${className} cursor-not-allowed opacity-50`}>{t(block === 'owned' ? 'offer_already_claimed_title' : 'products_unavailable')}</button>
  }
  // The hub's action is "More details & purchase" (no price: the value is chosen on the next page); the details page's is "Continue to order — ₪174".
  const [before, after = ''] = t(to === 'details' ? 'products_cta' : 'raayonit_continue_order').split('{price}')
  // One inline span: the buttons are flex boxes, which would drop the spaces around the price.
  const label = (
    <span>
      {before}
      {to === 'checkout' && <bdi dir="ltr">{`₪${card?.price ?? ''}`}</bdi>}
      {after}
    </span>
  )
  // Until the offer loads the tiles are only a preview, so the action is held rather than sent nowhere.
  if (!ready || !target) return <button type="button" disabled className={`${className} cursor-not-allowed opacity-50`}>{label}</button>
  // Details is a client-side link; checkout stays a full page load.
  return to === 'details' ? <Link href={target} className={className}>{label}</Link> : <a href={target} className={className}>{label}</a>
}
