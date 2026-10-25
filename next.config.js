const os = require('os')

// `next dev` serves its scripts (/_next/*) only to localhost and the host it
// was started with. A phone opening this machine's LAN address (the Expo
// app's in-app browser, or mobile Safari) would get the HTML without
// hydration: forms fall back to a plain reload and nothing else works. So the
// machine's own IPv4 addresses are allowed too. Development only; Next.js
// ignores this setting in production.
const lanAddresses = Object.values(os.networkInterfaces())
  .flat()
  .filter((address) => address && (address.family === 'IPv4' || address.family === 4) && !address.internal)
  .map((address) => address.address)

// Firebase Auth's sign-in helper, served from our own origin so it's
// first-party on browsers that partition third-party storage (see
// lib/firebase/authDomain.ts). Always the project's firebaseapp.com host,
// never NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, which may name this site itself.
// No project configured, no proxy -- never a default project, which would
// send local sign-ins to production.

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: lanAddresses,
  // Where this build runs, for lib/firebase/envGuard.ts -- inlined so the
  // browser bundle picks the same Firebase project check as the server.
  // Unset (a local build) becomes '', which the guard treats as local.
  env: {
    LANDLY_VERCEL: process.env.VERCEL ?? '',
    LANDLY_VERCEL_ENV: process.env.VERCEL_ENV ?? '',
  },
  // The member page was /account until it became /profile; old links,
  // bookmarks and emails keep working. The bare domain goes to www, the
  // canonical host (308, path and query kept). Vercel's domain settings
  // already do this before the app sees the request; this keeps it true on
  // any other host.
  async redirects() {
    return [
      { source: '/account', destination: '/profile', permanent: true },
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'golandly.com' }],
        destination: 'https://www.golandly.com/:path*',
        permanent: true,
      },
    ]
  },
  // HTTPS only, for two years, on every subdomain too (and eligible for the
  // browsers' preload list); and no MIME sniffing.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ]
  },
  async rewrites() {
    const firebaseProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    if (!firebaseProjectId) return []
    const firebaseAuthOrigin = `https://${firebaseProjectId}.firebaseapp.com`
    return [
      { source: '/__/auth/:path*', destination: `${firebaseAuthOrigin}/__/auth/:path*` },
      { source: '/__/firebase/:path*', destination: `${firebaseAuthOrigin}/__/firebase/:path*` },
    ]
  },
}

module.exports = nextConfig
