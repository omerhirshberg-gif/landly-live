// Read-only store readiness check for the native app (docs/STORE_RELEASE.md). Reads files only: no network, no Firebase.
// Usage: npm run check:store-readiness
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'

const { guardProblems, PROFILE_PROJECT } = createRequire(import.meta.url)('../landly-mobile/config/buildGuard.js')

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
  ['eas profiles', Object.keys(PROFILE_PROJECT).every((p) => eas.build?.[p])],
  ['store profiles are store builds, not simulators', ['testflight', 'production'].every((p) => eas.build?.[p]?.distribution === 'store' && eas.build[p].ios?.simulator === false && eas.build[p].android?.buildType === 'app-bundle')],
  ['production and testflight auto-increment (remote versions)', eas.cli?.appVersionSource === 'remote' && ['testflight', 'production'].every((p) => eas.build?.[p]?.autoIncrement === true)],
  ['environments: production->production, others->not production', eas.build?.production?.environment === 'production' && ['development', 'preview', 'testflight'].every((p) => eas.build?.[p]?.environment && eas.build[p].environment !== 'production')],
  ['guard rejects DEV project in production', guardProblems({ profile: 'production', projectId: 'landly-dev', apiBaseUrl: 'https://www.golandly.com' }).length > 0],
  ['guard rejects PROD api in testflight', guardProblems({ profile: 'testflight', projectId: 'landly-dev', apiBaseUrl: 'https://www.golandly.com' }).length > 0],
  ['guard rejects PROD api in development', ['https://www.golandly.com', 'https://golandly.com'].every((a) => guardProblems({ profile: 'development', projectId: 'landly-dev', apiBaseUrl: a }).length > 0)],
  ['guard keeps local/LAN/DEV api allowed in development', [undefined, 'http://localhost:3000', 'http://192.168.1.5:3000', 'https://landly-dev.vercel.app'].every((a) => guardProblems({ profile: 'development', projectId: 'landly-dev', apiBaseUrl: a }).length === 0)],
  ['guard accepts a matching production env', guardProblems({ profile: 'production', projectId: 'landly-be752', apiBaseUrl: 'https://www.golandly.com' }).length === 0],
  ['no firebase or google ids stored in app.json', !app.extra?.firebase && !app.extra?.googleClientIds],
  ['icons', ['icon.png', 'adaptive-icon.png', 'play-store-icon.png'].every((f) => existsSync(`landly-mobile/assets/${f}`))],
]
for (const [name, ok] of checks) console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`)
for (const v of ['APPLE_TEAM_ID', 'ANDROID_SHA256_CERT_FINGERPRINTS', 'NEXT_PUBLIC_APP_STORE_ID', 'EAS_PROJECT_ID']) console.log(`${process.env[v] ? 'set ' : 'unset'} ${v} (this shell)`)
process.exit(checks.every(([, ok]) => ok) ? 0 : 1)
