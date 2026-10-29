'use client'

import { useState } from 'react'

// An offer's photo as a small thumbnail for a table row, with its business's
// logo as a tiny badge on the bottom end corner (the member cards' pairing,
// scaled down). A missing or broken photo shows a quiet placeholder; a
// missing logo just leaves the badge off.
export default function OfferThumb({ imageUrl, logoUrl }: { imageUrl: string; logoUrl: string }) {
  const [failed, setFailed] = useState<string[]>([])
  const photo = imageUrl && !failed.includes(imageUrl) ? imageUrl : null
  const logo = logoUrl && !failed.includes(logoUrl) ? logoUrl : null
  const fail = (url: string) => () => setFailed((prev) => [...prev, url])
  return (
    <span aria-hidden="true" className="relative block h-10 w-14 shrink-0">
      <span className="block h-full w-full overflow-hidden rounded-lg border border-[#E2E8F0] bg-gradient-to-br from-[#F0F7FF] to-[#E2E8F0]">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" onError={fail(photo)} />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-xs text-[#0038B8]/30">
            <i className="fa-solid fa-image" />
          </span>
        )}
      </span>
      {logo && (
        <span className="absolute -bottom-1 -end-1 flex h-5 w-5 items-center justify-center overflow-hidden rounded-md border border-black/[0.06] bg-white p-0.5 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain" onError={fail(logo)} />
        </span>
      )}
    </span>
  )
}
