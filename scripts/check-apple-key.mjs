// Is the Sign in with Apple key you hold the one Firebase needs? When the
// website shows invalid_client, Apple refused the client secret Firebase
// signs with the Team ID, Key ID and .p8 in its Apple provider. Apple checks
// that secret only when it's given a real code (a made-up one is refused
// first, whatever the key), so this takes one real sign-in:
//
//   1. APPLE_P8_PATH=~/keys/AuthKey_XXXXXXXXXX.p8 npm run check:apple-key
//      Checks the key file (Key ID / file name, EC P-256), then prints an
//      Apple sign-in link per project. Open one, sign in; Apple sends the
//      browser to the project's own Return URL with ?code=... in the address
//      (that page shows an error: expected). Copy the whole address.
//   2. APPLE_P8_PATH=... APPLE_CODE_URL='<that address>' npm run check:apple-key
//      Redeems the code with Apple from here, signed with your key:
//        key-ok      -- your key, Key ID and Team ID work for that Services
//                       ID: Firebase's copy differs; re-enter them in
//                       Firebase Console > Authentication > Sign-in method >
//                       Apple for that project
//        bad-key     -- Apple refuses them too: the key was revoked, or the
//                       Key ID / Team ID don't belong to it, or the Services
//                       ID isn't set up under this key's primary App ID
//        code-spent  -- the code was used or is over 5 minutes old: step 1 again
//
// APPLE_KEY_ID defaults to the one in the file name, APPLE_TEAM_ID to
// Landly's. The key never leaves this machine (only a signature goes to
// Apple) and is never printed; neither are the tokens Apple returns: the
// refresh token is revoked at once. Nothing in Firebase or Apple's settings
// changes. Exits 1 if anything fails.

import { existsSync, readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { homedir } from 'node:os'
import {
  appleClientSecret,
  appleKeyCheckAuthorizeUrl,
  appleKeyProblems,
  classifyAppleTokenAnswer,
  EXPECTED_APPLE_CLIENT_IDS,
  EXPECTED_APPLE_TEAM_ID,
  parseKeyCheckReturn,
} from './lib/appleOAuth.mjs'

const p8Path = (process.env.APPLE_P8_PATH ?? '').replace(/^~(?=\/)/, homedir())
const keyId = process.env.APPLE_KEY_ID ?? basename(p8Path).match(/AuthKey_([A-Z0-9]{10})\.p8$/)?.[1] ?? ''
const teamId = process.env.APPLE_TEAM_ID ?? EXPECTED_APPLE_TEAM_ID

if (!p8Path || !existsSync(p8Path)) {
  console.error('Set APPLE_P8_PATH to the Sign in with Apple key (.p8) from the Apple Developer portal (and APPLE_KEY_ID if the file was renamed).')
  process.exit(1)
}
const privateKeyPem = readFileSync(p8Path, 'utf8')

const problems = appleKeyProblems({ teamId, keyId, privateKeyPem, fileName: basename(p8Path) })
for (const problem of problems) console.log(`FAIL key   ${problem}`)
if (problems.length) process.exit(1)
console.log(`OK   key   Team ${teamId}, Key ${keyId}, EC P-256`)

const returned = process.env.APPLE_CODE_URL
if (!returned) {
  console.log('\nSign in with Apple once, in a browser, with the project to check:')
  for (const projectId of Object.keys(EXPECTED_APPLE_CLIENT_IDS)) console.log(`  ${projectId.padEnd(13)} ${appleKeyCheckAuthorizeUrl(projectId)}`)
  console.log("\nApple then opens that project's sign-in page with ?code=... in the address (the page itself shows an error).")
  console.log("Within 5 minutes, run again with APPLE_CODE_URL='<the whole address>'.")
  process.exit(0)
}

const sent = parseKeyCheckReturn(returned)
if (!sent) {
  console.log('FAIL code  APPLE_CODE_URL is not an address Apple sent back from one of the links above')
  process.exit(1)
}

const now = Math.floor(Date.now() / 1000)
const clientSecret = appleClientSecret({ teamId, keyId, clientId: sent.clientId, privateKeyPem, now })
const res = await fetch('https://appleid.apple.com/auth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: sent.clientId,
    client_secret: clientSecret,
    code: sent.code,
    grant_type: 'authorization_code',
    redirect_uri: sent.redirectUri,
  }),
})
const json = await res.json().catch(() => ({}))
const status = classifyAppleTokenAnswer(res.status, json)

// Leave nothing behind: Apple's tokens are never printed, and the refresh token is revoked.
if (json.refresh_token) {
  await fetch('https://appleid.apple.com/auth/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: sent.clientId, client_secret: clientSecret, token: json.refresh_token, token_type_hint: 'refresh_token' }),
  }).catch(() => undefined)
}

const NEXT = {
  'key-ok': `Apple accepts this key for ${sent.clientId}. If ${sent.projectId} still gets invalid_client, Firebase holds a different key: re-enter Team ID ${teamId}, Key ID ${keyId} and this .p8 in its Apple provider.`,
  'bad-key': `Apple refuses this key for ${sent.clientId}: it was revoked, Key ID ${keyId} / Team ID ${teamId} don't belong to it, or ${sent.clientId} isn't configured for Sign in with Apple under this key's primary App ID. Create a new key in Apple Developer > Keys (Sign in with Apple enabled) and enter it in both Firebase projects.`,
  'code-spent': 'The code was already used or is more than 5 minutes old: open the link again and rerun straight away.',
  'unknown': `Apple answered ${res.status} ${JSON.stringify({ error: json.error, error_description: json.error_description })}`,
}
console.log(`${status === 'key-ok' ? 'OK  ' : 'FAIL'} ${sent.projectId.padEnd(13)} ${sent.clientId.padEnd(30)} ${status}`)
console.log(`\n${NEXT[status]}`)
process.exit(status === 'key-ok' ? 0 : 1)
