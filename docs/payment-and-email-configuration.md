# Payment integrity and transactional email configuration

## Application origin

Set **server-side** `APP_URL=https://golandly.com` (or your intended deployment
origin). No email URL is derived from Host or forwarded headers. The value must
be an HTTPS origin without credentials, a path other than `/`, query, or fragment.
HTTP loopback origins are allowed only when `NODE_ENV=development`.

Both verification links and password-reset continuation links use this origin,
as does the email logo. Add the origin's domain to Firebase Authentication's
Authorized Domains for reset continuation URLs. The reset code still goes through
Firebase's configured hosted action handler. Existing EMAIL_FROM and RESEND_API_KEY
settings remain required. Missing/invalid APP_URL prevents email sending; the
forgot-password endpoint deliberately retains its generic response.

## Go-live blocker: R2 transaction verification is fail-closed

Live checkout runs on **Tranzila Hosted Fields** with a server-issued **Handshake V2**
token (`thtk`). The card is entered in Tranzila's own iframes (web: in-page; app: a
WebView on `/checkout/card-frame`), so card data never reaches GoLandly.

**Nothing a browser, an app or a Notify request says can create a voucher.** (The one exception by design is `TRANZILA_VERIFIER=response_hash`, where a signed charge response is accepted only after its hash verifies.) Settlement
(`lib/payments/settleVerifiedPayment.ts`, used by the webhook and `POST /api/payments/confirm`)
asks a `TranzilaTransactionVerifier` (`lib/payments/verifyTranzilaTransaction.ts`) what
Tranzila itself holds for the transaction, requires terminal, `ILS`, the order's frozen
`amountAgorot`, a standard charge and (when echoed) the order id to match, and only then
calls `claimOfferForOrder` with Tranzila's values.

**The active verifier is fail-closed** (`503`, nothing settled) until Tranzila confirms how
a transaction is looked up or how `response_hash` is built. Charging stays disabled
in practice until then. To go live, set `TRANZILA_VERIFIER` (see "R2 verifier modes" below) once Tranzila has confirmed
the reference binding or hash format; no code change. Do not weaken the gate to make
callbacks work.

**Notify is a trigger only** (`lib/payments/parseNotifyTrigger.ts`). Tranzila's docs do not
specify the Notify payload, so nothing in its body is required or trusted: the webhook needs
just the signed URL, then asks the verifier what Tranzila holds for the *order*
(`settleOrderById`, `byOrderId`). Until that lookup exists it answers 503 and Notify retries.

The notify URL handed to Hosted Fields carries a signed token (`?o=<orderId>&a=<amountAgorot>&t=<hmac>`,
`lib/payments/notifyToken.ts`) binding the call to the order, terminal and amount the
server froze (a changed `a` breaks the signature). It stops a client re-pointing Notify at another order or amount; it is NOT
proof Tranzila sent the request (the URL is visible to the member). The optional
`x-tranzila-webhook-secret` header is still accepted as an alternative gate.

Checkout flow: Pay (terms accepted) -> `/api/payments/initiate` returns `payment`
(`thtk` bound to the frozen amount, notify URL) -> Hosted Fields `charge` ->
the page/app calls `/api/payments/confirm` (order id only) while the order listener
moves the member on. `thtk` lasts 20 minutes; the client renews it 60 s early.
A thtk is requested at most 8 times per order (`orders/{id}/internal/handshakes`).

### R2 verifier modes (`TRANZILA_VERIFIER`)

Off by default: **`failclosed`** (also the value when unset, and always with no terminal) answers 503 and settles nothing.
Operators opt in only after Tranzila has confirmed the items below for the approved merchant number. Both modes are
implemented, unit-tested with mocked HTTP, and have never run against Tranzila.

| Mode | Where | Needs | What it checks |
| --- | --- | --- | --- |
| `reports` | `lib/payments/reportsVerifier.ts` (webhook trigger, `/confirm`) | `TRANZILA_ORDER_REF_FIELD` (the terminal's additional transaction field, by `api_parameter_name`, that carries our order id) | `POST {report host}/v1/transaction` (`transaction_index`, or a two-day date window plus `ufields` equals our order id), signed with the same four headers as the Handshake. Terminal (`child_terminal`), `ILS`, `tranmode` `A`, amount (decimal shekels), `000`, and the order id read back from the record must all match. A record with no reference answers 503: it is never settled. Two approvals for one order are a conflict (409). |
| `response_hash` | `lib/payments/responseHashVerifier.ts` (`/confirm` with the forwarded `chargeResponse`) | `TRANZILA_RESPONSE_HASH_SECRET`, and the canonical form registered with `setResponseHashCanonicalizer` | HMAC-SHA256 over the response without `response_hash`; then order id (from the signed `user_form_data.orderId`), amount, `ILS`, mode and `000`. With no canonical form registered it answers 503 (the docs do not say how the hash is assembled). The clients do not forward the response yet: wiring that, and sending `orderId` as an echoed form field, waits for questions 1, 4 and 5 below. |

**Reports rate limit.** `report.tranzila.com` allows 30 requests/s and 1,000/min per source IP; a breach blocks the IP for at least a minute
(429, `error_code` 20006, `Retry-After`; a non-JSON page also means blocked). The verifier keeps each process under 25/s and 900/min,
waits at most 2 s, then answers 503, and after a 429 it stops calling for `Retry-After` plus 60 s. Serverless instances share egress IPs, so
this is per-process only: keep confirmation polling modest. A repeat Notify for an already-paid order is acknowledged without any lookup.

`api.tranzila.com/v1/transactions` (by `transaction_index` or date range) is documented too but its response schema is not, and it has no
reference filter, so it is not used.

### Open questions for Tranzila (after Shva approves the terminal)

Only what `docs.tranzila.com` does not answer (checked against the Hosted Fields, Apple Pay, 3DS, Handshake V2, Authentication,
Notify, Response Codes and Reports pages):

1. **Reference binding (R2, `reports`).** Does a Hosted Fields charge store any merchant reference (`pdesc`, `contact`, the Handshake `request_params`, or an extra form field) in a report's `user_defined_N`? Under which name, and is the mapping set up under "Additional Fields for Transaction"?
2. **Identifier.** Is the Hosted Fields `transaction_id` the report `index`?
3. **Reports access.** Same key pair as the Handshake, or a separate enrollment? What does `v1/transactions` return, and is it exempt from the rate limit? Report latency after a charge? Values of `transtatus`, `telauthability`, `tranmode` (what a Hosted Fields debit reads as), and `child_terminal`; the unit of `amount` and the `currency` code.
4. **`response_hash` (R2).** Exact string that is hashed (order, separators, nesting, serialisation); HMAC or plain SHA-256; which secret, and what `requested_by_user` changes. Are echoed `user_form_data` fields inside the hash?
5. **Notify.** Payload, format and method for Hosted Fields; whether a terminal dashboard setting is needed (Notify Format, Return Method); whether it fires for declines and 3-D Secure failures; retry schedule; any signature or IP allowlist; whether the order reference is echoed.
6. **Handshake.** Can a `thtk` be reused after a decline (the app takes a fresh one after every decline, so it does not depend on this)? Where is `request_params` returned? Non-zero handshake error codes and the `912791` payload.
7. **Styling.** Which `styles` keys are honoured (font size, colour, padding; only `input`/`select` height and width are documented, and we send a 16px font to stop iOS zooming)? Which element gets `hosted-fields-valid` / `-invalid`? Meaning of `expiry.version`.
8. **Terminal.** Does our acquirer agreement require CVV and `card_holder_id_number` (we collect no ID)? Is the Token Module enabled? Which Apple Pay and Google Pay flags are on (support ticket `#512658609`)?
9. **Apple Pay.** The right `hfChargeApple` call form given "do NOT wrap it in your own function" and a sample that passes no arguments; which domains to register (production, `www`, the dev host) and whether the downloadable file is generic; which networks cover Israeli cards (`supported_network`); behaviour in `WKWebView` and the system in-app browser, and the "native app" path the legacy page mentions; the wallet response shape; the Chrome contradiction between the DirectNG and Apple Pay pages.
10. **Google Pay and 3-D Secure in WebViews.** Do Google Pay and the 3-D Secure challenge work in Android `WebView` and iOS `WKWebView`, and do any intents or hosts need allowing? What should `force_txn_on_3ds_fail` be for our terminal? How is a 3-D Secure failure signalled? How do we test with no sandbox (production only, small amounts)?
11. **CSP.** Which Tranzila hosts must be allowed if we add a Content-Security-Policy?

**A decline keeps the order open.** On a live terminal a declined attempt is stored as an audit
receipt (with its `responseCode`) and the order stays `pending`, its code still held, so the member
retries with another card or wallet on a fresh Handshake (`/api/payments/confirm` answers
`declined`). Only the dev sandbox keeps a decline final (`failed`).

## Apple Pay and Google Pay (express wallets)

Both ride the same Hosted Fields SDK, the same `thtk`, notify URL and server confirmation as the card.
A wallet button appears only when **both** the terminal flag is on and the device can use it
(`lib/payments/walletAvailability.ts`): Apple Pay needs `window.ApplePaySession` (Safari/iOS web),
Google Pay waits for the SDK's `googleIsEnable` event. With `TRANZILA_TERMINAL` unset (sandbox) there is
no live payment block, so no wallet button. Native WebViews offer Google Pay only if the SDK reports it
(WKWebView has no Apple Pay). Apple Pay also needs Tranzila's domain-association file served at
`/.well-known/apple-developer-merchantid-domain-association`: set its content in
`TRANZILA_APPLE_PAY_DOMAIN_ASSOCIATION` (per deployment; the route serves it as `application/octet-stream`, 404 when unset) and ask Tranzila to confirm each domain. Apple Pay can only be tested in production with small amounts, so Preview (`landly-dev`) cannot exercise it.

**3-D Secure cardholder inputs.** The signed-in member's display name and email go into `charge()` as `card_holder_name` and `card_holder_email` (card and Google Pay; Apple Pay's parameter list does not take them), sanitised by `sanitizeCardHolder` in `hostedFieldsProtocol.ts`. They go only to Tranzila's frame; they are not logged and not part of settlement.

## Payment sandbox (no gateway)

With no `TRANZILA_TERMINAL`, checkout runs against the `landly_sandbox` terminal
and offers "Simulate success / failure" instead of a card form (web and the Expo
app). Orders settle through the same `claimOfferForOrder` transaction the webhook
uses, so vouchers, pool codes and payout fields are real.

- Local `next dev`: on by default.
- Vercel Preview: on only with `PAYMENT_SANDBOX=1` **and** both
  `NEXT_PUBLIC_FIREBASE_PROJECT_ID` and `FIREBASE_ADMIN_PROJECT_ID` equal to
  `landly-dev`. A `landly-be752` or missing ID keeps it off.
- Vercel Production (`landly-be752`): never, whatever is set.
- Any environment with `TRANZILA_TERMINAL` set: off.

### Vercel environment checklist

| Variable | Preview (`landly-dev`) | Production (`landly-be752`) |
| --- | --- | --- |
| `PAYMENT_SANDBOX` | `1` | unset |
| `TRANZILA_TERMINAL` | unset (sandbox) | the live terminal |
| `NEXT_PUBLIC_FIREBASE_*` | `landly-dev` web config | `landly-be752` web config |
| `FIREBASE_ADMIN_PROJECT_ID` | `landly-dev` | `landly-be752` |
| `FIREBASE_ADMIN_CLIENT_EMAIL` / `FIREBASE_ADMIN_PRIVATE_KEY` | the `landly-dev` service account (`…@landly-dev.iam.gserviceaccount.com`) | the `landly-be752` one |
| `POOL_CODES_KEY` | own value; needed to settle Raayonit orders (not to start checkout) | own value |

`NEXT_PUBLIC_*`, `LANDLY_VERCEL` and `LANDLY_VERCEL_ENV` are inlined at build
time, so a changed value needs a new build, not just a redeploy of the old one.

When checkout shows "The service is unavailable right now", every 5xx looks
alike to the member; the cause is in Vercel Runtime Logs for
`/api/payments/initiate` ("Token verification unavailable", "Payment initiation
refused" or "Payment initiation failed", with the error text). Dry-run the
environment with `vercel env pull <file> --environment=preview` (outside the
repo; secret values come back masked) and
`node scripts/check-firebase-env.mjs --target=preview --env-file=<file>`.

Setting the Tranzila variables below switches to live Hosted Fields with no code change.
`lib/payments/tranzilaConfig.ts` validates them: all-or-nothing when `TRANZILA_TERMINAL` is set
(a missing credential is a 503, never a half-working checkout), `PAYMENT_SANDBOX=1` beside a live
terminal is a hard error, and a `NEXT_PUBLIC_TRANZILA_*` secret is refused.
Until Shva approves the merchant number, keep Preview and `.env.local` on `PAYMENT_SANDBOX=1`
with `TRANZILA_TERMINAL` unset.

| Variable | `.env.local` | Preview (`landly-dev`) | Production (`landly-be752`) |
| --- | --- | --- | --- |
| `TRANZILA_TERMINAL` | unset | unset (sandbox) | live terminal |
| `TRANZILA_API_APP_KEY` | unset | unset | Tranzila API app key |
| `TRANZILA_API_SECRET` | unset | unset | its secret (signs API calls; server only) |
| `TRANZILA_WEBHOOK_SECRET` | unset | unset | HMAC key for the notify token |
| `TRANZILA_NOTIFY_ORIGIN` | unset | optional (default: the deployment URL) | optional (default: `https://www.golandly.com`) |
| `TRANZILA_HANDSHAKE_URL` | unset | unset | optional override; https `tranzila.com` host only |
| `TRANZILA_VERIFIER` | unset | unset | `failclosed` until Tranzila confirms; then `reports` or `response_hash` |
| `TRANZILA_ORDER_REF_FIELD` | unset | unset | `reports` only: the order-reference field's `api_parameter_name` |
| `TRANZILA_REPORTS_URL` | unset | unset | optional override (https, tranzila.com host only) |
| `TRANZILA_RESPONSE_HASH_SECRET` | unset | unset | only for the `response_hash` mode |
| `TRANZILA_APPLE_PAY` / `TRANZILA_GOOGLE_PAY` | unset | unset | `1` only after Tranzila enables the wallet on the terminal |
| `TRANZILA_APPLE_PAY_DOMAIN_ASSOCIATION` | unset | unset | content of Tranzila's domain-association file |

## Other server secrets (both Firebase projects, separate values)

- `POOL_CODES_KEY`: 32 random bytes, base64. Encrypts Raayonit voucher codes (AES-256-GCM). Set it on both landly-dev and landly-be752.
- `BUSINESS_FINANCIALS_KEY`: 32 random bytes, base64. Encrypts merchants' bank details.
- `MASAV_INSTITUTION_CODE`: the bank-issued institution code. Unset, the payout file
  uses the fictitious test code `99999999` and is named `MASAV_MOCK_TEST_*`.

Rotation: set `<NAME>_ID` to a new id, put the new key in `<NAME>` and keep each
retired key in `<NAME>_<oldId>`. Generate with `openssl rand -base64 32`.

## Supported notification contract

Configure the iframe terminal for **POST** notifications with **QSTR** format
(`application/x-www-form-urlencoded`). Set these server environment variables:

- `TRANZILA_TERMINAL`: the exact terminal/supplier identifier.
- `TRANZILA_WEBHOOK_SECRET`: HMAC key for the signed notify token (and the optional header gate).

This section describes the legacy iframe payload (`lib/payments/parseTranzilaNotification.ts`). The Hosted Fields webhook does not use it: see "Notify is a trigger only" above.

The handler requires exactly one of each:

| Field | Contract |
| --- | --- |
| `Response` | Exact string `000` or `0` means approved. Other syntactically valid numeric response codes mean failure. |
| `index` | Required positive decimal transaction index; leading zeros normalized. |
| `supplier` | Must equal configured TRANZILA_TERMINAL and the order's terminal. |
| `sum` | Positive decimal amount with at most two fractional digits; compared in integer agorot. |
| `currency` | Exact string `1`, mapped to ILS and matched against the order. |
| `tranmode` | Exact string `A`, a standard charge. Verification, tokenization, refunds, and other modes are unsupported. |
| `orderId` | **Application-defined echoed custom field**, identifying the exact server-created order. Not a built-in provider field. |

If `transaction_id` is also present, it must identify the same transaction as
`index`. Duplicate critical fields and the old invented JSON `success` contract
are rejected. Bodies larger than 64 KiB are rejected. No order matching by amount,
email, or recent timestamp is permitted. No raw callback/card/token data is stored.

The Handshake binds the server-created orderId,
amount, currency, terminal, and transaction type to the provider transaction and
verify that the custom reference is returned unchanged. Confirm that rejected
payments include the required fields; incomplete failures cannot mutate an order.
Payments other than standard ILS iframe charges require a separately reviewed adapter.

Official references checked for this implementation:

- https://docs.tranzila.com/docs/vibe-coding/closing-an-order-in-base44-using-notify-page
  (POST, QSTR content type, exact approval codes, plain OK acknowledgement)
- https://docs.tranzila.com/docs/payments-and-billing/iframe-integration-directng
  (supplier, sum, currency, index/transaction_id, standard charge response)
- https://docs.tranzila.com/docs/payments-and-billing/iframe-integration
  (ILS currency 1, charge versus verification/tokenization modes)

## State and replay handling

Initiation transactionally creates `orders/{uid}_{offerId}` once with frozen
`amount`, `amountAgorot`, `currency`, `terminal`, and null settlement fields.
A pending order is returned unchanged, not repriced or restarted. Paid orders,
existing vouchers, failed orders, or inconsistent records return a conflict.
Failed orders are not automatically reopened. There is no second-attempt or
refund implementation in this change.

Successful settlement atomically writes:

1. Voucher (including its payment ledger reference).
2. Offer claimed count.
3. Business active-voucher count.
4. Order paid status, timestamp, provider transaction ID, and voucher reference.
5. `paymentTransactions/{sha256([terminal,index])}` deduplication record.

The new collection is server-only under the existing Firestore catch-all deny
rule. Retain ledger entries permanently alongside their payment records; deleting
one removes replay evidence. Exact consistent repeats return plain `OK` without
writes. Distinct orders cannot consume the same terminal/index. A different
transaction on a paid order, contradictory success/failure, or inconsistent ledger
returns 409, never overwriting the first settlement.

An identified decline records its ledger entry and failed order atomically without
a voucher or counter changes. A later contradictory success requires manual review.

Unavailable stock, an expired/deleted offer, or a missing business cannot fulfill
a successful charge. The handler preserves existing records and returns a
reconciliation error. There is **no automatic refund, stock reservation, or durable
reconciliation queue**. Monitor non-2xx callbacks and the minimal settlement-error
logs (order ID, terminal, transaction ID, reason), reconcile against Tranzila's
transaction records, and resolve paid-but-unfulfilled charges manually. Transport
or commit failures return 503 so they can be retried safely. Never reset a pending
order merely because it is old: a payment notification could still arrive.

## Existing records and rollout

Old orders lack the new frozen terminal/amount fields, and old paid orders lack
transaction-ledger evidence. They are intentionally rejected rather than silently
backfilled from an untrusted callback. Review and reconcile existing orders before
activating the new callback contract; do not delete pending/failed records or infer
successful payments from vouchers alone. There is no automatic data migration.

## Tests

- `npm test`: unit tests, including deterministic conflicting transactions,
  injected rollback and lost-response scenarios, route/authentication behavior,
  strict notification parsing, and both email flows.
- `npm run test:emulator`: Firestore Emulator integration tests, fixed demo project
  `demo-landly-payments` at `127.0.0.1:8787`. Requires Java 21+ on PATH. Tests fail
  rather than skip if the expected emulator is absent. They never use .env service
  credentials. The suite clears only its isolated demo-project test collections.
- `npm run typecheck`
- `npm run build`

The unit transaction double provides deterministic scheduling and failure injection;
the emulator tests independently verify real SDK transactions, concurrent callbacks,
concurrent initiation, transaction-ID contention, retries, and atomic rollback.

## Email and phone change verification (profile screens)

Email changes from `/profile` (web) and the app's Profile tab (email+password
accounts; a Google account's address is its Google identity) are confirmed by a
6-digit code sent to the **new** address through the same Resend pipeline
(`APP_URL`, `EMAIL_FROM`, `RESEND_API_KEY`) and typed into the same code dialog
(web) or sheet (app) as a phone code. Only the code's salted hash is stored, in
the server-only `emailChangeRequests/{uid}`, with the phone code's rules: it
expires after 10 minutes, five wrong tries clear the change, and a new code can
be sent once a minute. Once confirmed, the account's email changes in Firebase
Auth and Firestore and the previous address receives a security notice.

Phone changes from the profile screens are confirmed by a 6-digit code
(`lib/auth/phoneVerification.ts`). GoLandly generates, salts-and-hashes,
rate-limits and verifies the code itself (`phoneVerifications/{uid}`); **019**
(019sms.co.il) only delivers it (`lib/otp/gateway019.ts`). The number decides
the channel (`lib/auth/otpChannel.ts`, enforced by `/api/account/change-phone`;
a channel sent by a client is ignored): `+972` / `972…` numbers get an **SMS**,
every other country a **WhatsApp** message built on one of 019's pre-approved
Meta templates, so GoLandly needs no Meta Business Verification of its own. The
website and the app show "via SMS" or "via WhatsApp" copy accordingly, in all
five languages. Server-side settings (the same names in `.env.local`, and in
Vercel for **both** `landly-dev` and `landly-be752`; `.env.example` lists them):

| Variable | Purpose |
| --- | --- |
| `PHONE_VERIFICATION_ENABLED` | `true` turns verification on in production. Off (the default) saves phone edits directly, as before. In development it is on unless set to `false`. The older name `FIREBASE_PHONE_AUTH_ENABLED` is still read when this one is unset. |
| `SMS_019_USERNAME` | The 019 account's user name. |
| `SMS_019_TOKEN` | A 019 API token (Settings > API Token Management in 019's web UI), sent as `Authorization: Bearer`. It expires on a fixed date: rotate it before then, and use a separate token for DEV and PROD. |
| `SMS_019_SENDER` | The verified alphanumeric sender on the SMS (at most 11 letters/digits), `GoLandly`. WhatsApp codes go from 019's own business line, so no sender is sent. |
| `OTP_019_LIVE` | Optional. `true` sends real messages outside production; otherwise the code is only logged to the `next dev` terminal. Production always sends once the settings above are complete. |

Without a complete 019 configuration nothing is sent and nobody is blocked: in
development the code is logged (`[phone-otp] simulated SMS|WhatsApp to +33
•••• 5678: code 123456`), and in production phone edits save directly while the
server logs the missing setting. 019's endpoints, auth header and request
bodies live in `lib/otp/gateway019Contract.ts` (marked `TODO(019 docs)`); until
its two endpoints are filled in from 019's documentation the gateway reports
itself unconfigured, so pasting credentials early cannot send a half-formed
request. A failed send leaves nothing pending: the member sees "We couldn't
send the code…" on the profile screen, and a failed *Resend* closes the code
dialog or sheet too, since the code sent before is no longer valid. Failures
are logged as a class only (`auth`, `rejected`, `unavailable`, `network`,
`not_configured`), never with credentials, the code or the whole number.
Onboarding and sign-up still save the phone directly.

The `WHATSAPP_*` variables below belong to the support bot (Meta Cloud API) and
no longer play any part in phone verification.

## WhatsApp support bot

`app/api/webhooks/whatsapp/route.ts` receives messages sent to the WhatsApp
Cloud API number. Any message is answered with three reply buttons (Member
Perks, GoLandly Pass, Talk to Team), at most once every 10 minutes per number.
Perks and Pass reply with a link button to `{APP_URL}/categories` and
`{APP_URL}/member`. Talk to Team emails the team inbox (`SUPPORT_EMAIL`) with
the sender's name, member UID, email, language and a `wa.me` link to answer
them, then keeps the bot silent for that number for 24 hours. The bot answers
in the member's profile language, else Hebrew for `+972` numbers and English
for the rest.

| Variable | Purpose |
| --- | --- |
| `WHATSAPP_VERIFY_TOKEN` | Any random string; enter the same value as the webhook's *Verify token* in the Meta developer dashboard. |
| `WHATSAPP_APP_SECRET` | The Meta app's *App secret* (App settings → Basic). Every POST's `x-hub-signature-256` is checked against it; without it the webhook refuses all deliveries. |

Setup in the Meta developer dashboard: WhatsApp → Configuration → Webhook,
callback URL `{APP_URL}/api/webhooks/whatsapp`, then subscribe to the
`messages` field. Bot state lives in the server-only `whatsappConversations`
and `whatsappInbound` collections. `firebase.indexes.json` declares the
Firestore TTL policies: `whatsappInbound.expiresAt` (seen message ids, 7 days),
and `whatsappConversations.expiresAt` and the `messages` collection group's
`expiresAt` (chats and transcripts, 180 days after the latest message). TTL
policies are per project, so deploy them to both, then backfill conversations
written before `expiresAt` existed:

```
firebase deploy --only firestore:indexes --project landly-dev
firebase deploy --only firestore:indexes --project landly-be752
node scripts/whatsapp-backfill-expiry.mjs --project <projectId>            # dry run
node scripts/whatsapp-backfill-expiry.mjs --project <projectId> --apply
```

Idle check-ins: when the bot spoke last and the member has been quiet for
`WHATSAPP_IDLE_MINUTES` (20–30, default 25), the bot asks once whether they
still need help; with no answer 30 minutes later the conversation is resolved
silently. Vercel Cron (`vercel.json`, every 5 minutes, Production only) calls
`/api/cron/whatsapp-idle`, which also deletes chats more than 3 days past
their `expiresAt` in case a TTL policy is missing.

| Variable | Value |
| --- | --- |
| `CRON_SECRET` | A random string of at least 16 characters, set on Production (Vercel sends it as `Authorization: Bearer …`) and on any Preview you sweep by hand. Without it the route answers 503. |
| `WHATSAPP_IDLE_MINUTES` | Optional, 20–30 (default 25). |

Vercel Cron never runs on Preview or locally, so sweep landly-dev by hand
against a local `next dev` or a Preview deployment (`--url`; a protected
Preview also needs `VERCEL_AUTOMATION_BYPASS_SECRET`):

```
CRON_SECRET=… node scripts/whatsapp-idle-sweep.mjs
CRON_SECRET=… node scripts/whatsapp-idle-sweep.mjs --url https://<preview>.vercel.app
```

The bot answers from the number the member wrote to (the delivery's
`metadata.phone_number_id`), whichever number on the business account it is,
so a stale `WHATSAPP_PHONE_NUMBER_ID` doesn't stop it: a message to another
number is answered and logged as `[whatsapp-webhook] Ingesting message for
phone ID: … (configured env: …)`. That includes the OTP number if it is a
different line, so a member replying to a code gets the menu. Every delivery logs one
`[whatsapp-webhook] Received …` line (event count, receiving number ID, masked
senders); a bad signature logs an error before its 401, and each live reply
logs `[whatsapp-bot] sent …`. No `Received` line for a real message means Meta
never delivered it: check that the WhatsApp Business Account is subscribed to
the app (`GET /{WABA_ID}/subscribed_apps`), that the `messages` webhook field
is subscribed, and that the app is in Live mode. The dashboard's *Test*
button proves none of these: it only shows that the callback URL and app
secret work.

To let the bot answer a test number again at once (clears the 10-minute menu
throttle and the 24-hour silence after Talk to Team):

```
node scripts/whatsapp-reset-conversation.mjs --project <projectId> --number=+9725XXXXXXXX          # dry run
node scripts/whatsapp-reset-conversation.mjs --project <projectId> --number=+9725XXXXXXXX --apply
```

## Monthly Usage & Costs email and the live USD/ILS rate

On the 1st of every month at 05:00 UTC (08:00 in Israel) Vercel Cron
(`vercel.json`, Production only) calls `/api/cron/monthly-costs-report`, which
emails the Usage & Costs summary of the month that just ended (UTC) to
`COSTS_REPORT_EMAIL` (default `contact@golandly.com`) through Resend: an HTML
table (net, 18% VAT and total in shekels per service) and the attachment
`golandly-costs-YYYY-MM.csv` (UTF-8 BOM, opens in Excel). A lock document
`system_config/monthly_costs_report_YYYY-MM` makes a retried or duplicated
trigger send once. `/admin/system/costs` has a "Send monthly report to email"
button that sends any month on demand (no lock, one send per 30 s).

| Variable | DEV (`landly-dev`) | PROD (`landly-be752`) |
| --- | --- | --- |
| `CRON_SECRET` | Only to run the route by hand against a local or Preview deployment. | Required (Vercel Cron sends it as a bearer token); without it the route answers 503. |
| `RESEND_API_KEY`, `EMAIL_FROM` | Optional: DEV never emails the report, it is simulated and counted as `resend.simulated`. | Required, with `EMAIL_FROM` a verified Resend sender. |
| `COSTS_REPORT_EMAIL` | Not used. | Optional recipient, default `contact@golandly.com`. |

Dollar prices (Google) are converted at a live USD/ILS rate: the Bank of
Israel representative rate, then Frankfurter, cached 12 hours in memory and in
`system_config/usd_ils_rate` of each environment's own Firebase project; if
both fail the last stored rate is used, and 3.70 only if none was ever stored.
The page and the email show the rate and its date. `firestore.rules` denies
clients the whole `system_config` collection; deploy the rules to both
projects (DEV and PROD) after review.

### Fixed subscriptions and Tranzila in Usage & Costs

`/admin/system/costs` and the monthly email also list the flat plan fees and
platform tiers, so the totals cover the whole month's outlay (metered APIs,
fixed subscriptions, and both together, each with 18% VAT):

- **Vercel Pro** defaults to $20 a month, converted at the live USD/ILS rate and
  counted in every month. Edit the amount, currency or on/off on the page; it is
  saved (and audited) in `system_config/fixed_subscriptions` of that environment's
  Firebase project, so DEV and PROD each keep their own. Label: plan fee only,
  overages are not metered. Apple Developer, Google Play and the domain are not
  monthly costs and are left out.
- **Resend** shows the month's emails against the 3,000 free ones; past that the
  extra emails are billed in the metered Resend line, not twice.
- **Tranzila** shows "not configured" and ₪0.00 while `TRANZILA_TERMINAL` is
  unset. Once it is set, the month's paid orders (sandbox ones excluded) are
  counted and the fee is `TRANZILA_FEE` in `lib/usage/pricing.ts`
  (`perTransactionIls` plus `percent` of the volume), both 0 until the contracted
  rates are put in that file. This reads `orders` by `status` and `paidAt`, which
  needs the index added to `firebase.indexes.json`:

```
firebase deploy --only firestore:indexes --project landly-dev
firebase deploy --only firestore:indexes --project landly-be752
```

Until the index is built the Tranzila row says the orders could not be read
(its fee shows as zero) instead of failing the page. Deploy `firestore.rules`
the same way if the `system_config` rule from the monthly report is not live yet.

## Raayonit vouchers: DEV and PROD parity

Raayonit "Tav Al" vouchers are stored in the existing `couponPools` collection as shared stocks
(`kind: 'shared'`, `provider: 'raayonit'`), so there is no new collection, no new Firestore rule
(clients are already denied) and no new index. What has to match between `landly-dev` and `landly-be752`:

- `POOL_CODES_KEY` set in both environments (separate keys are fine; a code encrypted with one key can only be read with it).
- The Raayonit logo at `public/images/partners/raayonit-logo.png` and `landly-mobile/assets/images/raayonit-logo.png`.
- Create the stocks (one per voucher value, e.g. 100 for 89, 150 for 132 and 200 for 174) on Stock & Vouchers in each environment, then add the codes from Raayonit's Excel file there. Codes are never copied between environments.

## Raayonit daily diff sync (`VoucherNum=253`)

Every day at 04:00 Israel time, `/api/cron/raayonit-sync` reads Raayonit's "תו על" directory
(`https://www.raayonit.co.il/Site/he/pages/inPage.asp?catID=3&MainCatNum=8&TopCatNum=22&CatNum=23&VoucherNum=253`,
server-rendered UTF-8 HTML) and applies **only the difference** to the Raayonit offers (`lib/inventory/raayonitDailySync.ts`):

| Raayonit page vs our cards | What is written |
| --- | --- |
| Unchanged (almost every run) | Nothing: no offer write, no translation call. Only the day's log document. |
| New partner with a category rule, an official name (`raayonitBrandNames.ts`) and a bundled image | A live card (`published: true`, `raayonitSyncPending: false`), fine print translated once. |
| New partner any of those is missing for | A staged draft (`published: false`, `raayonitSyncPending: true`, `pendingSince`). It reaches no member until approved in Admin > Inventory > Raayonit cards ("Pending review"). Rejecting keeps it hidden and the daily sync never stages it again. |
| Partner no longer listed | Soft-archived: `published: false`, `archivedReason: 'removed_from_raayonit_catalog'`, `archivedAt`, `archivedSourceKey`, `sourceKey: 'retired:{id}'`. Never deleted, so vouchers and orders keep working. |
| Archived partner listed again | The same card is reactivated. |

`published: false` is the one flag every reader already honours (`/api/public/offers`, `publicOfferData`, the offer page, the web
and the native app), so a staged or archived card cannot reach a member.

**Safety guards** (a run that trips one writes no offer, logs `aborted_guard` and emails the admin): the page must answer
`text/html` and mention `תו על`; at least 5 sections, 150 listing rows and 150 brands; no more than
`min(15, 10% of the active cards)` archived and 25 added in one run. The admin's "Apply anyway" (`force`) overrides the size guards after a preview.

Every run is logged in `raayonit_sync_logs/{YYYY-MM-DD}` (Asia/Jerusalem day; Admin SDK only, `firestore.rules` denies clients).
That document is also the daily lock: a day that already succeeded is not run again.

Schedule: Vercel Cron is UTC only, so `vercel.json` fires at `0 1 * * *` and `0 2 * * *`; the route runs the one that is
04:00 in Asia/Jerusalem (winter UTC+2, summer UTC+3) and answers `{ "skipped": "wrong-hour" }` to the other.

| Variable / step | DEV (`landly-dev`) | PROD (`landly-be752`) |
| --- | --- | --- |
| `CRON_SECRET` (16+ characters) | Only to call the route by hand. Vercel Cron does not run on Preview or locally. | Required on Vercel Production; without it the route answers 503. |
| Firebase credentials | The DEV service account (or ADC) | The PROD service account |
| Deploy `firestore.rules` | `firebase deploy --only firestore --project landly-dev` | `firebase deploy --only firestore --project landly-be752` |
| `RESEND_API_KEY`, `EMAIL_FROM`, `COSTS_REPORT_EMAIL` | Not needed: the alert is simulated (`resend.simulated`). | The alert goes to `COSTS_REPORT_EMAIL` (default `contact@golandly.com`), only when a guard stopped the run, the run failed, or a partner needs review. |
| `LANDLY_TRANSLATION_ENABLED=true` | Optional | Needed for the one-time translation of a new partner's fine print |

Run it by hand (no new index is needed):

```
# preview against a local or Preview deployment (any hour)
curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron/raayonit-sync?dry=1"

# CLI (same code); --dry writes nothing. A live run is refused unless the project is landly-dev or --allow-prod is passed.
npx esbuild scripts/raayonit-daily-sync.mts --bundle --platform=node --format=esm --external:firebase-admin --external:sharp --external:resend \
  --alias:@=. --alias:server-only=./scripts/lib/emptyModule.mjs --alias:next/server=./scripts/lib/nextServerStub.mjs --outfile=$TMPDIR/daily.mjs
node $TMPDIR/daily.mjs --project landly-dev --dry
node $TMPDIR/daily.mjs --project landly-dev
```

Admin > Inventory > Raayonit cards has the same flow: "Run sync now" previews the difference (nothing is written), then
"Confirm and apply" writes it.
