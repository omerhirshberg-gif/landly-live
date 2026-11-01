import { useId, type SVGProps } from 'react'

// The brand marks Lucide doesn't draw (it ships no logos). Instagram, Facebook
// and LinkedIn are the real marks in their own colours, so they carry no
// `currentColor`; WhatsApp is its filled speech-bubble mark, the same one the
// support widget shows (components/layout/WhatsAppWidget.tsx), and takes the
// colour around it. Decorative: the link or button around one names it. None
// is directional, so none mirrors in Hebrew.
type BrandIconProps = Omit<SVGProps<SVGSVGElement>, 'ref'> & { strokeWidth?: number }

function Logo({ children, ...props }: BrandIconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false" {...props}>
      {children}
    </svg>
  )
}

// Its gradient's id is per icon: a page shows this mark more than once, and a shared id would hang on the first one staying rendered.
export function InstagramIcon(props: BrandIconProps) {
  const gradient = `instagram-${useId().replace(/\W/g, '')}`
  return (
    <Logo {...props}>
      <defs>
        <radialGradient id={gradient} cx="0.28" cy="1.08" r="1.3">
          <stop offset="0" stopColor="#FFDD55" />
          <stop offset="0.1" stopColor="#FFDD55" />
          <stop offset="0.5" stopColor="#FF543E" />
          <stop offset="1" stopColor="#C837AB" />
        </radialGradient>
      </defs>
      <rect width="24" height="24" rx="5.5" fill={`url(#${gradient})`} />
      <g fill="none" stroke="#FFFFFF" strokeWidth="1.9">
        <rect x="4.6" y="4.6" width="14.8" height="14.8" rx="4.2" />
        <circle cx="12" cy="12" r="3.6" />
      </g>
      <circle cx="16.6" cy="7.4" r="1.05" fill="#FFFFFF" />
    </Logo>
  )
}

export function FacebookIcon(props: BrandIconProps) {
  return (
    <Logo {...props}>
      <circle cx="12" cy="12" r="11.4" fill="#FFFFFF" />
      <path fill="#0866FF" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </Logo>
  )
}

export function LinkedinIcon(props: BrandIconProps) {
  return (
    <Logo {...props}>
      <rect x="1.5" y="1.5" width="21" height="21" fill="#FFFFFF" />
      <path fill="#0A66C2" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </Logo>
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
