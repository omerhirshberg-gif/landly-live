// Which host serves Firebase Auth's sign-in helper (/__/auth/handler and
// /__/auth/iframe) for the website.
//
// By default it's <project>.firebaseapp.com: a different site from the page,
// so on mobile browsers that partition third-party storage (iOS Safari,
// Chrome for iOS, the Google app, ...) the helper iframe can't see what the
// popup or redirect stored, and sign-in fails with "missing initial state".
// next.config.js proxies /__/auth/* and /__/firebase/* from our own origin to
// firebaseapp.com, so on a host listed here the helper is first-party.
//
// Only hosts whose https://<host>/__/auth/handler is an authorised redirect
// URI on the Google OAuth web client (Google Cloud Console) qualify; anything
// else -- localhost, a LAN address, Vercel previews -- keeps the env value.
// NEXT_PUBLIC_FIREBASE_AUTH_PROXY=1 switches it on, so the code can deploy
// ahead of the console change.
export const PROXIED_AUTH_HOSTS = ['www.golandly.com'] as const

export function resolveAuthDomain(params: {
  host: string | null | undefined
  envAuthDomain: string | undefined
  proxyEnabled: boolean
}): string | undefined {
  const { host, envAuthDomain, proxyEnabled } = params
  if (proxyEnabled && host && (PROXIED_AUTH_HOSTS as readonly string[]).includes(host.toLowerCase())) return host.toLowerCase()
  return envAuthDomain
}

/** The authDomain for this page load (the env value during server rendering). */
export function currentAuthDomain(): string | undefined {
  return resolveAuthDomain({
    host: typeof window === 'undefined' ? null : window.location.host,
    // Literal process.env reads, so Next.js inlines them into the browser bundle.
    envAuthDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    proxyEnabled: process.env.NEXT_PUBLIC_FIREBASE_AUTH_PROXY === '1',
  })
}
