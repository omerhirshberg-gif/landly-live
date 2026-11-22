'use client'

// A brand's picture filling its whole frame, edge to edge, never a logo on a white box (native: landly-mobile/src/components/BrandMedia.tsx).
// Put it inside a `relative overflow-hidden` frame. A venue photo (`cover`) is stretched across all four edges. A logo or mark, which can't be
// stretched without clipping, is stacked in three layers: 0 a blurred copy of itself covering the frame, 1 a soft tint over it, 2 the crisp logo,
// whole and centred. The blurred copy is drawn at an eighth of the frame and scaled up from its centre, so the blur runs over 1/64 of the pixels.
export default function BrandMedia({
  src,
  alt = '',
  cover = false,
  inset = 'p-3',
  eager = false,
  onError,
}: {
  src: string
  alt?: string
  /** A photograph: fills the frame, no backdrop. */
  cover?: boolean
  /** Air around a whole logo (a Tailwind padding class). */
  inset?: string
  eager?: boolean
  onError?: () => void
}) {
  const loading = eager ? 'eager' : 'lazy'
  if (cover) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} loading={loading} decoding="async" referrerPolicy="no-referrer" onError={onError} className="absolute inset-0 h-full w-full object-cover" />
  }
  return (
    <>
      <div aria-hidden="true" className="absolute inset-0 z-0 flex items-center justify-center overflow-hidden bg-[#EEF2F7]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" aria-hidden="true" loading={loading} decoding="async" referrerPolicy="no-referrer" className="h-[12.5%] w-[12.5%] flex-shrink-0 scale-[8.8] transform-gpu object-cover opacity-[0.15] blur-[3px]" />
      </div>
      <div aria-hidden="true" className="absolute inset-0 z-[1] bg-[#F4F6F9]/55" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading={loading} decoding="async" referrerPolicy="no-referrer" onError={onError} className={`absolute inset-0 z-[2] h-full w-full object-contain ${inset}`} />
    </>
  )
}
