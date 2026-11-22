// The solo GoLandly lockup (native: landly-mobile/src/components/BrandLockup.tsx): the star emblem and the wordmark, nothing else. The top bar
// wears it on every page; the Raayonit logo lives on the club card, /raayonit and the Raayonit offer, checkout and voucher pages.
// `label` is the accessible name (translated by the caller); the pictures are decorative. The bar is dir="ltr"
// (components/layout/Navbar.tsx), so the order is the same in every language.
export default function BrandLockup({ label }: { label: string }) {
  return (
    <span role="img" aria-label={label} className="flex items-center gap-2 sm:gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-mark.png" alt="" aria-hidden="true" className="h-8 w-auto sm:h-10" />
      <span aria-hidden="true" className="text-lg font-black tracking-tight text-brand sm:text-xl">GoLandly</span>
    </span>
  )
}
