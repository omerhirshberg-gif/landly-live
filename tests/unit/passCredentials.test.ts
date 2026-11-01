import forge from 'node-forge'
import { describe, expect, it } from 'vitest'
import { inspectPassCredentials, passCredentialIssue, type PassCredentials } from '@/lib/wallet/passCredentials'

const DAY = 86_400_000
const PASS_TYPE = 'pass.com.landly.voucher.dev'
const TEAM = 'ABCDE12345'

type Keys = forge.pki.rsa.KeyPair
const generate = (): Keys => forge.pki.rsa.generateKeyPair(2048)

function certificate(subject: forge.pki.CertificateField[], issuer: forge.pki.CertificateField[], publicKey: Keys['publicKey'], signer: Keys['privateKey'], from = -DAY, to = DAY) {
  const cert = forge.pki.createCertificate()
  cert.publicKey = publicKey
  cert.serialNumber = '01'
  cert.validity.notBefore = new Date(Date.now() + from)
  cert.validity.notAfter = new Date(Date.now() + to)
  cert.setSubject(subject)
  cert.setIssuer(issuer)
  cert.sign(signer, forge.md.sha256.create())
  return forge.pki.certificateToPem(cert)
}

const WWDR_NAME = [{ name: 'commonName', value: 'Test WWDR' }]
const signerName = (uid = PASS_TYPE, ou = TEAM) => [
  { type: '0.9.2342.19200300.100.1.1', value: uid },
  { name: 'commonName', value: `Pass Type ID: ${uid}` },
  { shortName: 'OU', value: ou },
]

const wwdrKeys = generate()
const signerKeys = generate()
const otherKeys = generate()
const wwdr = certificate(WWDR_NAME, WWDR_NAME, wwdrKeys.publicKey, wwdrKeys.privateKey, -DAY, 10 * DAY)
const signed = (name = signerName(), from = -DAY, to = DAY, issuer = wwdrKeys.privateKey) =>
  certificate(name, WWDR_NAME, signerKeys.publicKey, issuer, from, to)

const valid: PassCredentials = {
  passTypeId: PASS_TYPE,
  teamId: TEAM,
  signerCert: signed(),
  signerKey: forge.pki.privateKeyToPem(signerKeys.privateKey),
  wwdr,
}

describe('inspectPassCredentials', () => {
  it('accepts a real set', () => {
    expect(inspectPassCredentials(valid)).toBeNull()
  })

  it('takes a PKCS#8 key, as exported from a .p12', () => {
    const signerKey = forge.pki.privateKeyInfoToPem(forge.pki.wrapRsaPrivateKey(forge.pki.privateKeyToAsn1(signerKeys.privateKey)))
    expect(inspectPassCredentials({ ...valid, signerKey })).toBeNull()
  })

  it('catches PEMs an env file cut down to their BEGIN line', () => {
    expect(inspectPassCredentials({ ...valid, signerCert: '-----BEGIN CERTIFICATE-----' })).toBe('cert-malformed')
    expect(inspectPassCredentials({ ...valid, signerKey: '-----BEGIN PRIVATE KEY-----' })).toBe('key-malformed')
    expect(inspectPassCredentials({ ...valid, wwdr: '-----BEGIN CERTIFICATE-----' })).toBe('wwdr-malformed')
  })

  it('catches an encrypted key without its passphrase', () => {
    const signerKey = forge.pki.encryptRsaPrivateKey(signerKeys.privateKey, 'secret')
    expect(inspectPassCredentials({ ...valid, signerKey })).toBe('key-malformed')
    expect(inspectPassCredentials({ ...valid, signerKey, signerKeyPassphrase: 'secret' })).toBeNull()
  })

  it('catches a key that isn\'t the certificate\'s', () => {
    expect(inspectPassCredentials({ ...valid, signerKey: forge.pki.privateKeyToPem(otherKeys.privateKey) })).toBe('key-mismatch')
  })

  it('catches an expired certificate', () => {
    expect(inspectPassCredentials({ ...valid, signerCert: signed(signerName(), -3 * DAY, -DAY) })).toBe('cert-expired')
    expect(inspectPassCredentials(valid, Date.now() + 2 * DAY)).toBe('cert-expired')
  })

  it('catches a certificate the WWDR certificate didn\'t issue', () => {
    expect(inspectPassCredentials({ ...valid, signerCert: signed(signerName(), -DAY, DAY, otherKeys.privateKey) })).toBe('wwdr-chain')
  })

  it('catches the wrong Pass Type ID or team', () => {
    expect(inspectPassCredentials({ ...valid, signerCert: signed(signerName('pass.com.landly.voucher')) })).toBe('pass-type-mismatch')
    expect(inspectPassCredentials({ ...valid, teamId: 'ZZZZZ99999' })).toBe('team-mismatch')
  })
})

describe('passCredentialIssue', () => {
  it('checks changed credentials at once', () => {
    const now = Date.now()
    expect(passCredentialIssue(valid, now)).toBeNull()
    expect(passCredentialIssue({ ...valid, teamId: 'ZZZZZ99999' }, now)).toBe('team-mismatch')
  })

  it('remembers a result, and checks again later', () => {
    const now = Date.now()
    expect(passCredentialIssue(valid, now)).toBeNull()
    expect(passCredentialIssue(valid, now + 2 * DAY - 1)).toBe('cert-expired')
  })
})
