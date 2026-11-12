import 'server-only'
import { revalidatePath } from 'next/cache'
import { revalidatePublicOffers } from '@/lib/firebase/offersCache.server'

// The guest home (app/page.tsx) is rendered on the server and kept for up to
// an hour; its partner ticker, top savings and structured data come from the
// offers. Every admin write that changes what those show calls this, so the
// next visit renders them afresh instead of waiting out the hour. (The perks
// catalog and the member home read the cached /api/public/offers, dropped here too.)
export function revalidateGuestHome(): void {
  revalidatePath('/')
  revalidatePublicOffers()
}
