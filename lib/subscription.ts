import { SUBSCRIPTION_ENFORCED } from '@/lib/config'
import type { SubscriptionStatus } from '@/lib/firebase/users'

// Single choke point for subscription gating. While SUBSCRIPTION_ENFORCED is
// false, every logged-in user is treated as having access regardless of their
// stored subscriptionStatus — callers should still pass the real status so
// this starts enforcing correctly the moment the flag flips.
export function hasSubscriptionAccess(subscriptionStatus: SubscriptionStatus): boolean {
  if (!SUBSCRIPTION_ENFORCED) return true
  return subscriptionStatus === 'active'
}
