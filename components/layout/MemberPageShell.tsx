import type { ReactNode } from 'react'

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
export default function MemberPageShell({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  if (!footer) {
    return <div className="max-w-member mx-auto px-3 min-[380px]:px-4 sm:px-6 lg:px-8 pt-8 sm:pt-10 lg:pt-12 pb-10 sm:pb-12">{children}</div>
  }
  return (
    <div className="max-w-member mx-auto px-3 min-[380px]:px-4 sm:px-6 lg:px-8 pt-8 sm:pt-10 lg:pt-12 pb-[env(safe-area-inset-bottom)] flex min-h-[calc(100dvh-var(--header-offset))] flex-col">
      <div className="flex-1">{children}</div>
      <div className="mt-auto pt-10 pb-6">{footer}</div>
    </div>
  )
}

/** A page's h1, in the shared type with the shared gap under it. */
export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className={`${PAGE_TITLE} ${PAGE_TITLE_GAP}`}>{children}</h1>
}
