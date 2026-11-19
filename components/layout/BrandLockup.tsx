import Image from 'next/image'
import { RAAYONIT_LOGO_PATH } from '@/lib/payments/issuer'

// "GoLandly × Raayonit" (native: landly-mobile/src/components/BrandLockup.tsx): the GoLandly mark and name, a 1px
// hairline at 20% opacity, then the Raayonit logo in a white rounded frame. The top bar wears it on every page.
// `label` is the accessible name of the pair (translated by the caller); the pictures are decorative. The bar is
// dir="ltr" (components/layout/Navbar.tsx), so the order is the same in every language.
export default function BrandLockup({ label }: { label: string }) {
  return (
    <span role="img" aria-label={label} className="flex items-center gap-2 sm:gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-mark.png" alt="" aria-hidden="true" className="h-8 w-auto sm:h-10" />
      <span aria-hidden="true" className="text-lg font-black tracking-tight text-brand sm:text-xl">GoLandly</span>
      <span aria-hidden="true" className="h-6 w-px bg-ink opacity-20 sm:h-7" />
      <span aria-hidden="true" className="flex h-11 items-center rounded-lg border border-slate-200/80 bg-white px-1.5 sm:h-12 sm:px-2">
        <Image src={RAAYONIT_LOGO_PATH} alt="" width={22} height={40} className="h-9 w-auto sm:h-10" unoptimized />
      </span>
    </span>
  )
}
