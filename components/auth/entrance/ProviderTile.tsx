'use client'

import type { AuthProvider } from '@/lib/auth/appleDevice'

// One square sign-in provider button in the auth screen's ProviderRow:
// 54px on phones, 52px from `sm` (the large button's heights), 14px corners.
// Icon only, so the label is the accessible name and the desktop tooltip.
// Every icon sits in the same 22px box, centred in the tile, so the three
// line up on one axis; the Apple logo is nudged up 1px (its leaf makes it
// look low). While its sign-in runs, the icon becomes a spinner of the same
// size, so the tile never resizes. Counterpart of the app's
// landly-mobile/src/components/ProviderTile.tsx.
//
// Kept crisp: whole-pixel sizes throughout, and no transform at rest — the
// 0.96 scale exists only while pressed, and the Apple nudge is a 1px offset,
// not a translate. Deliberately no translateZ(0), backface-visibility or
// will-change: each keeps the tile on its own GPU layer, which the browser
// rasterizes once and then composites at fractional offsets or stretches
// mid-press, which is exactly what makes it soft (see TextField.tsx).

// The Apple logo for Sign in with Apple buttons (Apple's guidelines allow it
// logo-only, black, no smaller than the other providers' buttons).
const APPLE_LOGO_PATH =
  'M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z'

const ICONS: Record<AuthProvider, React.ReactNode> = {
  apple: (
    <svg width="15" height="18" viewBox="0 0 814 1000" shapeRendering="geometricPrecision" className="relative bottom-px">
      <path fill="currentColor" d={APPLE_LOGO_PATH} />
    </svg>
  ),
  google: (
    <svg width="20" height="20" viewBox="0 0 18 18" shapeRendering="geometricPrecision">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.56 2.7-3.87 2.7-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.98v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.98A9 9 0 0 0 0 9c0 1.45.35 2.83.98 4.03l2.97-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .98 4.97l2.97 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
    </svg>
  ),
  // A person and a key, after the FIDO Alliance passkey mark; drawn the same in
  // RTL. The viewBox is cropped to 22 units so it draws 1:1 in the 22px box:
  // the 2-unit stroke is exactly 2px on whole-pixel lines, not a soft 1.8px.
  passkey: (
    <svg width="22" height="22" viewBox="1 1 22 22" fill="none" stroke="#0038b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" shapeRendering="geometricPrecision">
      <circle cx="9" cy="7" r="4" />
      <path d="M2 21v-1a6 6 0 0 1 6-6h2.5" />
      <circle cx="17.5" cy="13.5" r="2.5" />
      <path d="M17.5 16v5M17.5 18.5h2M17.5 21h1.5" />
    </svg>
  ),
}

const SKINS: Record<AuthProvider, string> = {
  apple: 'border-black bg-black text-white [@media(hover:hover)]:hover:enabled:bg-neutral-800',
  google: 'border-slate-200 bg-white [@media(hover:hover)]:hover:enabled:bg-slate-50',
  passkey: 'border-slate-200 bg-white [@media(hover:hover)]:hover:enabled:bg-slate-50',
}

export default function ProviderTile({
  provider,
  label,
  busyLabel,
  busy = false,
  disabled = false,
  onClick,
}: {
  provider: AuthProvider
  label: string
  /** Read out instead of `label` while busy (the passkey's "Waiting for your device…"). */
  busyLabel?: string
  busy?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      aria-label={busy && busyLabel ? busyLabel : label}
      aria-busy={busy || undefined}
      title={label}
      data-provider={provider}
      // The busy tile stays at full strength (its spinner is the feedback); the others dim.
      className={`inline-flex shrink-0 items-center justify-center h-[54px] w-[54px] sm:h-[52px] sm:w-[52px] rounded-[14px] border select-none cursor-pointer transition-[transform,background-color] duration-150 ease-out active:enabled:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ${SKINS[provider]} ${disabled && !busy ? 'opacity-60 cursor-not-allowed' : ''}`}
    >
      <span aria-hidden="true" className="flex h-[22px] w-[22px] items-center justify-center">
        {busy ? (
          <span className={`h-[18px] w-[18px] rounded-full border-2 border-r-transparent animate-spin ${provider === 'apple' ? 'border-white' : 'border-brand'}`} />
        ) : (
          ICONS[provider]
        )}
      </span>
    </button>
  )
}
