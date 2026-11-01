import { describe, expect, it } from 'vitest'
import forge from 'node-forge'
import { buildPassJson, buildPkpass, PassBuildError, passSerialNumber, passStrings, PKPASS_MIME_TYPE } from '@/lib/wallet/applePass'
import { DEVELOPMENT_PASS_TYPE_ID, PRODUCTION_PASS_TYPE_ID, resolvePassConfig } from '@/lib/wallet/passConfig'
import { createPassTicket, TICKET_TTL_SECONDS, verifyPassTicket } from '@/lib/wallet/passTicket'
import { isPassEligible, type PassVoucher } from '@/lib/wallet/passVoucher'

const identity = { passTypeId: DEVELOPMENT_PASS_TYPE_ID, teamId: 'ABCDE12345', ticketSecret: 'x'.repeat(32) }
const voucher: PassVoucher = {
  id: 'uid123_offer456',
  userId: 'uid123',
  offerId: 'offer456',
  businessName: 'מזנונקי',
  offerTitle: 'ארוחה זוגית',
  redemptionCode: '123456',
  redeemToken: 'a'.repeat(32),
  status: 'active',
  expiresAt: new Date('2030-01-02T03:04:05.678Z'),
  redemptionTerms: 'Not on "holidays"\nOne per table',
  redemptionMethod: 'in_store',
  redemptionInstructions: '',
  displayOrderNumber: '#1001',
  translations: {
    sourceLang: 'he',
    fields: { en: { title: { text: 'Dinner for two', sourceHash: '', machine: true } } },
  },
  businessTranslations: null,
  businessAddress: null,
  businessGeo: { lat: 32.08, lng: 34.78 },
}

function selfSigned() {
  const keys = forge.pki.rsa.generateKeyPair(2048)
  const cert = forge.pki.createCertificate()
  cert.publicKey = keys.publicKey
  cert.serialNumber = '01'
  cert.validity.notBefore = new Date(Date.now() - 86_400_000)
  cert.validity.notAfter = new Date(Date.now() + 86_400_000)
  const attrs = [{ name: 'commonName', value: 'Landly Test' }]
  cert.setSubject(attrs)
  cert.setIssuer(attrs)
  cert.sign(keys.privateKey, forge.md.sha256.create())
  return { cert: forge.pki.certificateToPem(cert), key: forge.pki.privateKeyToPem(keys.privateKey) }
}

/** Reads a stored-or-deflated zip's entries with node's zlib, from the central directory. */
async function unzip(zip: Buffer): Promise<Record<string, Buffer>> {
  const { inflateRawSync } = await import('node:zlib')
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  const count = zip.readUInt16LE(end + 10)
  let at = zip.readUInt32LE(end + 16)
  const files: Record<string, Buffer> = {}
  for (let i = 0; i < count; i++) {
    const method = zip.readUInt16LE(at + 10)
    const size = zip.readUInt32LE(at + 20)
    const nameLength = zip.readUInt16LE(at + 28)
    const extra = zip.readUInt16LE(at + 30)
    const comment = zip.readUInt16LE(at + 32)
    const offset = zip.readUInt32LE(at + 42)
    const name = zip.toString('utf8', at + 46, at + 46 + nameLength)
    const start = offset + 30 + zip.readUInt16LE(offset + 26) + zip.readUInt16LE(offset + 28)
    const raw = zip.subarray(start, start + size)
    files[name] = method === 0 ? Buffer.from(raw) : inflateRawSync(raw)
    at += 46 + nameLength + extra + comment
  }
  return files
}

describe('pass.json', () => {
  const json = buildPassJson(voucher, identity, 25, 'Dana Cohen')

  it('is an event ticket in Landly navy with sharing off', () => {
    expect(json).toMatchObject({
      formatVersion: 1,
      organizationName: 'Landly',
      logoText: 'Landly',
      backgroundColor: 'rgb(11,27,61)',
      foregroundColor: 'rgb(255,255,255)',
      labelColor: 'rgb(180,194,220)',
      sharingProhibited: true,
      expirationDate: '2030-01-02T03:04:05Z',
    })
    expect(json).not.toHaveProperty('coupon')
  })

  it('keeps the strip clean: Wallet would draw a primary field over the photo', () => {
    expect(json.eventTicket.primaryFields).toEqual([])
  })

  it('lays the front out as header, title row and two columns', () => {
    const { headerFields, secondaryFields, auxiliaryFields } = json.eventTicket
    expect(headerFields).toEqual([expect.objectContaining({ key: 'expires', label: 'Valid until', value: '2030-01-02T03:04:05Z', dateStyle: 'PKDateStyleMedium', timeStyle: 'PKDateStyleNone' })])
    expect(secondaryFields).toHaveLength(1)
    expect(secondaryFields[0]).toMatchObject({ key: 'offer', value: 'Dinner for two' })
    expect(secondaryFields[0].label).toBeTruthy()
    expect(auxiliaryFields.map((f) => f.key)).toEqual(['order', 'member'])
    expect(auxiliaryFields[1]).toMatchObject({ label: 'Member', value: 'Dana Cohen' })
  })

  it('moves the discount to the back, and never pins an alignment that wouldn\'t mirror in Hebrew', () => {
    expect(json.eventTicket.backFields.map((f) => f.key)).toEqual(['how', 'discount', 'terms'])
    expect(JSON.stringify(json)).not.toContain('textAlignment')
  })

  it('carries the same QR payload as the app, and the numeric code', () => {
    expect(json.barcodes).toEqual([{
      format: 'PKBarcodeFormatQR',
      message: `https://golandly.com/redeem/${'a'.repeat(32)}`,
      messageEncoding: 'iso-8859-1',
      altText: '123456',
    }])
  })

  it('never leaks the voucher id, which holds the uid', () => {
    expect(JSON.stringify(json)).not.toContain('uid123')
    expect(json.serialNumber).toBe(passSerialNumber(DEVELOPMENT_PASS_TYPE_ID, voucher.id))
    expect(passSerialNumber(PRODUCTION_PASS_TYPE_ID, voucher.id)).not.toBe(json.serialNumber)
  })

  it('leaves out what a voucher lacks', () => {
    const bare = buildPassJson({ ...voucher, expiresAt: null, businessGeo: null, redemptionTerms: '', displayOrderNumber: null }, identity, null)
    expect(bare).not.toHaveProperty('expirationDate')
    expect(bare).not.toHaveProperty('locations')
    expect(bare.eventTicket.headerFields).toEqual([])
    expect(bare.eventTicket.auxiliaryFields).toEqual([])
    expect(bare.eventTicket.backFields.map((f) => f.key)).toEqual(['how'])
    const noBusiness = buildPassJson({ ...voucher, businessName: '', businessTranslations: null }, identity, null)
    expect(noBusiness.eventTicket.secondaryFields[0]).not.toHaveProperty('label')
  })
})

describe('pass.strings', () => {
  it('translates English keys, and escapes quotes and line breaks', () => {
    const he = passStrings(voucher, 'he')
    expect(he['Member']).toBe('על שם')
    expect(he['Dinner for two']).toBe('ארוחה זוגית')
    expect(he['Not on \\"holidays\\"\\nOne per table']).toBe('Not on \\"holidays\\"\\nOne per table')
  })
})

describe('tickets', () => {
  const secret = 's'.repeat(32)
  const now = 1_900_000_000_000

  it('round-trips within its minute and dies after', () => {
    const ticket = createPassTicket(secret, 'v1', 'u1', now)
    expect(verifyPassTicket(secret, ticket, 'v1', now)).toBe('u1')
    expect(verifyPassTicket(secret, ticket, 'v1', now + (TICKET_TTL_SECONDS + 1) * 1000)).toBeNull()
  })

  it('refuses another voucher, a forged member or a wrong secret', () => {
    const ticket = createPassTicket(secret, 'v1', 'u1', now)
    expect(verifyPassTicket(secret, ticket, 'v2', now)).toBeNull()
    expect(verifyPassTicket(secret, ticket.replace('.u1.', '.u2.'), 'v1', now)).toBeNull()
    expect(verifyPassTicket('o'.repeat(32), ticket, 'v1', now)).toBeNull()
    expect(verifyPassTicket(secret, null, 'v1', now)).toBeNull()
    expect(verifyPassTicket(secret, 'nonsense', 'v1', now)).toBeNull()
  })
})

describe('environment guard', () => {
  const full = {
    APPLE_PASS_TYPE_ID: PRODUCTION_PASS_TYPE_ID, APPLE_TEAM_ID: 'ABCDE12345', APPLE_PASS_CERT_PEM: 'c\\nc',
    APPLE_PASS_KEY_PEM: 'k', APPLE_WWDR_PEM: 'w', APPLE_PASS_TICKET_SECRET: 'x'.repeat(32),
  }

  it('mocks only locally, in development or tests', () => {
    expect(resolvePassConfig({}, 'local', 'development').mode).toBe('mock')
    expect(resolvePassConfig({}, 'unchecked', 'test').mode).toBe('mock')
    expect(resolvePassConfig({}, 'local', 'production').mode).toBe('unavailable')
    expect(resolvePassConfig({}, 'preview', 'production').mode).toBe('unavailable')
    expect(resolvePassConfig({}, 'production', 'production').mode).toBe('unavailable')
  })

  it('binds each deployment to its own Pass Type ID', () => {
    expect(resolvePassConfig(full, 'production', 'production').mode).toBe('signed')
    expect(resolvePassConfig(full, 'preview', 'production').mode).toBe('unavailable')
    expect(resolvePassConfig({ ...full, APPLE_PASS_TYPE_ID: DEVELOPMENT_PASS_TYPE_ID }, 'production', 'production').mode).toBe('unavailable')
    expect(resolvePassConfig({ ...full, APPLE_PASS_TYPE_ID: DEVELOPMENT_PASS_TYPE_ID }, 'preview', 'production').mode).toBe('signed')
  })

  it('never falls back to a mock on a half-finished setup', () => {
    const { APPLE_WWDR_PEM: _wwdr, ...partial } = full
    expect(resolvePassConfig(partial, 'local', 'development').mode).toBe('unavailable')
    expect(resolvePassConfig({ ...full, APPLE_PASS_TICKET_SECRET: 'short' }, 'production', 'production').mode).toBe('unavailable')
  })
})

describe('eligibility', () => {
  it('takes only active, unexpired vouchers with a token', () => {
    const now = new Date('2029-01-01').getTime()
    expect(isPassEligible(voucher, now)).toBe(true)
    expect(isPassEligible({ ...voucher, status: 'redeemed' }, now)).toBe(false)
    expect(isPassEligible({ ...voucher, status: 'refunded' }, now)).toBe(false)
    expect(isPassEligible({ ...voucher, redeemToken: null }, now)).toBe(false)
    expect(isPassEligible({ ...voucher, expiresAt: new Date('2028-01-01') }, now)).toBe(false)
  })
})

describe('the bundle', () => {
  const options = { discountPercent: 25, imageUrl: '', category: 'Restaurants and Cafes' }

  it('is a complete mock: every file hashed, a placeholder signature', async () => {
    const files = await unzip(await buildPkpass(voucher, { mode: 'mock', ...identity }, options))
    const manifest = JSON.parse(files['manifest.json'].toString())
    expect(Object.keys(files)).toEqual(expect.arrayContaining([
      'pass.json', 'icon.png', 'icon@2x.png', 'logo.png', 'logo@2x.png', 'strip.png', 'strip@2x.png', 'he.lproj/pass.strings', 'manifest.json', 'signature',
    ]))
    expect(Object.keys(manifest)).toContain('strip@3x.png')
    expect(Object.keys(manifest)).not.toContain('signature')
    expect(files.signature.toString()).toContain('MOCK')
  })

  it('names the signing stage when a PEM is unusable', async () => {
    const header = '-----BEGIN CERTIFICATE-----'
    const failure = await buildPkpass(voucher, { mode: 'signed', ...identity, signerCert: header, signerKey: '-----BEGIN PRIVATE KEY-----', wwdr: header }, options).catch((error) => error)
    expect(failure).toBeInstanceOf(PassBuildError)
    expect(failure.stage).toBe('sign')
  })

  it('signs a real PKCS #7 over the manifest with the library, keeping every field', async () => {
    const { cert, key } = selfSigned()
    const zip = await buildPkpass(voucher, { mode: 'signed', ...identity, signerCert: cert, signerKey: key, wwdr: cert }, { ...options, holderName: 'Dana Cohen' })
    const files = await unzip(zip)
    const pass = JSON.parse(files['pass.json'].toString())
    expect(pass.sharingProhibited).toBe(true)
    expect(pass.barcodes[0].altText).toBe('123456')
    expect(pass.expirationDate).toMatch(/^2030-01-02/)
    expect(pass.locations[0].latitude).toBe(32.08)
    expect(pass.eventTicket.primaryFields).toEqual([])
    expect(pass.eventTicket.secondaryFields[0].value).toBe('Dinner for two')
    expect(pass.eventTicket.headerFields[0].key).toBe('expires')
    expect(pass.eventTicket.auxiliaryFields.map((f: { key: string }) => f.key)).toEqual(['order', 'member'])
    expect(files['he.lproj/pass.strings'].toString()).toContain('"Member" = "על שם";')
    expect(files['he.lproj/pass.strings'].toString()).toContain('\\"holidays\\"')

    const manifest = JSON.parse(files['manifest.json'].toString())
    expect(Object.keys(manifest)).toEqual(expect.arrayContaining(['pass.json', 'icon.png', 'he.lproj/pass.strings']))
    const asn1 = forge.asn1.fromDer(forge.util.createBuffer(files.signature.toString('binary')))
    const message = forge.pkcs7.messageFromAsn1(asn1) as unknown as { rawCapture: { content?: unknown; signature: string } }
    expect(message.rawCapture.signature.length).toBeGreaterThan(0)
    // Detached: the manifest itself isn't inside.
    expect(message.rawCapture.content).toBeUndefined()
  })

  it('names the Wallet MIME type', () => {
    expect(PKPASS_MIME_TYPE).toBe('application/vnd.apple.pkpass')
  })
})
