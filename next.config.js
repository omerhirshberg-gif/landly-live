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
  // The member page was /account until it became /profile; old links,
  // bookmarks and emails keep working.
  async redirects() {
    return [{ source: '/account', destination: '/profile', permanent: true }]
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
