import type { SVGProps } from 'react'

// The brand marks Lucide doesn't draw (it ships no logos). Instagram, Facebook
// and LinkedIn are outlines on Lucide's 24px grid, so they sit beside its
// glyphs at the same stroke; WhatsApp is its filled speech-bubble mark, the
// same one the support widget shows (components/layout/WhatsAppWidget.tsx),
// because an outline of it isn't recognisable. Decorative: the link or button
// around one names it. None is directional, so none mirrors in Hebrew.
type BrandIconProps = Omit<SVGProps<SVGSVGElement>, 'ref'> & { strokeWidth?: number }

function Outline({ strokeWidth = 1.75, children, ...props }: BrandIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

export function InstagramIcon(props: BrandIconProps) {
  return (
    <Outline {...props}>
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </Outline>
  )
}

export function FacebookIcon(props: BrandIconProps) {
  return (
    <Outline {...props}>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </Outline>
  )
}

export function LinkedinIcon(props: BrandIconProps) {
  return (
    <Outline {...props}>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </Outline>
  )
}

// Filled, so a stroke width passed to it draws nothing.
export function WhatsAppIcon(props: BrandIconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="24" height="24" fill="currentColor" aria-hidden="true" focusable="false" {...props}>
      <path d="M16.04 3C8.86 3 3.02 8.82 3.02 16c0 2.29.6 4.53 1.74 6.5L3 29l6.68-1.74A13 13 0 0 0 16.04 29C23.2 29 29 23.18 29 16S23.2 3 16.04 3Zm0 23.8c-2.03 0-4.02-.55-5.76-1.58l-.41-.25-3.96 1.03 1.06-3.86-.27-.42A10.76 10.76 0 0 1 5.24 16c0-5.96 4.85-10.8 10.8-10.8 5.95 0 10.78 4.84 10.78 10.8 0 5.95-4.84 10.8-10.78 10.8Zm5.92-8.09c-.32-.16-1.92-.95-2.22-1.06-.3-.11-.51-.16-.73.16-.21.32-.84 1.06-1.03 1.27-.19.22-.38.24-.7.08-.32-.16-1.37-.5-2.6-1.6-.96-.86-1.61-1.91-1.8-2.23-.19-.32-.02-.5.14-.66.15-.14.32-.38.48-.56.16-.19.21-.32.32-.54.11-.21.05-.4-.03-.56-.08-.16-.73-1.75-1-2.4-.26-.63-.53-.54-.73-.55h-.62c-.21 0-.56.08-.86.4-.3.32-1.13 1.1-1.13 2.69 0 1.58 1.16 3.12 1.32 3.33.16.22 2.28 3.48 5.52 4.88.77.33 1.37.53 1.84.68.77.25 1.48.21 2.03.13.62-.09 1.92-.78 2.19-1.54.27-.76.27-1.41.19-1.54-.08-.14-.3-.22-.62-.38Z" />
    </svg>
  )
}
