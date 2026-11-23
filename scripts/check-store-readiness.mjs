// Read-only store readiness check for the native app (docs/STORE_RELEASE.md). Reads files only: no network, no Firebase.
// Usage: npm run check:store-readiness
import { readFileSync, existsSync } from 'node:fs'

const read = (p) => JSON.parse(readFileSync(p, 'utf8'))
const app = read('landly-mobile/app.json').expo
const eas = read('landly-mobile/eas.json')
const checks = [
  ['iPhone only', app.ios.supportsTablet === false],
  ['bundle id and package match', app.ios.bundleIdentifier === app.android.package],
  ['no push plugin', !app.plugins.includes('expo-notifications')],
  ['5 localizations', ['en', 'he', 'ru', 'fr', 'es'].every((l) => app.ios.infoPlist.CFBundleLocalizations.includes(l) && existsSync(`landly-mobile/locales/${l}.json`))],
  ['export compliance declared', app.ios.infoPlist.ITSAppUsesNonExemptEncryption === false],
  ['associated domain', (app.ios.associatedDomains ?? []).includes('applinks:www.golandly.com')],
  ['android app links', (app.android.intentFilters ?? []).some((f) => f.autoVerify)],
  ['eas profiles', ['development', 'preview', 'production'].every((p) => eas.build?.[p])],
  ['icons', ['icon.png', 'adaptive-icon.png', 'play-store-icon.png'].every((f) => existsSync(`landly-mobile/assets/${f}`))],
]
for (const [name, ok] of checks) console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`)
for (const v of ['APPLE_TEAM_ID', 'ANDROID_SHA256_CERT_FINGERPRINTS', 'NEXT_PUBLIC_APP_STORE_ID', 'EAS_PROJECT_ID']) console.log(`${process.env[v] ? 'set ' : 'unset'} ${v} (this shell)`)
process.exit(checks.every(([, ok]) => ok) ? 0 : 1)
