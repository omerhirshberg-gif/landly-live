'use client'

import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { offersStore } from '../firebase/offers'
import type { OfferDocument } from './offerDocument'

/**
 * The live offers from the shared store (lib/offers/offersStore.ts): whatever
 * copy is held renders on the first frame, a mount asks for a refresh when it
 * is stale, and every screen using this re-renders together when a new list
 * lands. `offers` is null only while nothing has loaded yet; `failed` is set
 * only when a load failed and there is nothing to show. `refresh` is the
 * pull-to-refresh: it waits for a new load and never throws.
 */
export function useOffers(): { offers: OfferDocument[] | null; failed: boolean; refresh: () => Promise<void> } {
  const snapshot = useSyncExternalStore(offersStore.subscribe, offersStore.getSnapshot, offersStore.getServerSnapshot)
  useEffect(() => {
    offersStore.get().catch(() => {})
  }, [])
  const refresh = useCallback(async () => {
    await offersStore.get({ force: true }).catch(() => {})
  }, [])
  return { offers: snapshot.offers, failed: snapshot.failed, refresh }
}
