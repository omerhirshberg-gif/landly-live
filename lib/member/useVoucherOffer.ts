import { useEffect, useState } from 'react'
import { getOffer, type OfferDocument } from '@/lib/firebase/offers'

// A voucher carries its business and offer title but not the offer's photo or
// category, so the My Pass cards (web /member, the app's My Pass tab) read the
// offer for their thumbnail. Cached for the session by offer id: each offer is
// one read however many cards or tab switches show it, and a card shown again
// draws its photo at once. A failed read isn't cached, so the next mount retries.
const resolved = new Map<string, OfferDocument | null>()
const pending = new Map<string, Promise<OfferDocument | null>>()

export function loadVoucherOffer(offerId: string): Promise<OfferDocument | null> {
  if (resolved.has(offerId)) return Promise.resolve(resolved.get(offerId) ?? null)
  let request = pending.get(offerId)
  if (!request) {
    request = getOffer(offerId)
      .then((offer) => {
        resolved.set(offerId, offer)
        return offer
      })
      .catch(() => null)
      .finally(() => pending.delete(offerId))
    pending.set(offerId, request)
  }
  return request
}

/** The voucher's offer: undefined while loading, null when it's gone (or unreadable). */
export function useVoucherOffer(offerId: string): OfferDocument | null | undefined {
  const [loaded, setLoaded] = useState<{ id: string; offer: OfferDocument | null } | null>(null)

  useEffect(() => {
    if (resolved.has(offerId)) return
    let cancelled = false
    loadVoucherOffer(offerId).then((offer) => {
      if (!cancelled) setLoaded({ id: offerId, offer })
    })
    return () => {
      cancelled = true
    }
  }, [offerId])

  if (resolved.has(offerId)) return resolved.get(offerId)
  return loaded?.id === offerId ? loaded.offer : undefined
}
