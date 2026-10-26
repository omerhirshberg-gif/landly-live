/** @type {import('tailwindcss').Config} */
module.exports = {
  // hover: styles apply only on devices that can hover, so a tapped card or
  // row doesn't stay highlighted on a phone; touch feedback comes from active:.
  future: {
    hoverOnlyWhenSupported: true,
  },
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    // The default screens with `fold` (600px, lib/layout/foldable.ts) ahead of
    // them: a foldable's inner screen (a Galaxy Z Fold reports ~700px, a Pixel
    // Fold ~840px) gets the two-column layouts that otherwise wait for md.
    // Listed in full, not in extend, so fold sorts before sm in the CSS and the
    // min-width cascade holds. Plain min-width strings only: an object (raw or
    // max) screen makes Tailwind drop every max-* variant (max-md: is in use).
    // So the folded cover screen uses the arbitrary max-[379px]: variant, and
    // the hinge (two viewport segments) lives in app/globals.css (--hinge-gap).
    screens: {
      fold: '600px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        brand: '#0038b8',
        brandDark: '#002a8a',
        brandLight: '#e0effe',
        brandTint: '#f0f7ff',
        // Lighter end of the brand gradient (avatar monogram, /olim glows); mobile: colors.brandGradientStart.
        brandGradientStart: '#3b6fe0',
        // Member design system (mirrors landly-mobile/src/theme.ts)
        ink: '#0b1b3d',
        body: '#475569',
        muted: '#94a3b8',
        line: '#e2e8f0',
        canvas: '#f8fafc',
        // The discount pill: emerald-700, 5.5:1 under white text (DiscountBadge).
        success: '#047857',
        // Other brands' own colours, for their marks only.
        whatsapp: '#25d366',
        linkedin: '#0a66c2',
        // The guest hero's warm editorial card (components/home/HeroFeatureGrid.tsx):
        // pearl, champagne and its hairline. The sky cards use Tailwind's sky scale.
        cream: '#faf8f5',
        creamDeep: '#f5f2eb',
        creamLine: '#eae5dc',
      },
      // The type scale's in-between steps, so no component reaches for text-[Npx].
      // Size only: line height stays with the element (leading-*), as it did
      // with the arbitrary values these replace. Tailwind's own steps (xs 12,
      // sm 14, base 16, lg 18, xl 20, 2xl 24, 3xl 30, 5xl 48) cover the rest.
      fontSize: {
        nano: '10px', // the smallest glyphs and the pass card's tiny labels; nothing goes below it
        micro: '11px', // image chips, distance, tiny badges
        meta: '13px', // metadata, captions, secondary card lines
        copy: '15px', // body copy on phones (sm:text-base above)
        title: '17px', // perk and offer titles on wider screens
        'heading-sm': '22px', // step headings in the auth and onboarding flows
        page: '26px', // the in-app page title on phones (PAGE_TITLE)
        'page-lg': '28px', // ... and from 640px
        stat: '44px', // the big count on the member pass card
        // Prices: the member price, the offer page's headline price, and the
        // struck-through original. All in the body font (Inter, Heebo in
        // Hebrew), "₪" included (app/layout.tsx loads its subset).
        price: ['20px', { lineHeight: '1.1', fontWeight: '800', letterSpacing: '-0.01em' }],
        'price-lg': ['30px', { lineHeight: '1.1', fontWeight: '800', letterSpacing: '-0.02em' }],
        'price-was': ['14px', { lineHeight: '1.25', fontWeight: '500' }],
        'monogram-sm': '4rem', // PerkImage's placeholder initial: thumb, card, hero
        'monogram-md': '7rem',
        'monogram-lg': '11rem',
      },
      boxShadow: {
        // Cards at rest and lifted (pointer hover only).
        card: '0 2px 8px rgba(0,0,0,0.04)',
        'card-hover': '0 12px 24px rgba(0,0,0,0.08)',
        // The same lift as .ds-btn-primary / .ds-btn-secondary (globals.css), for buttons styled by hand.
        'btn-primary': '0 2px 8px rgba(0,56,184,0.18)',
        'btn-secondary': '0 1px 3px rgba(0,0,0,0.04)',
      },
      transitionTimingFunction: {
        // The site's one easing curve (--ease-out-expo in globals.css).
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      maxWidth: {
        member: '1240px',
      },
      fontFamily: {
        // Interface and body: Inter (app/layout.tsx), Heebo for Hebrew and anything it lacks.
        sans: ["var(--font-sans, 'Heebo')", 'Heebo', 'sans-serif'],
        // Headings: Manrope (app/layout.tsx), Heebo for Hebrew and anything it lacks.
        display: ['var(--font-display)', 'Heebo', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
