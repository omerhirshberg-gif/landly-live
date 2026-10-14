// Outline icons (Lucide-style, 24px viewBox, stroke only) for the onboarding
// cards, shared so the web and the Expo app draw the same glyphs.
export const ONB_ICONS = {
  tag: 'M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42zM7.5 7.5h.01',
  gift: 'M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z',
  pin: 'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  ticket: 'M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2zM13 5v2M13 17v2M13 11v2',
  checkCircle: 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3',
  zap: 'M13 2 3 14h9l-1 8 10-12h-9l1-8z',
  check: 'M20 6 9 17l-5-5',
} as const

export type OnbIcon = keyof typeof ONB_ICONS

/** The welcome card's four promises, in order. */
export const WELCOME_POINTS = [
  { icon: 'tag', key: 'onb_welcome_discounts' },
  { icon: 'gift', key: 'onb_welcome_perks' },
  { icon: 'pin', key: 'onb_welcome_local' },
  { icon: 'users', key: 'onb_welcome_community' },
] as const

/** What notifications bring, on the notifications card. */
export const NOTIFICATION_POINTS = [
  { icon: 'ticket', key: 'onb_notif_drops' },
  { icon: 'checkCircle', key: 'onb_notif_redemptions' },
  { icon: 'zap', key: 'onb_notif_flash' },
] as const
