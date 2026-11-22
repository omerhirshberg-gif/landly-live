'use client'

import Image from 'next/image'
import { issuerLine, RAAYONIT_LOGO_PATH, type VoucherIssuer } from '@/lib/payments/issuer'
import { useRaayonitDisplay } from '@/lib/flags/raayonitDisplayStore'

// The issuer's card: "Issued by Raayonit Ltd." with the issuer's logo large in a white frame, on the offer page, the order
// summary, a voucher under its code and the order confirmation (native: landly-mobile/src/components/IssuerAttribution.tsx).
// The logo is public/images/partners/raayonit-logo.png (the official logo on white, portrait). `note` is a quieter line under
// the headline (what the voucher is, how long it lasts). Takes the language as a prop so server and client pages can both use it.
export default function IssuerAttribution({ issuer, lang, note, className = '' }: { issuer: VoucherIssuer; lang: string; note?: string; className?: string }) {
  // Raayonit's name and logo show only once its written approval is switched on (lib/flags/featureFlags.ts).
  const display = useRaayonitDisplay()
  if (!display) return null
  const line = issuerLine(issuer, lang)
  return (
    <div className={`flex items-center gap-4 rounded-2xl border-[1.5px] border-brand/25 bg-gradient-to-br from-brandTint to-white p-4 text-start shadow-[0_12px_32px_-12px_rgba(0,56,184,0.28)] ${className}`}>
      <span aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-[1.5px] border-[#CBD5E1] bg-white">
        <Image src={RAAYONIT_LOGO_PATH} alt="" width={26} height={46} className="h-[46px] w-auto" unoptimized />
      </span>
      <div className="min-w-0 space-y-1">
        <p className="text-[17px] font-extrabold leading-snug text-ink">{line}</p>
        {note && <p className="text-[13px] leading-5 text-slate-600">{note}</p>}
      </div>
    </div>
  )
}
