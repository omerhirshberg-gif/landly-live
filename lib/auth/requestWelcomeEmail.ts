import { normalizeApiBaseUrl } from '@/lib/apiOrigin'

export const WELCOME_EMAIL_TIMEOUT_MS = 15_000

const PATH = '/api/account/welcome-email'

// Asks the server for the "Welcome to Landly" email once the onboarding
// wizard has stored its answers. Shared by the website (same origin, base '')
// and the app (passes API_BASE_URL). Fire-and-forget: callers don't await
// it, and it never throws, so a slow or failed send can't hold up or break
// the celebration card. The server decides whether to send (at most once per
// member). Same transport rules as lib/account/contactChange.ts: no redirects
// followed (they'd drop the Authorization header), and the timeout uses
// setTimeout + AbortController for Hermes.
export async function requestWelcomeEmail(getIdToken: () => Promise<string>, apiBaseUrl = ''): Promise<void> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), WELCOME_EMAIL_TIMEOUT_MS)
  try {
    const idToken = await getIdToken()
    await fetch(`${normalizeApiBaseUrl(apiBaseUrl)}${PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: '{}',
      redirect: 'manual',
      signal: controller.signal,
    })
  } catch (err) {
    // console.warn, not error: React Native turns console.error into a redbox.
    if (process.env.NODE_ENV !== 'production') console.warn('[welcome-email] request failed', err)
  } finally {
    clearTimeout(timer)
  }
}
