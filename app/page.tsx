import type { Metadata } from 'next'
import HomePage from '@/components/home/HomePage'
import JsonLd from '@/components/seo/JsonLd'
import { getLivePublicOffers } from '@/lib/firebase/publicOffers'
import { perksAggregateOfferJsonLd } from '@/lib/seo/jsonLd'
import { HOME_DESCRIPTION, HOME_TITLE, pageMetadata } from '@/lib/seo/site'

// The home page on the server: its search metadata and the club's live perks
// as structured data, around the client page (components/home/HomePage.tsx).
// Re-rendered at most hourly, so new perks reach the structured data without
// a deploy; without Firestore (a local build) the structured data is skipped.
export const revalidate = 3600

export const metadata: Metadata = pageMetadata({ title: HOME_TITLE, description: HOME_DESCRIPTION, path: '/', absoluteTitle: true })

export default async function Page() {
  const offers = await getLivePublicOffers()
  return (
    <>
      <JsonLd data={perksAggregateOfferJsonLd(offers)} />
      <HomePage />
    </>
  )
}
