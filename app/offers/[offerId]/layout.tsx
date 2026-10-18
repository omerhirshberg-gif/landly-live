import type { Metadata } from 'next'
import JsonLd from '@/components/seo/JsonLd'
import { getPublicOffer } from '@/lib/firebase/publicOffers'
import { offerSeoDescription } from '@/lib/offers/publicOffer'
import { offerJsonLd } from '@/lib/seo/jsonLd'
import { pageMetadata } from '@/lib/seo/site'

// The perk page is a client component, so its search metadata -- the perk's
// own name as the tab title ("10% at Aroma | Landly"), its description, its
// photo as the share card -- and its structured data (the perk as a Product
// with its member price) are resolved here on the server. Offers are public
// (firestore.rules), so this reveals nothing the page doesn't. Any failure
// (missing offer, no Admin credentials) falls back to a generic title and no
// structured data rather than failing the page. getPublicOffer is cached per
// request, so generateMetadata and the layout share one read.
const FALLBACK_TITLE = 'Perk'

type Params = { params: Promise<{ offerId: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { offerId } = await params
  const offer = await getPublicOffer(offerId)
  if (!offer) return { title: FALLBACK_TITLE }
  return pageMetadata({
    title: offer.title,
    description: offerSeoDescription(offer),
    path: `/offers/${encodeURIComponent(offerId)}`,
    image: offer.imageUrl || undefined,
  })
}

export default async function Layout({ children, params }: Params & { children: React.ReactNode }) {
  const { offerId } = await params
  const offer = await getPublicOffer(offerId)
  return (
    <>
      <JsonLd data={offer ? offerJsonLd(offer) : null} />
      {children}
    </>
  )
}
