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
      },
      maxWidth: {
        member: '1240px',
      },
      fontFamily: {
        heebo: ['Heebo', 'sans-serif'],
        // Headings: Manrope (app/layout.tsx), Heebo for Hebrew and anything it lacks.
        display: ['var(--font-display)', 'Heebo', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
