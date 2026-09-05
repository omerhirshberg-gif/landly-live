// Global feature flags. Keep flat and explicit — no env-var indirection needed
// for a single boolean toggled by hand during development.

// Subscriptions aren't purchasable yet (no Tranzila integration). Gating checks
// must consult this before looking at a user's subscriptionStatus — see
// lib/subscription.ts. Flip to true once real checkout exists and the gate
// should start being enforced.
export const SUBSCRIPTION_ENFORCED = false

export const SUPPORT_EMAIL = 'team.landly@gmail.com'
export const SUPPORT_WHATSAPP_DISPLAY = '+972 55-720-6711'
export const SUPPORT_WHATSAPP_LINK = 'https://wa.me/972557206711'
