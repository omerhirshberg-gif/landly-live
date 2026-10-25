// Runs the WhatsApp bot's idle sweep (check-ins, silent resolves, expired-chat
// purge: lib/whatsapp/idleSweep.ts) once, by calling a deployment's
// /api/cron/whatsapp-idle the way Vercel Cron does. The sweep runs inside that
// deployment, so it uses that deployment's Firestore: a local `next dev` or a
// Vercel Preview is landly-dev (lib/firebase/envGuard.ts). Production has its
// own Vercel Cron (vercel.json); this script refuses golandly.com.
//
// CRON_SECRET must match the deployment's. A protected Preview also needs
// VERCEL_AUTOMATION_BYPASS_SECRET (Project → Settings → Deployment Protection).
//
//   CRON_SECRET=… node scripts/whatsapp-idle-sweep.mjs
//   CRON_SECRET=… node scripts/whatsapp-idle-sweep.mjs --url https://landly-git-branch.vercel.app

import { flagValue } from './lib/adminInit.mjs'

const args = process.argv.slice(2)
const base = flagValue(args, '--url') ?? 'http://localhost:3000'
let url
try {
  url = new URL('/api/cron/whatsapp-idle', base)
} catch {
  console.error(`Not a URL: ${base}`)
  process.exit(1)
}
if (/(^|\.)golandly\.com$/i.test(url.hostname)) {
  console.error('Refusing production: its sweep runs from Vercel Cron. Point --url at a local or Preview deployment.')
  process.exit(1)
}
const secret = process.env.CRON_SECRET?.trim()
if (!secret) {
  console.error('Set CRON_SECRET to the deployment\'s value.')
  process.exit(1)
}

const headers = { Authorization: `Bearer ${secret}` }
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim()
if (bypass) headers['x-vercel-protection-bypass'] = bypass

console.log(`Sweeping via ${url.origin}`)
let res
try {
  res = await fetch(url, { headers })
} catch (err) {
  console.error(`Could not reach ${url.origin}: ${err?.message ?? err}`)
  process.exit(1)
}
const body = await res.text()
if (!res.ok) {
  console.error(`HTTP ${res.status}: ${body.slice(0, 300)}`)
  process.exit(1)
}
console.log(body)
