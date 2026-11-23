import 'server-only'
import { createPrivateKey } from 'node:crypto'
import { currentFirebaseDeployTarget, PRODUCTION_FIREBASE_PROJECT_ID, STAGING_FIREBASE_PROJECT_ID, type FirebaseDeployTarget } from '@/lib/firebase/envGuard'
import { SITE_URL } from '@/lib/config'
import { passCredentialIssue } from './passCredentials'

// Apple Wallet's signing setup for this deployment. Production signs with the
// production Pass Type ID and everything else with the .dev one, so a pass from
// the staging project can never pass for a real voucher; a mismatch turns the feature
// off rather than signing with the wrong identity. `mock` exists only in local
// development and tests with no certificates at all (lib/wallet/applePass.ts):
// a deployed build without them answers 'unavailable' and the badge stays
// hidden. Setup: docs/apple-wallet-configuration.md.

export const PRODUCTION_PASS_TYPE_ID = 'pass.com.landly.voucher'
export const DEVELOPMENT_PASS_TYPE_ID = 'pass.com.landly.voucher.dev'
const MOCK_TEAM_ID = 'MOCKTEAM00'
// Only ever signs tickets for a mock pass, on a developer's machine.
const MOCK_TICKET_SECRET = 'landly-local-mock-wallet-ticket'
const MIN_TICKET_SECRET_LENGTH = 32

export interface PassIdentity {
  passTypeId: string
  teamId: string
  ticketSecret: string
}

export type PassConfig =
  | (PassIdentity & { mode: 'signed'; signerCert: string; signerKey: string; signerKeyPassphrase?: string; wwdr: string })
  | (PassIdentity & { mode: 'mock' })
  | { mode: 'unavailable'; reason: string }

type Env = Record<string, string | undefined>

// Env files can't hold real newlines: PEMs are stored with literal "\n", like FIREBASE_ADMIN_PRIVATE_KEY.
const pem = (value: string | undefined) => value?.replace(/\\n/g, '\n').trim() || undefined

export function resolvePassConfig(env: Env, target: FirebaseDeployTarget, nodeEnv: string | undefined): PassConfig {
  const signerCert = pem(env.APPLE_PASS_CERT_PEM)
  const signerKey = pem(env.APPLE_PASS_KEY_PEM)

  if (!signerCert && !signerKey) {
    const local = target === 'local' || target === 'unchecked'
    if (local && (nodeEnv === 'development' || nodeEnv === 'test')) {
      return { mode: 'mock', passTypeId: DEVELOPMENT_PASS_TYPE_ID, teamId: MOCK_TEAM_ID, ticketSecret: MOCK_TICKET_SECRET }
    }
    return { mode: 'unavailable', reason: 'No Apple pass certificate is configured.' }
  }

  const wwdr = pem(env.APPLE_WWDR_PEM)
  const passTypeId = env.APPLE_PASS_TYPE_ID?.trim()
  const teamId = env.APPLE_TEAM_ID?.trim()
  const ticketSecret = env.APPLE_PASS_TICKET_SECRET?.trim()
  if (!signerCert || !signerKey || !wwdr || !passTypeId || !teamId || !ticketSecret) {
    return { mode: 'unavailable', reason: 'The Apple pass configuration is incomplete.' }
  }
  if (ticketSecret.length < MIN_TICKET_SECRET_LENGTH) {
    return { mode: 'unavailable', reason: `APPLE_PASS_TICKET_SECRET needs at least ${MIN_TICKET_SECRET_LENGTH} characters.` }
  }
  const expected = target === 'production' ? PRODUCTION_PASS_TYPE_ID : DEVELOPMENT_PASS_TYPE_ID
  if (passTypeId !== expected) {
    return { mode: 'unavailable', reason: `The ${target} deployment must use ${expected}, not ${passTypeId}.` }
  }
  return {
    mode: 'signed',
    passTypeId,
    teamId,
    ticketSecret,
    signerCert,
    signerKey,
    wwdr,
    signerKeyPassphrase: env.APPLE_PASS_KEY_PASSPHRASE || undefined,
  }
}

export function getPassConfig(): PassConfig {
  const resolved = resolvePassConfig(process.env, currentFirebaseDeployTarget(), process.env.NODE_ENV)
  const issue = resolved.mode === 'signed' ? passCredentialIssue(resolved) : null
  const config: PassConfig = issue ? { mode: 'unavailable', reason: `The Apple pass credentials can't sign (${issue}).` } : resolved
  // The reason names env vars and fixed codes, never their values; clients only see a plain 503.
  if (config.mode === 'unavailable') console.warn(`Apple Wallet is off: ${config.reason}`)
  return config
}

// ---------------------------------------------------------------------------
// Google Wallet (lib/wallet/googlePass.ts). One issuer serves both projects, so
// DEV and PROD stay apart by class id: production signs for `golandly_voucher_prod`
// and everything else for `golandly_voucher_dev`, with the Firebase Admin service
// account of its own project (the same one lib/firebase/admin.ts uses, checked
// here against the deployment target again). Any mismatch or gap turns the
// feature off ('unavailable', the badge stays hidden) rather than signing with the
// wrong identity. There is no mock mode: a Wallet save link can't be faked.
// ---------------------------------------------------------------------------

export const GOOGLE_CLASS_SUFFIX_PROD = 'golandly_voucher_prod'
export const GOOGLE_CLASS_SUFFIX_DEV = 'golandly_voucher_dev'
const ISSUER_ID = /^\d{8,20}$/

export type GoogleWalletConfig =
  | {
      mode: 'ready'
      issuerId: string
      /** Full class id: `<issuer>.<suffix>`. */
      classId: string
      classSuffix: string
      serviceAccountEmail: string
      privateKey: string
      /** Where the pass's images are served from (https only; none on a machine Google can't reach). */
      siteOrigin: string | null
      target: FirebaseDeployTarget
    }
  | { mode: 'unavailable'; reason: string }

export function resolveGoogleWalletConfig(env: Env, target: FirebaseDeployTarget): GoogleWalletConfig {
  const issuerId = env.GOOGLE_WALLET_ISSUER_ID?.trim()
  if (!issuerId) return { mode: 'unavailable', reason: 'GOOGLE_WALLET_ISSUER_ID is not set.' }
  if (!ISSUER_ID.test(issuerId)) return { mode: 'unavailable', reason: 'GOOGLE_WALLET_ISSUER_ID is not a numeric issuer id.' }

  const email = env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim().toLowerCase()
  const privateKey = pem(env.FIREBASE_ADMIN_PRIVATE_KEY)
  if (!email || !privateKey) return { mode: 'unavailable', reason: 'The Firebase Admin service account is not configured.' }

  const production = target === 'production'
  const project = production ? PRODUCTION_FIREBASE_PROJECT_ID : STAGING_FIREBASE_PROJECT_ID
  if (!email.endsWith(`@${project}.iam.gserviceaccount.com`)) {
    return { mode: 'unavailable', reason: `The ${target} deployment must sign with the ${project} service account.` }
  }
  try {
    if (createPrivateKey(privateKey).asymmetricKeyType !== 'rsa') return { mode: 'unavailable', reason: 'The service account key is not RSA.' }
  } catch {
    return { mode: 'unavailable', reason: 'The service account key is malformed.' }
  }

  const classSuffix = production ? GOOGLE_CLASS_SUFFIX_PROD : GOOGLE_CLASS_SUFFIX_DEV
  const vercelHost = env.VERCEL_URL?.trim()
  const siteOrigin = production ? SITE_URL : target === 'preview' && vercelHost ? `https://${vercelHost}` : null
  return { mode: 'ready', issuerId, classId: `${issuerId}.${classSuffix}`, classSuffix, serviceAccountEmail: email, privateKey, siteOrigin, target }
}

export function getGoogleWalletConfig(): GoogleWalletConfig {
  const config = resolveGoogleWalletConfig(process.env, currentFirebaseDeployTarget())
  // The reason names env vars and fixed facts, never their values; clients only see a plain 503.
  if (config.mode === 'unavailable') console.warn(`Google Wallet is off: ${config.reason}`)
  return config
}
