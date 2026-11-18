'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLang } from '@/lib/i18n/useLang'
import { useWishlistErrors } from '@/lib/firebase/useWishlist'

const VISIBLE_MS = 3200

// A heart that flipped on tap but whose save then failed has already flipped
// back (lib/firebase/wishlistController.ts); this says so in one quiet line at
// the bottom of the screen, read out politely, and leaves on its own.
export default function WishlistErrorNotice() {
  const { t } = useLang()
  const [shownAt, setShownAt] = useState<number | null>(null)
  const onError = useCallback(() => setShownAt(Date.now()), [])
  useWishlistErrors(onError)

  useEffect(() => {
    if (shownAt === null) return
    const timer = setTimeout(() => setShownAt(null), VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [shownAt])

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[60] flex justify-center px-4">
      {shownAt !== null && (
        <p className="max-w-sm rounded-2xl border border-slate-200/80 bg-white/95 px-4 py-2.5 text-center text-sm font-medium text-slate-700 shadow-[0_8px_30px_rgb(0,0,0,0.08)] greet-in">
          {t('wishlist_save_failed')}
        </p>
      )}
    </div>
  )
}
