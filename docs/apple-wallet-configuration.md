# Apple Wallet configuration

Vouchers become static event-ticket passes (`lib/wallet/applePass.ts`): no web
service, so a pass doesn't change once added. A redeemed or refunded voucher
stays in Wallet looking valid until its expiry date, so the cashier's check of
the voucher remains the source of truth.

## The pass's layout

| Where | Field |
| --- | --- |
| Header | Valid until |
| Strip | The offer's photo, or its category's. No text: `primaryFields` stays empty, as Wallet would draw it over the image |
| First row | The business over the offer |
| Second row | Order number and the member's name |
| Barcode | The QR, centred by Wallet, the redemption code under it |
| Back | How to redeem, discount, terms, address |

It's an event ticket because a coupon or store card has only one row under the
strip. Colours are opaque (`PASS_COLORS`), so the labels' soft tint is a solid
colour. Wallet follows the device's language, not the app's, and aligns text
naturally; never set a right alignment, which wouldn't mirror in Hebrew. A pass
keeps its old look until the member adds it again.

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

A multi-line PEM in `.env.local` must be wrapped in double quotes, or use `\n`
on one line: unquoted, the file parser keeps only the `-----BEGIN` line. Vercel's
field takes the PEM as pasted.

Every deployment checks these before offering the badge
(`lib/wallet/passCredentials.ts`). If they can't sign a valid pass, `availability`
answers `false` and the server logs `Apple Wallet is off:` with one of these codes:

| Code | Fix |
| --- | --- |
| `cert-malformed`, `key-malformed`, `wwdr-malformed` | The PEM didn't parse: check the format above, or the passphrase. |
| `key-not-rsa` | The signing library needs an RSA key. |
| `key-mismatch` | The key isn't the certificate's. |
| `cert-expired` | Renew the Pass Type ID certificate. |
| `wwdr-chain` | Use the WWDR certificate that issued it, in date. |
| `pass-type-mismatch` | `APPLE_PASS_TYPE_ID` isn't the certificate's UID. |
| `team-mismatch` | `APPLE_TEAM_ID` isn't the certificate's OU. |

A failure while building a pass logs `Apple Wallet: building a pass failed at`
`assets`, `sign` or `voucher`. In the app, a development build logs the reason
with `console.warn`.

The certificate expires: renew it before then, or every new pass fails, and the
badge disappears within the hour.

## Without certificates

- `next dev` and tests: **mock mode**. The whole flow runs and the route answers
  with `X-Landly-Pass-Mock: 1`, but the bundle has a placeholder signature, so
  Wallet refuses it. The UI says so instead of opening it.
- Any Vercel deployment: `availability` answers `false`, the route answers 503
  and the badge stays hidden.

## Badge artwork

Download the badges from
<https://developer.apple.com/wallet/add-to-apple-wallet-guidelines/>: an
authorized representative of the developer account has to accept Apple's Wallet
Marketing Agreement there, so it can't be scripted. Copy the SVGs for a light
background, unmodified, to `public/wallet/`:

```
add-to-apple-wallet-en.svg
add-to-apple-wallet-he.svg   (and -ru, -es, -fr where Apple provides them)
```

No code change is needed: the website and the Expo web build both pick them up.
A language without a file falls back to English, and with no files at all a plain
text button shows, which doesn't imitate the badge. The badge is 48px high, above
the 44px touch target, with its 0.1 clear space inside the button.
Never redraw, recolour, flip or animate the artwork. In the app, iOS draws
`PKAddPassButton` itself.

## The iOS module

`landly-mobile/modules/apple-wallet` is a local Expo module, so it needs a new
native build (`npx pod-install`, then `npx expo run:ios` or EAS). Expo Go runs
the fallback: a plain button that opens the pass in the in-app browser.
