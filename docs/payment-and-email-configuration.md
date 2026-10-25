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

## Go-live blocker: notification authentication is not yet provider-verified

**The custom `x-tranzila-webhook-secret` header is an application-specific gate,
NOT a confirmed Tranzila notification authentication mechanism.** It is retained
with timing-safe comparison and fails closed if missing or misconfigured.

Before enabling real payments, the owner must verify actual notification transport
and authentication with **Tranzila support or the terminal documentation**, and
complete an end-to-end sandbox payment. The QSTR parser and local transaction tests
do not prove sender authenticity or that Tranzila will send this header. Do not
remove the gate to make callbacks work, expose its value in the iframe/client, or
mistake outbound API HMAC authentication for an inbound webhook signature.

The payment widget remains a placeholder; this change does not enable charging.

## Supported notification contract

Configure the iframe terminal for **POST** notifications with **QSTR** format
(`application/x-www-form-urlencoded`). Set these server environment variables:

- `TRANZILA_TERMINAL`: the exact terminal/supplier identifier.
- `TRANZILA_WEBHOOK_SECRET`: the existing application-specific secret described above.

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

The future iframe/handshake integration must bind the server-created orderId,
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

Phone changes from the profile screens are confirmed by a 6-digit code sent via
WhatsApp (`lib/auth/phoneVerification.ts`). Server-side settings:

| Variable | Purpose |
| --- | --- |
| `PHONE_VERIFICATION_ENABLED` | `true` turns verification on in production. Off (the default) saves phone edits directly, as before. In development it is on unless set to `false`. The older name `FIREBASE_PHONE_AUTH_ENABLED` is still read when this one is unset. |
| `WHATSAPP_ACCESS_TOKEN` | Meta WhatsApp Cloud API token. Use a permanent System User token; temporary tokens expire after 24 hours. |
| `WHATSAPP_PHONE_NUMBER_ID` | The sending number's ID in WhatsApp Manager. |
| `WHATSAPP_OTP_TEMPLATE` | Name of the approved *authentication* template (copy-code button). Defaults to `landly_otp_code`. See the template checklist below. |
| `WHATSAPP_OTP_FALLBACK_LANGUAGE` | Optional. A language code tried right after the member's own when their copy is missing (for example `en_GB`); `en_US` and then `en` follow anyway. |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Optional, read only by `scripts/whatsapp-diagnose-templates.mjs`: the WhatsApp Business Account (WABA) that owns the number. Without it the script finds the WABA through the token. |
| `WHATSAPP_OTP_LIVE` | Optional. `true` sends real WhatsApp messages outside production (codes and bot replies); otherwise they are only logged to the `next dev` terminal. |
| `WHATSAPP_GRAPH_VERSION` | Optional, defaults to `v21.0` (supported until about January 2027). A value not shaped like `v25.0` is ignored. |

If the flag is on but the token or number ID is missing, phone edits save
directly and the server logs the missing setting, so members are never left
with a banner that cannot clear. Onboarding and sign-up still save the phone
directly.

Meta matches a template's language code exactly: a copy created as `en_US`
(WhatsApp Manager's default English) is not found when `en` is asked for, and
the send fails with **132001** ("Template name does not exist in the
translation"). The code is therefore tried in up to three languages, in this
order, without repeats: the member's (`en_US` for English, `he`, `ru`, `fr`,
`es`), `WHATSAPP_OTP_FALLBACK_LANGUAGE` if set, `en_US`, `en`. Only 132001
moves on to the next language; any other refusal (132000 parameter count,
132012 parameter format, 132015/132016 paused or disabled, 131xxx) is the
template or the number itself, so it fails at once. When every language
answers 132001 the server logs a hint naming the template and number ID: the
template is then missing from the WABA that owns `WHATSAPP_PHONE_NUMBER_ID`
(often a production number in another WABA than dev's, or a different
`WHATSAPP_OTP_TEMPLATE` in Vercel). A failed send leaves nothing pending: the
member sees "We couldn't send the code by WhatsApp…" on the profile screen,
and a failed *Resend* closes the code dialog or sheet too, since the code sent
before is no longer valid.

Template checklist, in **each** WABA (`landly-dev`'s and `landly-be752`'s
sending numbers):

- Name: exactly `WHATSAPP_OTP_TEMPLATE` for that environment (default `landly_otp_code`).
- Category **Authentication**, with a **Copy code** button (the code fills both the body and the button).
- Languages: `en_US` (required, the fallback every member ends on), plus `he`, `ru`, `fr`, `es`; each **Approved**, none paused.
- In the same WABA as that environment's `WHATSAPP_PHONE_NUMBER_ID`.

Check one environment at a time; the script only reads from the Graph API and
exits 1 when a member language would get no code:

```
node --env-file=.env.local scripts/whatsapp-diagnose-templates.mjs                # landly-dev
vercel env pull .env.production.local --environment=production
node --env-file=.env.production.local scripts/whatsapp-diagnose-templates.mjs     # landly-be752
```

## WhatsApp support bot

`app/api/webhooks/whatsapp/route.ts` receives messages sent to the WhatsApp
Cloud API number. Any message is answered with three reply buttons (Member
Perks, Landly Pass, Talk to Team), at most once every 10 minutes per number.
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
