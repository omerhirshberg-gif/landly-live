/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: '#0038b8',
        brandDark: '#002a8a',
        brandLight: '#e0effe',
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
      },
    },
  },
  plugins: [],
}
