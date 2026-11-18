// Dev/ops: geocodes each single-location Raayonit brand's street address once (Google Geocoding, Hebrew, Israel only) into
// lib/inventory/raayonitVenueGeo.json, so the sync can give those offers coordinates ("Near me", distance on the card).
// Only a precise hit is kept (a street number, ROOFTOP or RANGE_INTERPOLATED, no partial match, inside Israel): a city-only
// address would drop the pin at the city centre, so it gets no coordinates. Re-runs reuse what is already in the file.
// Run: npx esbuild scripts/raayonit-geo.mts --bundle --platform=node --format=esm --external:firebase-admin --external:sharp --alias:@=. --alias:server-only=./scripts/lib/emptyModule.mjs --banner:js="import {createRequire as __cr} from 'module'; const require=__cr(import.meta.url); const __dirname=import.meta.dirname;" --outfile=.geo-tmp.mjs && node --env-file=.env.local .geo-tmp.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { bundledCatalog } from '../lib/inventory/raayonitCatalogSync'

const KEY = process.env.GOOGLE_MAPS_SERVER_API_KEY
if (!KEY) { console.error('GOOGLE_MAPS_SERVER_API_KEY missing'); process.exit(1) }
const OUT = 'lib/inventory/raayonitVenueGeo.json'
const cache: Record<string, { lat: number; lng: number } | null> = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {}
let calls = 0, kept = 0, skipped = 0
for (const b of bundledCatalog()) {
  if (b.branches.length !== 1 || b.key in cache) continue
  const br = b.branches[0]!
  const addr = [br.address, br.city && !br.address.includes(br.city) ? br.city : ''].filter(Boolean).join(', ')
  if (!/\d/.test(addr)) { cache[b.key] = null; skipped++; continue }
  calls++
  const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addr)}&region=il&language=he&components=country:IL&key=${KEY}`)
  const json = (await res.json()) as { status: string; results?: { partial_match?: boolean; geometry: { location: { lat: number; lng: number }; location_type: string } }[] }
  const r = json.results?.[0]
  const ok = json.status === 'OK' && r && !r.partial_match && ['ROOFTOP', 'RANGE_INTERPOLATED'].includes(r.geometry.location_type) && r.geometry.location.lat > 29 && r.geometry.location.lat < 34 && r.geometry.location.lng > 34 && r.geometry.location.lng < 36
  cache[b.key] = ok ? { lat: Math.round(r!.geometry.location.lat * 1e6) / 1e6, lng: Math.round(r!.geometry.location.lng * 1e6) / 1e6 } : null
  ok ? kept++ : skipped++
}
writeFileSync(OUT, JSON.stringify(cache, null, 1) + '\n')
console.log(JSON.stringify({ calls, kept, skipped, total: Object.keys(cache).length }))
