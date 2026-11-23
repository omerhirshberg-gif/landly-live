// Ops: creates (or, with --update, patches) this environment's Google Wallet OfferClass, ahead of the first member
// adding a pass (the server also creates it on demand when Google answers 404). Idempotent: an existing class is left
// alone unless --update is given.
//
//   npx tsx scripts/setupGoogleWalletClass.ts --target dev
//       reads .env.local only: the landly-dev service account  -> class <issuer>.golandly_voucher_dev
//   npx tsx scripts/setupGoogleWalletClass.ts --target prod --confirm-production
//       reads .env only: the landly-be752 service account      -> class <issuer>.golandly_voucher_prod
//
// Options:
//   --issuer-id <id>      the issuer id, else GOOGLE_WALLET_ISSUER_ID from the target's file, else from the shell
//   --classes dev|prod|both
//                         which class(es) to register: the target's own by default. `both` registers
//                         <issuer>.golandly_voucher_dev and <issuer>.golandly_voucher_prod with the one credential, which is
//                         what a single service account authorised on the shared issuer is for (needs --confirm-production)
//   --impersonate [sa]    get the token with `gcloud auth print-access-token --impersonate-service-account` (defaults to the
//                         file's FIREBASE_ADMIN_CLIENT_EMAIL): no private key is read from disk or created, the token lives
//                         in memory only. Needs a fresh `gcloud auth login` and the Service Account Token Creator role.
//   --use-adc             the same with Application Default Credentials (gcloud auth application-default login, scopes
//                         wallet_object.issuer and cloud-platform); the account behind them must be an issuer user
//   --update              patch an existing class with the current definition
//   --skip-logo           register the production class without its logo (Google fetches the logo's URL when the class is
//                         saved, so the class can't be created before public/wallet/google/logo.png is live on www.golandly.com).
//                         Without it, a class that already exists is patched, which adds the logo once it is deployed.
// Every run ends by reading each class back (GET) and printing the HTTP status.
// Only the target's own file is read, and only FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL,
// FIREBASE_ADMIN_PRIVATE_KEY and GOOGLE_WALLET_ISSUER_ID from it (the issuer id may also come from the shell): nothing
// goes into process.env, so DEV and PROD values can never mix, and the shell's FIREBASE_ADMIN_* are ignored. The file's
// project must be the target's project and the service account must belong to it (lib/wallet/passConfig.ts checks it
// again). Never reads .env.production.local.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import Module from 'node:module'
import { parseEnv } from 'node:util'

// The lib modules import 'server-only', which throws outside Next.js's server build. This script is such a place and
// only reads env and calls Google, so the guard is stood down for it; the lib modules are then imported inside main().
const nodeModule = Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown }
const load = nodeModule._load
nodeModule._load = function (this: unknown, request: string, ...rest: unknown[]) {
  return request === 'server-only' ? {} : load.call(this, request, ...rest)
}

const args = process.argv.slice(2)
const flag = (name: string) => args.includes(name)
const option = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined)
const fail = (message: string): never => {
  console.error(message)
  process.exit(1)
}

const TARGETS = {
  dev: { file: '.env.local', project: 'landly-dev', deploy: 'preview' },
  prod: { file: '.env', project: 'landly-be752', deploy: 'production' },
} as const
const KEYS = ['FIREBASE_ADMIN_PROJECT_ID', 'FIREBASE_ADMIN_CLIENT_EMAIL', 'FIREBASE_ADMIN_PRIVATE_KEY', 'GOOGLE_WALLET_ISSUER_ID'] as const

/** Just the wallet-related keys of one env file, as a plain object (process.env is left alone). */
function readTargetEnv(file: string): Record<string, string | undefined> {
  if (!existsSync(file)) return fail(`Refusing: ${file} does not exist.`)
  const parsed = parseEnv(readFileSync(file, 'utf8'))
  return Object.fromEntries(KEYS.map((key) => [key, parsed[key]?.trim() || undefined]))
}

const USAGE = 'Usage: setupGoogleWalletClass.ts --target dev|prod [--confirm-production] [--issuer-id <id>] [--classes dev|prod|both] [--impersonate [sa] | --use-adc] [--skip-logo] [--update]'
const API = 'https://walletobjects.googleapis.com/walletobjects/v1'

async function main() {
  if (flag('--help') || flag('-h')) {
    console.log(USAGE)
    return
  }
  const walletApi = await import('../lib/wallet/googleWalletApi')
  const { GOOGLE_CLASS_SUFFIX_PROD, GOOGLE_CLASS_SUFFIX_DEV, resolveGoogleWalletConfig } = await import('../lib/wallet/passConfig')
  const target = option('--target')
  if (target !== 'dev' && target !== 'prod') return fail(`Pass --target dev or --target prod.\n${USAGE}`)
  const classes = option('--classes') ?? target
  if (classes !== 'dev' && classes !== 'prod' && classes !== 'both') return fail(`Refusing: --classes must be dev, prod or both.\n${USAGE}`)
  const touchesProd = target === 'prod' || classes === 'prod' || classes === 'both'
  if (touchesProd && !flag('--confirm-production')) fail('Refusing: anything that touches the production class or project also needs --confirm-production.')

  const { file, project, deploy } = TARGETS[target]
  const env = readTargetEnv(file)
  if (env.FIREBASE_ADMIN_PROJECT_ID !== project) fail(`Refusing: ${file} has FIREBASE_ADMIN_PROJECT_ID ${env.FIREBASE_ADMIN_PROJECT_ID ?? '(unset)'}, not ${project}.`)
  const issuerId = option('--issuer-id')?.trim() || env.GOOGLE_WALLET_ISSUER_ID || process.env.GOOGLE_WALLET_ISSUER_ID?.trim() || undefined
  if (!issuerId || !/^\d{8,20}$/.test(issuerId)) return fail('Refusing: pass --issuer-id <numeric issuer id> (or set GOOGLE_WALLET_ISSUER_ID).')

  // The credential: the target project's service account, by key from its file, impersonation, or ADC.
  let email = env.FIREBASE_ADMIN_CLIENT_EMAIL ?? 'application-default-credentials'
  let privateKey = ''
  let token: string
  if (flag('--impersonate')) {
    const next = args[args.indexOf('--impersonate') + 1]
    email = (next && !next.startsWith('--') ? next : env.FIREBASE_ADMIN_CLIENT_EMAIL ?? '').toLowerCase()
    if (!email.endsWith(`@${project}.iam.gserviceaccount.com`)) return fail(`Refusing: --impersonate must be a ${project} service account.`)
    try {
      token = execFileSync('gcloud', ['auth', 'print-access-token', '--impersonate-service-account', email, '--scopes', walletApi.WALLET_SCOPE], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
    } catch (error) {
      const stderr = String((error as { stderr?: unknown }).stderr ?? '').replace(/ya29\.[\w.-]+/g, '[token]').trim()
      return fail(`Refusing: gcloud could not impersonate ${email}.\n${stderr}`)
    }
    console.log(`Using gcloud impersonation of ${email} (token in memory only).`)
  } else if (flag('--use-adc')) {
    const { GoogleAuth } = await import('google-auth-library')
    const adcToken = await new GoogleAuth({ scopes: [walletApi.WALLET_SCOPE] }).getAccessToken().catch(() => null)
    if (!adcToken) return fail('Refusing: no Application Default Credentials. Run `gcloud auth application-default login --scopes=https://www.googleapis.com/auth/wallet_object.issuer,https://www.googleapis.com/auth/cloud-platform` first.')
    token = adcToken
    console.log('Using Application Default Credentials.')
  } else {
    const resolved = resolveGoogleWalletConfig({ ...env, GOOGLE_WALLET_ISSUER_ID: issuerId }, deploy)
    if (resolved.mode !== 'ready') return fail(`Refusing: ${resolved.reason}`)
    email = resolved.serviceAccountEmail
    privateKey = resolved.privateKey
    token = await walletApi.getWalletAccessToken(resolved)
  }

  const which = classes === 'both' ? (['dev', 'prod'] as const) : ([classes] as const)
  for (const name of which) {
    const classSuffix = name === 'prod' ? GOOGLE_CLASS_SUFFIX_PROD : GOOGLE_CLASS_SUFFIX_DEV
    const config = {
      mode: 'ready' as const, issuerId, classSuffix, classId: `${issuerId}.${classSuffix}`, serviceAccountEmail: email, privateKey,
      // The production class carries the logo from the live site; the dev class is made without one (previews add theirs on demand).
      siteOrigin: name === 'prod' && !flag('--skip-logo') ? 'https://www.golandly.com' : null, target: TARGETS[name].deploy,
    }
    const before = await fetch(`${API}/offerClass/${encodeURIComponent(config.classId)}`, { headers: { Authorization: `Bearer ${token}` } })
    // A missing class is created; one that exists is patched when asked, or when it should carry the logo.
    if (before.status === 404) {
      await walletApi.ensureOfferClass(config, token)
      console.log(`Created ${config.classId}${config.siteOrigin ? '' : ' (no logo)'}.`)
    } else if (flag('--update') || config.siteOrigin) {
      await walletApi.updateOfferClass(config, token)
      console.log(`Updated ${config.classId}${config.siteOrigin ? ' (with the logo)' : ' (no logo)'}.`)
    } else {
      await walletApi.ensureOfferClass(config, token)
    }
    const read = await fetch(`${API}/offerClass/${encodeURIComponent(config.classId)}`, { headers: { Authorization: `Bearer ${token}` } })
    console.log(`GET offerClass/${config.classId} -> HTTP ${read.status}`)
    if (!read.ok) process.exitCode = 1
  }
}

main().catch((error: unknown) => {
  // Google's own words (redacted by walletFailure: no token, key or assertion), so the cause is visible.
  const e = error as { stage?: string; status?: number; detail?: string; message?: string }
  if (typeof e.status === 'number') {
    console.error(`Failed: Google Wallet ${e.stage ?? ''} request returned HTTP ${e.status}.`)
    if (e.detail) console.error(e.detail)
    process.exit(1)
  }
  fail(`Failed: ${e.message ?? 'unknown error'}`)
})
