// The slides of Home's Raayonit Card banner (web: components/perks/RaayonitBanner.tsx, native: landly-mobile/src/components/RaayonitBanner.tsx).
// Each leads with a benefit, over its own wide photo (public/images/raayonit-banner, the same files in landly-mobile/assets/raayonit-banner; licences in
// docs/IMAGE_LICENSES.md), and opens the Raayonit tab.
export const BANNER_SLIDES = [
  { key: 'chains_banner_1', photo: 'dining' },
  { key: 'chains_banner_2', photo: 'spa' },
  { key: 'chains_banner_3', photo: 'shopping' },
] as const
export type BannerKey = (typeof BANNER_SLIDES)[number]['key']
/** Time each slide stays up before the next one slides in. */
export const BANNER_INTERVAL_MS = 6000
/** The slide that follows `index`, wrapping around. */
export const nextSlide = (index: number, total: number, step: 1 | -1 = 1) => (index + step + total) % total
