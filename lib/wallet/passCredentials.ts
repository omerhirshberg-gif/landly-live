import 'server-only'
import { createPrivateKey, X509Certificate, type KeyObject } from 'node:crypto'

// Whether the configured certificates can really sign a pass Wallet will take.
// Non-empty isn't enough: an env file that cuts a PEM down to its BEGIN line
// still reads as configured, so the badge showed and every tap failed. Issues
// are fixed codes, safe to log: nothing here ever carries a credential's content.

export type PassCredentialIssue =
  | 'cert-malformed'
  | 'key-malformed'
  | 'wwdr-malformed'
  | 'key-not-rsa' // the signing library only takes RSA keys
  | 'key-mismatch'
  | 'cert-expired'
  | 'wwdr-chain'
  | 'pass-type-mismatch'
  | 'team-mismatch'

export interface PassCredentials {
  passTypeId: string
  teamId: string
  signerCert: string
  signerKey: string
  signerKeyPassphrase?: string
  wwdr: string
}

const RECHECK_MS = 60 * 60 * 1000 // a long-lived server still notices the certificate expiring

const certificate = (pem: string): X509Certificate | null => {
  try {
    return new X509Certificate(pem)
  } catch {
    return null
  }
}

const privateKey = (pem: string, passphrase: string | undefined): KeyObject | null => {
  try {
    return createPrivateKey({ key: pem, passphrase })
  } catch {
    return null
  }
}

const inDate = (cert: X509Certificate, nowMs: number) =>
  new Date(cert.validFrom).getTime() <= nowMs && nowMs < new Date(cert.validTo).getTime()

/** One attribute of a certificate's subject, which Node prints as `NAME=value` lines. */
const subjectValue = (cert: X509Certificate, name: string) =>
  cert.subject.split('\n').find((line) => line.startsWith(`${name}=`))?.slice(name.length + 1)

/** The first thing stopping these credentials from signing a valid pass, or null. */
export function inspectPassCredentials(credentials: PassCredentials, nowMs = Date.now()): PassCredentialIssue | null {
  const signer = certificate(credentials.signerCert)
  if (!signer) return 'cert-malformed'
  const key = privateKey(credentials.signerKey, credentials.signerKeyPassphrase)
  if (!key) return 'key-malformed'
  const wwdr = certificate(credentials.wwdr)
  if (!wwdr) return 'wwdr-malformed'
  if (key.asymmetricKeyType !== 'rsa') return 'key-not-rsa'
  if (!signer.checkPrivateKey(key)) return 'key-mismatch'
  if (!inDate(signer, nowMs)) return 'cert-expired'
  if (!signer.checkIssued(wwdr) || !signer.verify(wwdr.publicKey) || !inDate(wwdr, nowMs)) return 'wwdr-chain'
  // Apple's Pass Type ID certificates: UID is the identifier, OU the team.
  if (subjectValue(signer, 'UID') !== credentials.passTypeId) return 'pass-type-mismatch'
  if (subjectValue(signer, 'OU') !== credentials.teamId) return 'team-mismatch'
  return null
}

let cached: { input: string; issue: PassCredentialIssue | null; checkedAt: number } | null = null

/** inspectPassCredentials, remembered: availability is polled, and the parsing isn't free. */
export function passCredentialIssue(credentials: PassCredentials, nowMs = Date.now()): PassCredentialIssue | null {
  const { passTypeId, teamId, signerCert, signerKey, signerKeyPassphrase, wwdr } = credentials
  const input = JSON.stringify([passTypeId, teamId, signerCert, signerKey, signerKeyPassphrase, wwdr])
  if (cached?.input === input && nowMs - cached.checkedAt < RECHECK_MS) return cached.issue
  const issue = inspectPassCredentials(credentials, nowMs)
  cached = { input, issue, checkedAt: nowMs }
  return issue
}
