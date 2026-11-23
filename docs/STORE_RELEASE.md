# Store release (iOS App Store, Google Play)

The native app is `landly-mobile/` (Expo SDK 57, EAS managed credentials). iPhone only in v1; push notifications and Google Wallet are out of scope for v1.

## Identifiers and where they live (never in the repo)

| Value | Where |
|---|---|
| EAS project id, owner | written to `landly-mobile/app.json` by `eas init` (not secret); `EAS_PROJECT_ID` / `EAS_OWNER` in the build environment override them (`landly-mobile/app.config.js`). Do not keep `extra.firebase` or `extra.googleClientIds` in `app.json`: `eas init` can dump the resolved config there, and the DEV Firebase values would travel with a PROD build. Those come from the EAS environment variables. |
| Apple Team ID | EAS credentials (Apple login), and `APPLE_TEAM_ID` on the website deployment for `/.well-known/apple-app-site-association` |
| Android signing | EAS managed keystore / Play App Signing; the SHA-256 fingerprint(s) go in `ANDROID_SHA256_CERT_FINGERPRINTS` on the website deployment for `/.well-known/assetlinks.json` |
| App Store id, Play live | `NEXT_PUBLIC_APP_STORE_ID`, `NEXT_PUBLIC_GOOGLE_PLAY_LIVE` on the website deployment (lib/appLinks.ts) |
| Firebase and Google client ids | EAS environment variables per profile: `EXPO_PUBLIC_FIREBASE_*`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` |

Profiles (`landly-mobile/eas.json`): `development` and `preview` use the EAS `development` / `preview` environments, which must point at `landly-dev`; `production` uses the `production` environment, which must point at `landly-be752`. Set the same variable names in each environment so DEV and PROD stay aligned. Associated domain: `www.golandly.com` only (the apex redirects, and Apple does not follow redirects for the association file).

## Release steps

1. `npx eas-cli@latest login`, then `eas init` (links the project; export `EAS_PROJECT_ID`).
2. Create the EAS environment variables for `development`, `preview` and `production`.
3. Set `APPLE_TEAM_ID` and `ANDROID_SHA256_CERT_FINGERPRINTS` on the website deployments (DEV and PROD), then check `https://www.golandly.com/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` return JSON.
4. `eas build --profile production --platform all`, then `eas submit --profile production`.
5. After the listings are public, set the store variables above.

## Payments in v1

A perk is listed but cannot be bought while no payment gateway is live (no `TRANZILA_TERMINAL`, no dev sandbox): the server marks every public offer `comingSoon` (`lib/offers/purchaseAvailability.ts`), and the website and the app replace Buy with a "purchases open very soon" notice and a disabled button. Setting `TRANZILA_TERMINAL` turns purchases on with no app update.

## App Review notes (when live checkout is wired)

Vouchers bought in the app are redeemed at physical merchants outside the app (in-store or on the merchant's own site), so they are goods and services consumed outside the app (Guideline 3.1.3(e)); payment is by card through Tranzila, not In-App Purchase. Say this in the review notes, and provide a demo account.

## Store forms

- Privacy Nutrition Label / Play Data Safety: email, name, phone number, approximate and precise location (when in use, optional), photos (optional profile picture), Firebase Auth identifiers. No tracking. Keep consistent with `/privacy`.
- Account deletion: in-app (Settings > Delete account) and on the web (`/settings/delete-account`).

## Google Wallet (Android, website)

Vouchers can be added to Google Wallet as an OfferObject of an OfferClass (`lib/wallet/googlePass.ts`), next to Apple Wallet. Shown on Android and on desktop browsers, never on iPhone or iPad. A static snapshot, like the Apple pass.

| Value | Where |
|---|---|
| `GOOGLE_WALLET_ISSUER_ID` | website deployment, dev and prod (the same issuer). Unset: the badge stays hidden and the route answers 503. |
| Signing | the Firebase Admin service account of the deployment's own project (`FIREBASE_ADMIN_CLIENT_EMAIL` / `FIREBASE_ADMIN_PRIVATE_KEY`), which must be an issuer user in the Google Pay & Wallet Console, with the Wallet API enabled in its project |
| Class ids | `<issuer>.golandly_voucher_prod` (production only) and `<issuer>.golandly_voucher_dev` (preview, local); created on first use, or ahead of time with `scripts/setupGoogleWalletClass.ts` (`--target dev`, or `--target prod --confirm-production`; `--update` patches an existing class) |
| Images | the pass's logo is `public/wallet/google/logo.png`, fetched by Google from the site: only production and Vercel previews serve it, so a pass made locally has no images |

While the issuer is in Demo mode only the test users listed in the Console can save a pass; publishing needs Google's production-access review. The badge artwork in `public/wallet/google/` and `landly-mobile/assets/wallet/` is Google's own, unmodified (README.txt there).
