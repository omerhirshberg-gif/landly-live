import type { ReactNode } from 'react'
import GlobalPerkSearchBar from '@/components/discover/GlobalPerkSearchBar'

/** Every signed-in page's title type: the same size and weight on Home, Explore Perks, Wishlist, My Pass and Support; a step smaller on a folded cover screen (under 380px). */
export const PAGE_TITLE = 'text-page max-[379px]:text-2xl sm:text-page-lg lg:text-3xl leading-tight font-bold text-ink text-start break-words'

/** The space under a page's title block, before its content. */
export const PAGE_TITLE_GAP = 'mb-6'

// The column the signed-in pages sit in (Home, Explore Perks, Wishlist, My
// Pass, Support): one width (the 1240px member column), one set of gutters
// and one top padding, so a page's title starts at the same spot whichever
// tab the member switches to. Pages that read better narrower (lists, forms)
// narrow their content inside it without auto margins, so it keeps the
// column's start edge (the right edge in Hebrew). A folded cover screen
// (under 380px; lib/layout/foldable.ts) gets 12px gutters instead of 16, so
// a card keeps its width beside the phone's rounded corners.
//
// A `footer` (Home's "Have a question?" prompt) is pinned to the bottom of
// the screen on short pages: the column then fills the viewport below the
// navbar as a flex column and the footer takes up the slack (mt-auto), so it
// never floats mid-page. Without one the column is only as tall as its
// content, so whatever a page renders after it (Support's FAQ) follows on.
//
// `fluid` (Home) lifts the column's width off the page, so its rails can reach
// the screen's edges: each child brings its own MemberColumn, or starts its row
// on the column's line with .member-bleed (app/globals.css).
//
// `globalSearch` puts the persistent search bar (components/discover/GlobalPerkSearchBar.tsx)
// first in the column, in the same spot on every page that has it: the Mami-style
// pill search, Near Me and Filter, right under the navbar. Home, Perks, Wishlist and My Pass use it.
export default function MemberPageShell({ children, footer, fluid = false, globalSearch = false }: { children: ReactNode; footer?: ReactNode; fluid?: boolean; globalSearch?: boolean }) {
  const searchRow = globalSearch ? <GlobalPerkSearchRow wide={fluid} /> : null
  if (fluid) {
    return (
      <div className="pt-8 sm:pt-10 lg:pt-12 pb-[env(safe-area-inset-bottom)] flex min-h-[calc(100dvh-var(--header-offset))] flex-col">
        <div className="min-w-0 flex-1">
          {searchRow}
          {children}
        </div>
        {footer && <MemberColumn className="mt-auto w-full pt-10 pb-6">{footer}</MemberColumn>}
      </div>
    )
  }
  if (!footer) {
    return (
      <div className="max-w-member mx-auto px-3 min-[380px]:px-4 sm:px-6 lg:px-8 pt-8 sm:pt-10 lg:pt-12 pb-10 sm:pb-12">
        {searchRow}
        {children}
      </div>
    )
  }
  return (
    <div className="max-w-member mx-auto px-3 min-[380px]:px-4 sm:px-6 lg:px-8 pt-8 sm:pt-10 lg:pt-12 pb-[env(safe-area-inset-bottom)] flex min-h-[calc(100dvh-var(--header-offset))] flex-col">
      <div className="flex-1">
        {searchRow}
        {children}
      </div>
      <div className="mt-auto pt-10 pb-6">{footer}</div>
    </div>
  )
}

/** The member column on its own, inside a `fluid` shell: the same width and gutters. `wide` is Home's fluid column (full width up to 2200px, 32px gutters from 1024px), the one its welcome row, pass card, rails and headings share. */
export function MemberColumn({ children, className = '', wide = false }: { children: ReactNode; className?: string; wide?: boolean }) {
  return <div className={`${wide ? 'w-full max-w-[2200px] lg:px-8' : 'max-w-member lg:px-8'} mx-auto px-3 min-[380px]:px-4 sm:px-6 ${className}`}>{children}</div>
}

/** A page's h1, in the shared type with the shared gap under it. */
export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className={`${PAGE_TITLE} ${PAGE_TITLE_GAP}`}>{children}</h1>
}

/** The persistent search row: the same height, gap and width on every page; the wide fluid column or the 1240px one carries it. */
export function GlobalPerkSearchRow({ wide = false }: { wide?: boolean }) {
  const bar = <div className="mb-6 sm:mb-8"><GlobalPerkSearchBar /></div>
  return wide ? <MemberColumn wide>{bar}</MemberColumn> : bar
}
