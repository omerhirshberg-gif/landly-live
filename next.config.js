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

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: lanAddresses,
}

module.exports = nextConfig
