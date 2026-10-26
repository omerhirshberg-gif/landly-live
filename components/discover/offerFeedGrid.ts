/**
 * The perk feeds (/categories results, category folders, New, Bestsellers, Wishlist):
 * one full-width card per row on phones and folded cover screens, two from
 * 600px (an unfolded foldable's inner screen; lib/layout/foldable.ts), three on
 * desktop and four from 1280px, where a card is still ~280px wide.
 */
export const OFFER_FEED_GRID = 'grid grid-cols-1 gap-3 fold:grid-cols-2 fold:gap-4 lg:grid-cols-3 xl:grid-cols-4'
