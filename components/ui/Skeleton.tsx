'use client'

import { OFFER_FEED_GRID } from '@/components/discover/offerFeedGrid'
import { useLang } from '@/lib/i18n/useLang'

// Loading placeholders that hold the exact shape of what's coming, so nothing
// jumps when it arrives: soft slate blocks that pulse (still under reduced
// motion). Each list is one polite status for screen readers ("Loading…");
// the blocks themselves are hidden from them.
export function Skeleton({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`block rounded-lg bg-slate-100 animate-pulse motion-reduce:animate-none ${className}`} />
}

function Loading({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const { t } = useLang()
  return (
    <div role="status" className={className}>
      <span className="sr-only">{t('bizdash_loading')}</span>
      {children}
    </div>
  )
}

// OfferCard's grid layout: the 16:9 framed picture, the business, two title
// lines, the place, then the price row.
function OfferCardSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-card">
      <Skeleton className="mx-2 mt-2 aspect-video rounded-[14px]" />
      <div className="flex flex-col px-3 pb-3 pt-2.5 sm:px-4 sm:pb-4">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="mt-2 h-3.5 w-11/12" />
        <Skeleton className="mt-1.5 h-3.5 w-3/5" />
        <Skeleton className="mt-3 h-3 w-1/3" />
        <span className="mt-4 flex items-center justify-between">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-12" />
        </span>
      </div>
    </div>
  )
}

/** A perk feed loading: a screen's worth of OfferCard placeholders in the feed's own grid. */
export function OfferGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <Loading className={OFFER_FEED_GRID}>
      {Array.from({ length: count }, (_, i) => <OfferCardSkeleton key={i} />)}
    </Loading>
  )
}

/** My Pass loading: VoucherCard placeholders (thumbnail, business, title, badge row) in the tab's own grid. */
export function VoucherListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <Loading className="grid gap-3 fold:grid-cols-2">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} aria-hidden="true" className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4 shadow-card">
          <Skeleton className="h-16 w-16 flex-shrink-0 rounded-xl sm:h-20 sm:w-20" />
          <span className="min-w-0 flex-1">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="mt-2 h-3.5 w-4/5" />
            <Skeleton className="mt-3 h-5 w-28 rounded-full" />
          </span>
        </div>
      ))}
    </Loading>
  )
}
