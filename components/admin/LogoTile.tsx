'use client'

import { useState } from 'react'

const SIZES = {
  // A list row's logo.
  md: { box: 'h-12 w-12 rounded-[14px]', pad: 'p-1.5', initial: 'text-lg' },
  // The business page's hero.
  xl: { box: 'h-20 w-20 rounded-[20px]', pad: 'p-2', initial: 'text-3xl' },
} as const

// A business's logo as a squircle: white, a hairline border and a soft
// shadow, the logo fitted whole (never cropped or upscaled past its pixels)
// with room around it, the same treatment as the member app's badge. Without
// a logo, or when it fails to load, the name's first letter stands in.
// Plain <img>: uploaded logos are already sized by the admin's compressor.
export default function LogoTile({ logoUrl, name, size = 'md', className = '' }: { logoUrl: string; name: string; size?: keyof typeof SIZES; className?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const logo = logoUrl && failedUrl !== logoUrl ? logoUrl : null
  const { box, pad, initial } = SIZES[size]
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center overflow-hidden border border-black/[0.06] shadow-[0_2px_8px_rgba(15,23,42,0.10)] ${box} ${logo ? `bg-white ${pad}` : 'bg-[#F0F7FF]'} ${className}`}
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain" onError={() => setFailedUrl(logo)} />
      ) : (
        <span className={`font-extrabold leading-none text-[#0038B8] ${initial}`}>{[...name.trim()][0]?.toUpperCase() ?? '?'}</span>
      )}
    </span>
  )
}
