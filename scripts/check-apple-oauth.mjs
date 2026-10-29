// Read-only: would Sign in with Apple start on DEV (landly-dev) and PROD
// (landly-be752)? For each host that serves Firebase's auth handler, asks
// Firebase for the Apple authorize URL it would send members to (the same
// accounts:createAuthUri call the handler makes), checks the Services ID in
// it, and asks Apple whether it accepts that Services ID and Return URL.
// "Invalid web redirect url" means the host's https://<host>/__/auth/handler
// is missing from the Services ID's Return URLs in the Apple Developer portal.
// Then has Firebase redeem a made-up code with Apple (accounts:signInWithIdp,
// as the handler does after Face ID): Apple refusing the code (invalid_grant)
// proves the Team ID, Key ID and private key in Firebase's Apple provider
// work; invalid_client means they don't. No account is created.
//
//   npm run check:apple
//
// Uses only each env's public web API key (.env.local, .env.production.local)
// and never prints it. Changes nothing. Exits 1 if any row fails.

import { existsSync, readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { parseEnv } from 'node:util'
import { assessRow } from './lib/appleOAuth.mjs'

process.removeAllListeners('warning')
const { PROXIED_AUTH_HOSTS } = await import('../lib/firebase/authDomain.ts')

const root = join(import.meta.dirname, '..')
const ENVS = [
  { label: 'DEV', file: '.env.local' },
  { label: 'PROD', file: '.env.production.local' },
]

function readEnv(file) {
  const path = join(root, file)
  return existsSync(path) ? parseEnv(readFileSync(path, 'utf8')) : null
}

async function authUriFor(apiKey, host) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ providerId: 'apple.com', continueUri: `https://${host}/__/auth/handler` }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.authUri) throw new Error(`createAuthUri ${res.status}: ${json.error?.message ?? 'no authUri'}`)
  return { authUri: json.authUri, sessionId: json.sessionId }
}

// A fresh made-up code each time: Firebase refuses one it has already seen
// (MISSING_OR_INVALID_NONCE) before asking Apple.
async function exchangeMessageFor(apiKey, host, authUri, sessionId) {
  const state = new URL(authUri).searchParams.get('state') ?? ''
  const code = `c${randomBytes(8).toString('hex')}.0.landly-check.invalid`
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestUri: `https://${host}/__/auth/handler`,
      sessionId,
      postBody: `code=${code}&state=${encodeURIComponent(state)}&providerId=apple.com`,
      returnSecureToken: false,
      returnIdpCredential: true,
    }),
  })
  const json = await res.json().catch(() => ({}))
  return json.error?.message ?? (res.ok ? 'accepted a made-up code' : `HTTP ${res.status}`)
}

const rows = []
for (const { label, file } of ENVS) {
  const env = readEnv(file)
  const projectId = env?.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const apiKey = env?.NEXT_PUBLIC_FIREBASE_API_KEY
  if (!projectId || !apiKey) {
    rows.push({ label, projectId: projectId ?? '?', host: '-', ok: false, note: `${file} missing or incomplete` })
    continue
  }
  const hosts = [env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`]
  if (env.NEXT_PUBLIC_FIREBASE_AUTH_PROXY === '1') hosts.push(...PROXIED_AUTH_HOSTS)
  for (const host of hosts) {
    try {
      const { authUri, sessionId } = await authUriFor(apiKey, host)
      const res = await fetch(authUri, { redirect: 'manual' })
      const body = await res.text()
      const exchangeMessage = await exchangeMessageFor(apiKey, host, authUri, sessionId)
      const row = assessRow({ projectId, host, authUri, status: res.status, body, exchangeMessage })
      const notes = []
      if (row.clientId !== row.expectedClientId) notes.push(`client_id ${row.clientId}, expected ${row.expectedClientId}`)
      if (row.exchange === 'unknown') notes.push(`token exchange: ${exchangeMessage.split(',')[0].slice(0, 160)}`)
      const note = notes.join('; ')
      rows.push({ label, ...row, note })
    } catch (err) {
      rows.push({ label, projectId, host, ok: false, note: err instanceof Error ? err.message : String(err) })
    }
  }
}

console.log(`     ${'ENV'.padEnd(4)} ${'PROJECT'.padEnd(13)} ${'HOST'.padEnd(30)} ${'AUTHORIZE'.padEnd(12)} ${'KEY'.padEnd(8)} SERVICES ID`)
for (const r of rows) {
  const status = r.ok ? 'OK  ' : 'FAIL'
  console.log(
    `${status} ${r.label.padEnd(4)} ${r.projectId.padEnd(13)} ${r.host.padEnd(30)} ${(r.apple ?? '-').padEnd(12)} ${(r.exchange ?? '-').padEnd(8)} ${r.clientId ?? ''} ${r.note ?? ''}`.trimEnd(),
  )
}
const failed = rows.filter((r) => !r.ok).length
console.log(failed ? `\n${failed} of ${rows.length} failed.` : `\nAll ${rows.length} accepted by Apple, and every project's Apple key works.`)
process.exit(failed ? 1 : 0)
