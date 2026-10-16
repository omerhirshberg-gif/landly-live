import { StyleSheet } from 'react-native'

// Mirrors the web app's Tailwind palette (tailwind.config.js + slate scale)
// and the member design system in app/globals.css (.ds-btn, ink/body/muted).
export const colors = {
  brand: '#0038b8',
  brandDark: '#002a8a',
  // Hover (web) and pressed share the design system's one darker blue.
  brandHover: '#002a8a',
  brandLight: '#e0effe',
  // Lighter tint: chip hover/press (web .ds-chip).
  brandTint: '#f0f7ff',
  // Lighter end of the monogram avatar gradient (brand → brandDark after it).
  brandGradientStart: '#3b6fe0',
  white: '#ffffff',
  background: '#f8fafc', // slate-50, the canvas behind cards
  border: '#e2e8f0', // slate-200
  borderLight: '#f1f5f9', // slate-100
  // Material 3 navigation-bar container (Android tab bar): a cool neutral
  // tinted toward the brand rather than M3's default purple.
  surfaceContainer: '#f1f4f9',
  heading: '#0b1b3d', // headings and display text (web: text-ink)
  body: '#475569', // body copy (web: text-body, slate-600)
  textStrong: '#0f172a', // slate-900
  text: '#334155', // slate-700
  textMuted: '#64748b', // slate-500
  textFaint: '#94a3b8', // slate-400, subtitles and inactive tabs (web: text-muted)
  danger: '#dc2626', // red-600
  dangerBg: '#fef2f2', // red-50
  dangerBorder: '#fecaca', // red-200
  success: '#15803d', // green-700
  successBg: '#f0fdf4', // green-50
  successBorder: '#bbf7d0', // green-200
}

export const radius = { md: 12, lg: 16, pill: 9999 }

// The member type scale, shared by every post-login screen (web: LoggedInHome,
// /member and /account use the same sizes and weights).
export const type = StyleSheet.create({
  greeting: { fontSize: 28, lineHeight: 36, fontWeight: '700', color: colors.heading },
  screenTitle: { fontSize: 26, lineHeight: 34, fontWeight: '700', color: colors.heading },
  sectionTitle: { fontSize: 21, lineHeight: 28, fontWeight: '700', color: colors.heading },
  body: { fontSize: 15, lineHeight: 22, color: colors.body },
  subtitle: { fontSize: 14, lineHeight: 20, color: colors.textFaint },
})

/** 0.5px on native (one physical pixel); web uses 1px borders. */
export const hairline = StyleSheet.hairlineWidth
