import type { GeoAddress } from '@/lib/geo'
import { displayPhone, telHref, whatsappHref } from '@/lib/admin/businessPhone'
import CategoryBadge from './CategoryBadge'
import BidiText from './BidiText'
import LogoTile from './LogoTile'
import StatusBadge from './StatusBadge'

export interface HeroBusiness {
  businessName: string
  /** The name in the other language (English for a Hebrew name, and back), when it differs. */
  altName: string
  businessId: string
  category: string
  location: string
  address: GeoAddress | null
  logoUrl: string
  phone: string
}

const LINK = 'inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0038B8]'

// The top of a business's page: its logo large, its name (and the name in
// the other language), category and ח.פ, then where it is and how to reach
// it: Google Maps and Waze when it's on the map, call and WhatsApp when it
// has a phone. `actions` is the page's own buttons (Add offer, ⋯).
export default function BusinessHero({ business, actions }: { business: HeroBusiness; actions: React.ReactNode }) {
  const { address } = business
  const place = address ? `${address.lat},${address.lng}` : ''
  return (
    <section aria-label="Business" className="mb-8 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-4 sm:gap-5">
          <LogoTile logoUrl={business.logoUrl} name={business.businessName} size="xl" />
          <div className="min-w-0 pt-1">
            {/* The admin header already names the page, so the h1 is for screen readers (as PageHeader's is). */}
            <h1 className="sr-only">{business.businessName}</h1>
            <p aria-hidden="true" className="text-xl font-bold leading-tight text-[#0B1B3D] sm:text-2xl">
              <BidiText lines={2}>{business.businessName}</BidiText>
            </p>
            {business.altName && (
              <p className="mt-0.5 text-sm text-[#475569]">
                <BidiText>{business.altName}</BidiText>
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <CategoryBadge category={business.category} />
              <StatusBadge tone="slate" icon="fa-hashtag">
                <span className="sr-only">ח.פ</span>
                <bdi dir="ltr" className="tabular-nums">
                  {business.businessId}
                </bdi>
              </StatusBadge>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:shrink-0">{actions}</div>
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-[#E2E8F0] pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2 text-sm text-[#475569]">
          <i className={`fa-solid fa-location-dot mt-0.5 ${address ? 'text-emerald-600' : 'text-[#94A3B8]'}`} aria-hidden="true" />
          <bdi dir="auto" className="min-w-0 [text-align:match-parent]">
            {address?.formatted.en || address?.formatted.he || business.location}
          </bdi>
          {!address && <StatusBadge tone="amber">Not on the map</StatusBadge>}
        </div>
        <div className="-mx-3 flex flex-wrap items-center sm:mx-0">
          {address && (
            <>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}&query_place_id=${encodeURIComponent(address.placeId)}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`${LINK} text-[#0038B8] hover:bg-[#F0F7FF]`}
              >
                <i className="fa-solid fa-map-location-dot text-xs" aria-hidden="true" />
                Google Maps
              </a>
              <a href={`https://waze.com/ul?ll=${encodeURIComponent(place)}&navigate=yes`} target="_blank" rel="noopener noreferrer" className={`${LINK} text-[#0038B8] hover:bg-[#F0F7FF]`}>
                <i className="fa-brands fa-waze text-xs" aria-hidden="true" />
                Waze
              </a>
            </>
          )}
          {business.phone && (
            <>
              <a href={telHref(business.phone)} className={`${LINK} text-[#0B1B3D] hover:bg-[#F1F5F9]`}>
                <i className="fa-solid fa-phone text-xs" aria-hidden="true" />
                <bdi dir="ltr" className="tabular-nums">
                  {displayPhone(business.phone)}
                </bdi>
              </a>
              <a href={whatsappHref(business.phone)} target="_blank" rel="noopener noreferrer" className={`${LINK} text-emerald-700 hover:bg-[#ECFDF5]`}>
                <i className="fa-brands fa-whatsapp text-sm" aria-hidden="true" />
                WhatsApp
              </a>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
