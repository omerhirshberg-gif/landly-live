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
  dangerPressed: '#b91c1c', // red-700
  dangerBg: '#fef2f2', // red-50
  dangerBorder: '#fecaca', // red-200
  success: '#15803d', // green-700
  successBg: '#f0fdf4', // green-50
  successBorder: '#bbf7d0', // green-200
  // The amber "Verification required" notice (web: bg-amber-50 border-amber-200 text-amber-900).
  warningBg: '#fffbeb', // amber-50
  warningBorder: '#fde68a', // amber-200
  warningText: '#78350f', // amber-900
  warningIcon: '#d97706', // amber-600
  warningAction: '#fcd34d', // amber-300, the action button's border
  warningPressed: '#fef3c7', // amber-100
  // The WhatsApp badge in the phone verification sheet.
  whatsapp: '#128c4b',
  whatsappBg: '#e7f8ee',
  // The discount badge and savings line: emerald-700, so white text on it
  // passes AA (web: components/discover/DiscountBadge.tsx).
  discount: '#047857',
  // A saved (wishlisted) heart (web: bg-red-500).
  heart: '#ef4444',
  // An inactive pagination dot (web: components/ui/SnapDots.tsx, bg-slate-300).
  dotInactive: '#cbd5e1', // slate-300
}

// The brand-tinted 44pt icon squares at the end of the Perks search row (Near
// Me, Wishlist). Web: the `action` variant of components/discover/NearMeButton.tsx
// (border-line bg-brandTint text-brand, brandLight when pressed).
export const actionTint = { bg: colors.brandTint, bgPressed: colors.brandLight, border: colors.border, text: colors.brand }

// `frame`: the inset picture frames on perk cards, tiles and the offer screen.
export const radius = { md: 12, frame: 14, lg: 16, pill: 9999 }

// The selected filter chip's lift (web: .filter-chip's shadow-sm).
export const chipShadow = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 2,
  elevation: 1,
} as const

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

// The top of every tab screen (Home, Perks, Wishlist, My Pass, Profile), so a
// title sits at the same height whichever tab is open: `top` below the
// SafeAreaView's own inset (which already clears the status bar, notch,
// Dynamic Island or punch hole; never add the inset again), a `row`-high
// title row (components/ScreenTitleRow.tsx) holding Home's `avatar` or
// Profile's 44pt `action`, then `gap` before the first card.
export const header = { top: 12, row: 48, gap: 16, avatar: 48, action: 44 } as const
