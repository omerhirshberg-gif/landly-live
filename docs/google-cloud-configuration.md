# Google Cloud configuration

Landly runs two Firebase/GCP projects with billing enabled:

| Environment | Firebase project | Where it runs |
|---|---|---|
| DEV | `landly-dev` | local `next dev` (`.env.local`), Vercel **Preview**, Expo development |
| PROD | `landly-be752` | Vercel **Production**, Expo release builds |

This page covers the cloud features added on top of Auth/Firestore: dynamic
content translation, address autocomplete and reverse geocoding, offer
banner uploads, and the push-notification schema. Every Google call is made
**from the server**: no Google API key ships in the website bundle or the app.

## 1. APIs to enable (each project)

Cloud Console → APIs & Services → Library:

- **Cloud Translation API** (offer translation, `lib/translate/cloudTranslate.ts`)
- **Places API (New)** (admin address autocomplete, `lib/maps/googleMaps.ts`)
- **Geocoding API** ("Perks near Tel Aviv", `app/api/geo/reverse`)
- **Cloud Storage for Firebase** (already on: avatars, now offer banners)

Later, for push (schema only today, `lib/push/pushTokens.ts`):
**Firebase Cloud Messaging API (V1)**.

## 2. IAM

The Firebase Admin service account in `FIREBASE_ADMIN_CLIENT_EMAIL` already
authorizes Firestore, Auth and Storage. Translation reuses it (an OAuth token
with the `cloud-platform` scope; no API key). Grant it, in each project:

- **Cloud Translation API User** (`roles/cloudtranslate.user`)

## 3. API key for Maps (server only)

Create one key per project: Credentials → Create credentials → API key.

- **API restrictions:** Places API (New) and Geocoding API only.
- **Application restrictions:** none. Vercel's outbound IPs aren't fixed, so
  the key can't be IP-locked; it never leaves the server, and the quotas below
  cap it.
- Store it as `GOOGLE_MAPS_SERVER_API_KEY` (never `NEXT_PUBLIC_…`).

## 4. Environment variables

Vercel → Settings → Environment Variables. Use **Preview** for DEV values and
**Production** for PROD values; put DEV values in `.env.local` for local work.

| Variable | Scope | DEV (`landly-dev`) | PROD (`landly-be752`) | Notes |
|---|---|---|---|---|
| `LANDLY_TRANSLATION_ENABLED` | server | `true` | `true` | Anything else: offers save untranslated, the admin sees a warning |
| `GOOGLE_TRANSLATE_LOCATION` | server | `global` | `global` | Must be the glossary's region if a glossary is used |
| `GOOGLE_TRANSLATE_GLOSSARY` | server | optional | optional | `projects/<id>/locations/<region>/glossaries/<name>`: keeps "Landly", "olim", "Tzav Rishon" and similar as written |
| `GOOGLE_MAPS_SERVER_API_KEY` | server | DEV key | PROD key | Unset: the admin address field saves free text, "Near me" shows no city name |
| `CORS_ALLOWED_ORIGINS` | server | existing | existing | Already used; `/api/geo/reverse` answers the Expo web build through it |

Nothing new is needed in the Expo app: it calls `/api/geo/reverse` on
`API_BASE_URL` like its other API calls.

Reserved for the push branch (not read by any code yet):
`NEXT_PUBLIC_FIREBASE_VAPID_KEY` (web push), and `extra.eas.projectId` in
`landly-mobile/app.json` (Expo push tokens).

Check what each build would use (never prints secrets):

```sh
node scripts/check-firebase-env.mjs
vercel env pull .env.vercel.preview --environment=preview
node scripts/check-firebase-env.mjs --target=preview --env-file=.env.vercel.preview
```

## 5. Quotas and budget (cost safety)

Cloud Console → APIs & Services → each API → Quotas, per project:

| API | Suggested daily cap (PROD) | Why |
|---|---|---|
| Places API (New): Autocomplete requests | 2,000 | Admin-only, debounced, one session per address |
| Places API (New): Place Details (Essentials) | 500 | Five per picked or refreshed address (one per language) |
| Geocoding API | 2,000 | Cached 30 days per ~1 km cell and language |
| Cloud Translation: characters | 500,000 | Only changed fields of saved offers, and changed Hebrew business names, are sent |

DEV can use a tenth of these. Add a **budget alert** (Billing → Budgets &
alerts) per project, e.g. $20/month with alerts at 50/90/100%.

## 6. Firestore and Storage

Deploy the rules after pulling this change:

```sh
firebase deploy --only firestore:rules,storage -P dev
firebase deploy --only firestore:rules,storage -P default
```

- `storage.rules`: `banners/{file}` is public-read and has no client writes
  (uploads go through `/api/admin/uploads` with the Admin SDK).
- `firestore.rules`: `geoCache/{cell}` and `apiUsageStats/{month}` are
  server-only; `users/{uid}/pushTokens/{id}` is owner-managed (schema for the
  push branch).
- **TTL policy** for the reverse-geocode cache: Firestore → TTL → collection
  group `geoCache`, field `expiresAt`. Without it, expired entries are simply
  refreshed on their next read.

## 7. Data model added

- `offers/{id}.translations`: `{ sourceLang, fields: { <lang>: { <field>: { text, sourceHash, machine } } } }`
  for `title`, `description`, `redemptionTerms`, `redemptionInstructions`.
  Copied onto `orders` and `vouchers` at purchase.
- `businesses/{uid}.translations`: the business name in the same shape, field
  `businessName`. Only a name in Hebrew letters is machine-translated; a
  Latin-script brand stays as written unless the admin writes their own wording.
  Copied onto its offers as `offers/{id}.businessTranslations`, and onto
  `orders`/`vouchers` at purchase.
- `businesses/{uid}.address`: `{ placeId, formatted, short, city, lat, lng, fetchedAt }`,
  where `formatted` (full address), `short` (street and city, Places
  `shortFormattedAddress`) and `city` are `{ en, he, ru, es, fr }` as Google
  writes them in each language (never machine-translated), and `fetchedAt` is
  an ISO date.
- `offers/{id}.geo` `{lat,lng}`, `offers/{id}.city` and `offers/{id}.address`
  `{ placeId, formatted, short }`: copied from the business (create, business
  edit, refresh), for cards, the offer page's address and navigation buttons,
  and "Near me". Orders and vouchers keep `businessAddress`/`businessGeo` as at purchase.
- `offers/{id}.imageUrl`: may now be a `banners/…` Storage download URL.
- `apiUsageStats/{YYYY-MM}` (UTC month): API usage counters for Admin → **Usage
  & Costs** (`/admin/system/costs`), added with `FieldValue.increment` after each
  successful metered call (`lib/usage/recordUsage.ts`): Cloud Translation
  characters (detection included), Places Autocomplete and Details requests,
  Geocoding requests, WhatsApp inbound messages, service replies, accepted OTP
  templates and simulated sends, each also under `daily.{DD}`. Units only: the
  dashboard prices them with `lib/usage/pricing.ts` (free tiers, Essentials
  bands, USD → ILS rate), so update the prices there when Google or Meta change
  them. A failed counter write is logged and never fails the call it measures.
  Firestore and Storage are not metered; compare against the Firebase console.

## 9. Usage & Costs across both projects

`/admin/system/costs` shows PROD, DEV or both combined (`?view=combined|prod|dev`).
The projects share one billing account, so **Combined** adds their units and
prices them once against one free allowance (the actual bill). No PROD
credential ever leaves Vercel Production (`lib/usage/peerGuard.ts`):

| Dashboard on | Its own counters | The other environment's |
|---|---|---|
| Vercel Production | its Admin SDK | landly-dev, read with a read-only reader service account |
| Local / Vercel Preview | its Admin SDK | PROD's `/api/usage/export`, with `USAGE_EXPORT_TOKEN` |

Until both are set up, the missing side shows as *not configured* and the
Combined total is marked partial.

**Read-only reader for landly-dev** (Vercel Production only):

```sh
gcloud iam roles create usageReader --project=landly-dev --title="Usage Reader" \
  --permissions=datastore.entities.get,datastore.entities.list,datastore.databases.getMetadata
gcloud iam service-accounts create usage-reader --project=landly-dev --display-name="Usage dashboard reader"
gcloud projects add-iam-policy-binding landly-dev \
  --member=serviceAccount:usage-reader@landly-dev.iam.gserviceaccount.com --role=projects/landly-dev/roles/usageReader
gcloud iam service-accounts keys create usage-reader.json --iam-account=usage-reader@landly-dev.iam.gserviceaccount.com
```

Then in Vercel → Settings → Environment Variables, **Production only**:
`USAGE_DEV_READER_CLIENT_EMAIL` (the key's `client_email`) and
`USAGE_DEV_READER_PRIVATE_KEY` (its `private_key`, `\n` escapes kept). Delete
`usage-reader.json` afterwards. The role can't write, and IAM can't narrow it
to one collection, which is why this key never goes to DEV deployments.

**Export token** (the same value everywhere): generate one with
`openssl rand -hex 32` and set `USAGE_EXPORT_TOKEN` in Vercel Production,
Vercel Preview and `.env.local`. Production answers `/api/usage/export` only
when it's set (and only on Vercel Production); elsewhere the token is just
what's sent. It reads the month's counters and nothing else.
`USAGE_PROD_EXPORT_URL` (https) overrides `https://www.golandly.com` if needed.

## 8. Backfill after deploying

- **Translations:** Admin → Offers → **Translate missing**. It translates offers
  saved before this feature, keeps manual translations, and costs nothing for
  offers already up to date.
- **Business names and addresses:** Admin → Businesses → **Refresh addresses
  and translate names**. It translates Hebrew business names, fetches every
  picked address again in all five languages, and copies both onto the
  businesses' offers. Run it again now and then: Google's terms limit how long
  Places content may be kept, so addresses older than 30 days are fetched
  again (only the place id is kept indefinitely). Businesses already up to
  date cost nothing.
- **Coordinates:** Admin → each business → **Edit details** → pick the address
  from the suggestions. A business shows "Not on the map" until then, and its
  offers don't appear under Nearby.
