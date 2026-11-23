// The files that tie the website to the native app, so a golandly.com offer or voucher link opens the app when it is
// installed (iOS universal links, Android App Links). Served from app/.well-known/*; the Apple Team ID and the Android
// signing fingerprints come from the deployment's environment, never the repo, and a file whose value is unset is not
// served at all (404) rather than served half-empty. The same variables go in the dev and production deployments.
//
//   APPLE_TEAM_ID                  the 10-character Apple Developer Team ID
//   ANDROID_SHA256_CERT_FINGERPRINTS  comma-separated SHA-256 fingerprints of the app signing key(s) (Play Console >
//                                     App integrity > App signing key certificate, and the upload key for local builds)
import { ANDROID_PACKAGE } from './appLinks'

export const IOS_BUNDLE_ID = 'com.amitbd.landlyapp'
/** The website paths the app opens (mirrors lib/navigation/deepLinks.ts). */
export const UNIVERSAL_LINK_PATHS = ['/offers/*', '/member/vouchers/*'] as const

const TEAM_ID = /^[A-Z0-9]{10}$/
const FINGERPRINT = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/

export function appleAppSiteAssociation(teamId: string | undefined) {
  const id = teamId?.trim().toUpperCase()
  if (!id || !TEAM_ID.test(id)) return null
  return {
    applinks: {
      details: [{ appIDs: [`${id}.${IOS_BUNDLE_ID}`], components: UNIVERSAL_LINK_PATHS.map((path) => ({ '/': path })) }],
    },
  }
}

export function parseFingerprints(value: string | undefined): string[] {
  return (value ?? '').split(',').map((f) => f.trim().toUpperCase()).filter((f) => FINGERPRINT.test(f))
}

export function assetLinks(value: string | undefined) {
  const fingerprints = parseFingerprints(value)
  if (fingerprints.length === 0) return null
  return [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: { namespace: 'android_app', package_name: ANDROID_PACKAGE, sha256_cert_fingerprints: fingerprints },
    },
  ]
}
