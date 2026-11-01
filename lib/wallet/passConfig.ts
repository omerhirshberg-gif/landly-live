import 'server-only'
import { currentFirebaseDeployTarget, type FirebaseDeployTarget } from '@/lib/firebase/envGuard'

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
  const config = resolvePassConfig(process.env, currentFirebaseDeployTarget(), process.env.NODE_ENV)
  // The reason names env vars, never their values; clients only see a plain 503.
  if (config.mode === 'unavailable') console.warn(`Apple Wallet is off: ${config.reason}`)
  return config
}
