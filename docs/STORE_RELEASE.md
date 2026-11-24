# Store release (iOS App Store, Google Play)

The native app is `landly-mobile/` (Expo SDK 57, EAS managed credentials). iPhone only in v1; push notifications are out of scope for v1. Google Wallet (website and Android) is covered below.

## Identifiers and where they live (never in the repo)

| Value | Where |
|---|---|
| EAS project id, owner | written to `landly-mobile/app.json` by `eas init` (not secret); `EAS_PROJECT_ID` / `EAS_OWNER` in the build environment override them (`landly-mobile/app.config.js`). Do not keep `extra.firebase` or `extra.googleClientIds` in `app.json`: `eas init` can dump the resolved config there, and the DEV Firebase values would travel with a PROD build. Those come from the EAS environment variables. |
| Apple Team ID | EAS credentials (Apple login), and `APPLE_TEAM_ID` on the website deployment for `/.well-known/apple-app-site-association` |
| Android signing | EAS managed keystore / Play App Signing; the SHA-256 fingerprint(s) go in `ANDROID_SHA256_CERT_FINGERPRINTS` on the website deployment for `/.well-known/assetlinks.json` |
| App Store id, Play live | `NEXT_PUBLIC_APP_STORE_ID`, `NEXT_PUBLIC_GOOGLE_PLAY_LIVE` on the website deployment (lib/appLinks.ts) |
| Firebase and Google client ids | EAS environment variables per profile: `EXPO_PUBLIC_FIREBASE_*`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` |

Profiles (`landly-mobile/eas.json`):

| Profile | Distribution | EAS environment | Firebase project | API origin |
|---|---|---|---|---|
| `development` | dev client (internal, iOS simulator) | `development` | `landly-dev` | LAN `next dev` unless `EXPO_PUBLIC_API_BASE_URL` is set (localhost, LAN or the DEV https URL; never PROD) |
| `preview` | internal (Android APK, iOS ad-hoc) | `preview` | `landly-dev` | explicit DEV https URL |
| `testflight` | store (iOS TestFlight, Android AAB) | `preview` | `landly-dev` | explicit DEV https URL |
| `production` | store (App Store, Play) | `production` | `landly-be752` | `https://www.golandly.com` |

`landly-mobile/config/buildGuard.js` (run from `app.config.js`) **fails the build** when the profile's Firebase project or API origin does not match: `production` needs `landly-be752` and `https://www.golandly.com`; `preview` and `testflight` need `landly-dev` and an explicit https DEV API URL (never localhost or a LAN address, never PROD, never unset, which would fall back to PROD); `development` needs `landly-dev` and rejects the PROD origin (`https://www.golandly.com` or bare `golandly.com`), while unset, localhost, LAN and DEV URLs stay allowed for local work. A build that names its profile (`EAS_BUILD_PROFILE`) ignores the root `.env.local`, so even `eas build --local` cannot bake DEV values into a production binary. The dev-server `NSLocalNetworkUsageDescription` string is removed from every non-development profile. `npm run check:store-readiness` checks the profile shape and the guard.

### EAS environment variables (same names in each environment)

| Variable | `production` (`landly-be752`) | `preview` / `development` (`landly-dev`) |
|---|---|---|
| `EXPO_PUBLIC_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_STORAGE_BUCKET`, `_MESSAGING_SENDER_ID`, `_APP_ID` | the PROD web app's values; `_PROJECT_ID` must be `landly-be752` | the DEV values; `_PROJECT_ID` must be `landly-dev` |
| `EXPO_PUBLIC_API_BASE_URL` | `https://www.golandly.com` | the DEV web app's https URL (required for `preview`/`testflight`) |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | PROD web client id | DEV web client id |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | PROD iOS OAuth client id | DEV iOS OAuth client id |

None of these is secret (they ship in the binary); real secrets (Apple `.p8`, Play service-account key, App Store Connect API key) stay in EAS credentials or the web deployment, never in the repo.

### Credentials checklist

iOS: `eas credentials -p ios` (distribution certificate + provisioning profile, managed by EAS); the `com.amitbd.landlyapp` App ID needs Sign in with Apple and Associated Domains; create the App Store Connect record and give `eas submit` an App Store Connect API key (the numeric app id goes in `eas submit --id`, or the prompt); `APPLE_TEAM_ID` on the website deployment; `npm run check:apple-key` for the Firebase Apple provider of that project.

Android: `eas credentials -p android` shows the upload keystore SHA-1 and SHA-256. In the Google Cloud project of the Firebase project, create an Android OAuth client (package `com.amitbd.landlyapp`) for the upload key's SHA-1. After the first upload, Play App Signing re-signs the app with its own key: add **that** key's SHA-1 as a second Android client, and its SHA-256 to `ANDROID_SHA256_CERT_FINGERPRINTS` on the website deployment (`assetlinks.json`). The first AAB must be uploaded by hand in Play Console; after that `eas submit` needs a service-account key stored in EAS credentials.

### Release variables reported by `npm run check:store-readiness`

The script prints `unset <NAME> (this shell)` for each of these four; they are not repo values and are expected to be unset locally. Set them where they belong before a store release:

| Variable | Where | Used for |
|---|---|---|
| `APPLE_TEAM_ID` | website deployment (DEV and PROD) | `apple-app-site-association` (universal links) |
| `ANDROID_SHA256_CERT_FINGERPRINTS` | website deployment (DEV and PROD) | `assetlinks.json` (Android app links): upload key and Play App Signing key |
| `NEXT_PUBLIC_APP_STORE_ID` | website deployment, after the iOS listing is public | App Store badge and link (`lib/appLinks.ts`) |
| `EAS_PROJECT_ID` | shell or CI that runs EAS (set by `eas init`) | links the build to the EAS project (`app.config.js`) |

## Release steps

1. `npx eas-cli@latest login`, then `eas init` (links the project; export `EAS_PROJECT_ID`).
2. Create the EAS environment variables for `development`, `preview` and `production`.
3. Set `APPLE_TEAM_ID` and `ANDROID_SHA256_CERT_FINGERPRINTS` on the website deployments (DEV and PROD), then check `https://www.golandly.com/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` return JSON.
4. DEV testing: `eas build --profile testflight --platform all`, then `eas submit --profile testflight`. PROD: `eas build --profile production --platform all`, then `eas submit --profile production`.
5. After the listings are public, set the store variables above.

## Payments in v1

A perk is listed but cannot be bought while no payment gateway is live (no `TRANZILA_TERMINAL`, no dev sandbox): the server marks every public offer `comingSoon` (`lib/offers/purchaseAvailability.ts`), and the website and the app replace Buy with a "purchases open very soon" notice and a disabled button. Setting `TRANZILA_TERMINAL` turns purchases on with no app update.

There is no free-claim flow: every purchase goes through a gateway (`/api/payments/initiate`, Tranzila or the dev sandbox). While PROD has no terminal, a reviewer can browse perks, sign in with Apple or Google, view the profile and delete the account, but cannot buy. Say so in the App Review notes (purchases open once the payment provider is activated; vouchers are redeemed outside the app) and provide a demo account.

## App Review notes (when live checkout is wired)

Vouchers bought in the app are redeemed at physical merchants outside the app (in-store or on the merchant's own site), so they are goods and services consumed outside the app (Guideline 3.1.3(e)); payment is by card through Tranzila, not In-App Purchase. Say this in the review notes, and provide a demo account.

## Store forms

- Privacy Nutrition Label / Play Data Safety: email, name, phone number, approximate and precise location (when in use, optional), photos (optional profile picture), Firebase Auth identifiers. No tracking. Keep consistent with `/privacy`.
- Account deletion: in-app (Settings > Delete account) and on the web (`/settings/delete-account`). The request is recorded in `accountDeletionRequests/{uid}` and emailed to the team; the confirmation tells the member the account is deleted and confirmed by email within 30 days, matching the Privacy Policy.

## Google Wallet (Android, website)

Vouchers can be added to Google Wallet as a GenericObject of a GenericClass (`lib/wallet/googlePass.ts`: navy card, the offer as its title, issuer line, hero, a two-column row of issuer | redemption and order | valid until), next to Apple Wallet. Shown on Android and on desktop browsers, never on iPhone or iPad. A static snapshot, like the Apple pass.

| Value | Where |
|---|---|
| `GOOGLE_WALLET_ISSUER_ID` | website deployment, dev and prod (the same issuer). Unset: the badge stays hidden and the route answers 503. |
| Signing | the Firebase Admin service account of the deployment's own project (`FIREBASE_ADMIN_CLIENT_EMAIL` / `FIREBASE_ADMIN_PRIVATE_KEY`), which must be an issuer user in the Google Pay & Wallet Console, with the Wallet API enabled in its project |
| Class ids | `<issuer>.golandly_generic_prod` (production only) and `<issuer>.golandly_generic_dev` (preview, local); the older Offer classes `golandly_voucher_*` stay registered for passes already saved; created on first use, or ahead of time with `scripts/setupGoogleWalletClass.ts` (`--target dev`, or `--target prod --confirm-production`; `--update` patches an existing class, e.g. after changing the row layout) |
| Images | the pass's logo and hero are `public/wallet/google/logo.png` and `hero.png`, fetched by Google when a pass is saved, so they must be deployed first. They always come from a public https origin: the deployment, else `WALLET_ASSET_ORIGIN`, else `https://www.golandly.com`, never localhost |

The issuer (`3388000000023245879`) has been granted production access in the Google Pay & Wallet Console and is Active: it is no longer restricted to Demo-mode test users, so any member can save a pass (production class `3388000000023245879.golandly_voucher_prod`, dev class `3388000000023245879.golandly_voucher_dev`). The badge artwork in `public/wallet/google/` and `landly-mobile/assets/wallet/` is Google's own, unmodified (README.txt there).
