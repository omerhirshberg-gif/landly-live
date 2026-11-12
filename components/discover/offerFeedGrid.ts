/**
 * The perk feeds (/categories results, category folders, New, Bestsellers, Wishlist):
 * one full-width card per row on phones and folded cover screens, two from
 * 600px (an unfolded foldable's inner screen; lib/layout/foldable.ts), three on
 * desktop, four from 1280px, five from 1536px and six from 1920px (a card is never under 260px),
 * so the grid fills the page's wide fluid column.
 */
export const OFFER_FEED_GRID = 'grid grid-cols-1 gap-5 fold:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[1920px]:grid-cols-6'
