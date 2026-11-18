'use client'

import { useCallback, useContext, useEffect, useSyncExternalStore } from 'react'
import { WishlistContext, WishlistControllerContext } from './WishlistProvider'

export function useWishlist() {
  const ctx = useContext(WishlistContext)
  if (!ctx) throw new Error('useWishlist must be used within a WishlistProvider')
  return ctx
}

function useController() {
  const controller = useContext(WishlistControllerContext)
  if (!controller) throw new Error('useIsWishlisted / useToggleWishlist must be used within a WishlistProvider')
  return controller
}

/**
 * Whether one offer is saved, for a perk card: it re-renders only when this
 * offer's heart changes, not when any other perk is saved.
 */
export function useIsWishlisted(offerId: string): boolean {
  const controller = useController()
  const read = useCallback(() => controller.has(offerId), [controller, offerId])
  return useSyncExternalStore(controller.subscribe, read, read)
}

/** Saves or un-saves a perk; the heart flips on the tap's frame. Stable for the provider's life. */
export function useToggleWishlist(): (offerId: string) => void {
  return useController().toggle
}

/** Runs `onError` when a save fails and its heart is rolled back. */
export function useWishlistErrors(onError: (error: unknown) => void) {
  const controller = useController()
  useEffect(() => controller.onError(onError), [controller, onError])
}
