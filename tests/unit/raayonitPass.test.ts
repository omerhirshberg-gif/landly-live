import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { buildPassJson, buildPkpass, loadStripImages, offerWithoutBusiness, passStrings, staticImages } from '@/lib/wallet/applePass'
import { DEVELOPMENT_PASS_TYPE_ID, resolvePassConfig } from '@/lib/wallet/passConfig'
import { isPassEligible, type PassVoucher } from '@/lib/wallet/passVoucher'
import { RAAYONIT_ISSUER, issuerLine } from '@/lib/payments/issuer'

const identity = { passTypeId: DEVELOPMENT_PASS_TYPE_ID, teamId: 'ABCDE12345', ticketSecret: 'x'.repeat(32) }
const voucher: PassVoucher = {
  id: 'uid123_fox', userId: 'uid123', offerId: 'fox', businessName: 'FOX', offerTitle: 'תו על 100',
  redemptionCode: '12345678', redeemToken: null, status: 'active', expiresAt: new Date('2031-11-17T21:59:59Z'),
  redemptionTerms: '', redemptionMethod: 'in_store', redemptionInstructions: '', displayOrderNumber: '#1001',
  translations: null, businessTranslations: null, businessAddress: null, businessGeo: null,
  redemptionKind: 'code_only', issuer: RAAYONIT_ISSUER, externalCode: 'RY-4821-7730-19',
}

describe('a Raayonit pass', () => {
  const json = buildPassJson(voucher, identity, 11, 'Dana')

  it('has no barcode of any kind', () => {
    expect(json.barcodes).toEqual([])
  })

  it('lays the front out beneath a text-free strip: offer, code, then issuer and redemption', () => {
    const t = json.eventTicket
    expect(t.headerFields[0]).toMatchObject({ key: 'expires' })
    expect(t.primaryFields).toEqual([])
    expect(t.secondaryFields).toEqual([
      expect.objectContaining({ key: 'offer', label: 'FOX', value: 'תו על 100' }),
      expect.objectContaining({ key: 'code', label: 'Redemption Code', value: 'RY-4821-7730-19' }),
    ])
    expect(t.auxiliaryFields).toEqual([
      expect.objectContaining({ key: 'issuer', label: 'Issued by', value: 'Raayonit Ltd.' }),
      expect.objectContaining({ key: 'redemption', label: 'Redemption', value: 'In store' }),
    ])
  })

  it('carries the issuer, the five-year note and the order on the back, and the expiry on the front', () => {
    const back = json.eventTicket.backFields.map((f) => f.key)
    expect(back.slice(0, 3)).toEqual(['issuerBack', 'order', 'member'])
    expect(json.eventTicket.backFields[0]!.value).toBe('Valid for 5 years from purchase')
    expect(json.eventTicket.headerFields[0]).toMatchObject({ key: 'expires', value: '2031-11-17T21:59:59Z' })
    expect(json.expirationDate).toBe('2031-11-17T21:59:59Z')
  })

  it('leaves the standard steps, which mention a QR code, out of the how-to', () => {
    const how = json.eventTicket.backFields.find((f) => f.key === 'how')!.value
    expect(how).toContain('There is no QR code')
    expect(how).not.toMatch(/show your voucher’s QR code/i)
  })

  it('translates the attribution line for the Hebrew lproj', () => {
    expect(issuerLine(RAAYONIT_ISSUER, 'he')).toBe('מונפק ומכובד ע״י רעיונית בע״מ')
    expect(passStrings(voucher, 'he')['Raayonit Ltd.']).toBe('רעיונית בע״מ')
    expect(passStrings(voucher, 'he')['Issued by']).toBe('מונפק על ידי')
  })

  it('is eligible with its code and no redeem token, but not without a code', () => {
    expect(isPassEligible(voucher, Date.parse('2027-01-01'))).toBe(true)
    expect(isPassEligible({ ...voucher, externalCode: null }, Date.parse('2027-01-01'))).toBe(false)
  })

  it('keeps the QR on any other voucher', () => {
    const plain = buildPassJson({ ...voucher, redemptionKind: null, issuer: null, externalCode: null, redeemToken: 'a'.repeat(32) }, identity, null)
    expect(plain.barcodes).toHaveLength(1)
    expect(plain.eventTicket.auxiliaryFields[0]).toMatchObject({ key: 'order' })
    expect(plain.eventTicket.primaryFields).toEqual([])
    expect(plain.eventTicket.secondaryFields[0]).toMatchObject({ key: 'offer' })
  })

  it('composites the issuer badge into the strip’s top end corner, on the brand colour when the offer has no photo', async () => {
    const plain = await loadStripImages('', 'no-such-category')
    expect(plain).toEqual({})
    const badged = await loadStripImages('', 'no-such-category', true)
    expect(Object.keys(badged).sort()).toEqual(['strip.png', 'strip@2x.png', 'strip@3x.png'])
    const meta = await sharp(badged['strip@2x.png']).metadata()
    expect([meta.width, meta.height]).toEqual([750, 196])
    // The strip is the brand navy, except where the white badge sits in the top end corner; the strip carries no text.
    const { data, info } = await sharp(badged['strip@2x.png']).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const px = (x: number, y: number) => [...data.subarray((y * info.width + x) * 4, (y * info.width + x) * 4 + 3)]
    expect(px(20, 20)).toEqual([11, 27, 61])
    const bright = (p: number[]) => p[0]! > 200 && p[1]! > 200
    expect(bright(px(info.width - 40, 60))).toBe(true)
    expect(bright(px(40, info.height - 30))).toBe(false)
    expect(bright(px(info.width - 40, info.height - 10))).toBe(false)
  })

  it('builds a complete mock bundle with the badged strip', async () => {
    const config = resolvePassConfig({}, 'local', 'test')
    if (config.mode === 'unavailable') throw new Error('mock config expected')
    const zip = await buildPkpass(voucher, config, { discountPercent: null, imageUrl: '', category: '', holderName: null })
    expect(zip.byteLength).toBeGreaterThan(1000)
  })

  it('carries the GoLandly x Raayonit lockup in the logo slot, and no logo text beside it', async () => {
    expect(json).not.toHaveProperty('logoText')
    const lockup = await staticImages(true)
    const plain = await staticImages(false)
    for (const [name, height] of [['logo.png', 50], ['logo@2x.png', 100], ['logo@3x.png', 150]] as const) {
      const meta = await sharp(lockup[name]).metadata()
      expect(meta.height).toBe(height)
      // Wallet's logo slot is at most 160 x 50pt.
      expect(meta.width! / (height / 50)).toBeLessThanOrEqual(160)
      expect(lockup[name].equals(plain[name])).toBe(false)
    }
    expect(buildPassJson({ ...voucher, redemptionKind: null, issuer: null, externalCode: null, redeemToken: 'a'.repeat(32) }, identity, null).logoText).toBe('GoLandly')
  })

  it('never says the business twice in the description or the offer row', () => {
    const dup = { ...voucher, businessName: 'Mega Sport', offerTitle: 'Mega Sport — Super Tav' }
    const pass = buildPassJson(dup, identity, null)
    expect(pass.description).toBe('Mega Sport — Super Tav')
    expect(pass.eventTicket.secondaryFields[0]).toMatchObject({ label: 'Mega Sport', value: 'Super Tav' })
    expect(offerWithoutBusiness('Mega Sport', 'Mega Sport')).toBe('Mega Sport')
    expect(offerWithoutBusiness('Gift card', 'Mega Sport')).toBe('Gift card')
    expect(buildPassJson({ ...voucher, businessName: 'FOX', offerTitle: 'Gift card' }, identity, null).description).toBe('FOX — Gift card')
  })
})
