# Apple Wallet configuration

Vouchers become static coupon passes (`lib/wallet/applePass.ts`): no web
service, so a pass doesn't change once added. A redeemed or refunded voucher
stays in Wallet looking valid until its expiry date, so the cashier's check of
the voucher remains the source of truth.

## One setup per environment

Create **two** Pass Type IDs in the Apple Developer portal (Certificates,
Identifiers & Profiles → Identifiers → Pass Type IDs), each with its own
certificate. A wrong ID for the deployment turns the feature off
(`lib/wallet/passConfig.ts`).

| Where | Firebase project | `APPLE_PASS_TYPE_ID` |
| --- | --- | --- |
| Vercel Production | `landly-be752` | `pass.com.landly.voucher` |
| Vercel Preview | `landly-dev` | `pass.com.landly.voucher.dev` |
| Local (`.env.local`) | `landly-dev` | `pass.com.landly.voucher.dev` |

| Variable | Value |
| --- | --- |
| `APPLE_PASS_TYPE_ID` | From the table above. |
| `APPLE_TEAM_ID` | The 10-character Team ID. |
| `APPLE_PASS_CERT_PEM` | The Pass Type ID certificate, PEM, newlines as `\n`. |
| `APPLE_PASS_KEY_PEM` | Its private key, PEM, newlines as `\n`. |
| `APPLE_PASS_KEY_PASSPHRASE` | Optional: the key's passphrase. |
| `APPLE_WWDR_PEM` | Apple's WWDR intermediate certificate (G4), PEM, newlines as `\n`. |
| `APPLE_PASS_TICKET_SECRET` | A random string of at least 32 characters; different per environment. |

The certificate expires: renew it before then, or every new pass fails.

## Without certificates

- `next dev` and tests: **mock mode**. The whole flow runs and the route answers
  with `X-Landly-Pass-Mock: 1`, but the bundle has a placeholder signature, so
  Wallet refuses it. The UI says so instead of opening it.
- Any Vercel deployment: `availability` answers `false`, the route answers 503
  and the badge stays hidden.

## Badge artwork

Download the badges from
<https://developer.apple.com/wallet/add-to-apple-wallet-guidelines/> (an
authorized representative of the developer account accepts Apple's licence
there). Copy them, unmodified, to `public/wallet/`:

```
add-to-apple-wallet-en.svg
add-to-apple-wallet-he.svg   (and -ru, -es, -fr where Apple provides them)
```

No code change is needed: a language without a file falls back to English, and
with no files at all a plain text button shows, which doesn't imitate the badge.
Never redraw, recolour, flip or animate the artwork. In the app, iOS draws
`PKAddPassButton` itself.

## The iOS module

`landly-mobile/modules/apple-wallet` is a local Expo module, so it needs a new
native build (`npx pod-install`, then `npx expo run:ios` or EAS). Expo Go runs
the fallback: a plain button that opens the pass in the in-app browser.
