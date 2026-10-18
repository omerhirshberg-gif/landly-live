import type { Metadata } from 'next'
import { getAdminDb } from '@/lib/firebase/admin'

// The perk page is a client component, so its tab title -- the perk's own
// name, e.g. "10% at Aroma | Landly" -- is resolved here on the server.
// Offers are public (firestore.rules), so this reveals nothing the page
// doesn't. Any failure (missing offer, no Admin credentials) falls back to a
// generic title rather than failing the page.
const FALLBACK_TITLE = 'Perk'

async function offerTitle(offerId: string): Promise<string | null> {
  try {
    const title = (await getAdminDb().collection('offers').doc(offerId).get()).data()?.title
    return typeof title === 'string' && title.trim() ? title.trim() : null
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: { params: Promise<{ offerId: string }> }): Promise<Metadata> {
  const { offerId } = await params
  return { title: (await offerTitle(offerId)) ?? FALLBACK_TITLE }
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
