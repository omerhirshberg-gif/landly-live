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

  it('centres the code as a Code 128 barcode with the code as text, never a QR', () => {
    expect(json.barcodes).toEqual([expect.objectContaining({ format: 'PKBarcodeFormatCode128', message: 'RY-4821-7730-19', altText: 'RY-4821-7730-19' })])
    expect(buildPassJson({ ...voucher, externalCode: 'קוד-עברית' }, identity, null).barcodes).toEqual([])
  })

  it('lays the front out beneath a text-free strip: offer, then issuer and redemption, the code in the barcode', () => {
    const t = json.eventTicket
    expect(t.headerFields[0]).toMatchObject({ key: 'expires' })
    expect(t.primaryFields).toEqual([])
    expect(t.secondaryFields).toEqual([
      expect.objectContaining({ key: 'offer', label: 'FOX', value: 'תו על 100' }),
    ])
    // A code Code 128 cannot carry stays on the front as text.
    const text = buildPassJson({ ...voucher, externalCode: 'קוד-עברית' }, identity, null).eventTicket.secondaryFields
    expect(text[1]).toMatchObject({ key: 'code', value: 'קוד-עברית' })
    expect(t.auxiliaryFields).toEqual([
      expect.objectContaining({ key: 'issuer', label: 'Issued by', value: 'Raayonit Ltd.' }),
      expect.objectContaining({ key: 'redemption', label: 'Redemption', value: 'In store' }),
    ])
  })

  it('carries the issuer, the five-year note and the order on the back, and the expiry on the front', () => {
    const back = json.eventTicket.backFields.map((f) => f.key)
    expect(back.slice(0, 4)).toEqual(['issuerBack', 'multiChain', 'order', 'member'])
    expect(json.eventTicket.backFields[0]!.value).toBe('Valid for 5 years from purchase')
    expect(json.eventTicket.headerFields[0]).toMatchObject({ key: 'expires', value: '2031-11-17T21:59:59Z' })
    expect(json.expirationDate).toBe('2031-11-17T21:59:59Z')
  })

  it('explains the Multi-Chain Super Tav on the back, with the live chain count, and keeps the front clean', () => {
    const back = (j: typeof json) => j.eventTicket.backFields.find((f) => f.key === 'multiChain')!
    expect(back(json)).toMatchObject({ label: 'Multi-Chain Super Tav' })
    expect(back(json).value).not.toContain('{count}')
    const counted = buildPassJson({ ...voucher, chainCount: 246 }, identity, null, null)
    expect(back(counted).value).toContain('240+')
    expect(JSON.stringify(json.eventTicket.secondaryFields)).not.toContain('Super Tav')
    expect(passStrings({ ...voucher, chainCount: 246 }, 'he')[back(counted).value]).toContain('240+')
  })

  it('puts paid / voucher value on the back when the amounts are known', () => {
    const paid = buildPassJson({ ...voucher, amountAgorot: 7900, faceValueAgorot: 10000 }, identity, null, null)
    expect(paid.eventTicket.backFields.find((f) => f.key === 'paidValue')).toMatchObject({ value: '₪79 / ₪100' })
    expect(json.eventTicket.backFields.some((f) => f.key === 'paidValue')).toBe(false)
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

  it('leaves the strip free of any logo: the brand colour without a photo', async () => {
    expect(await loadStripImages('', 'no-such-category')).toEqual({})
  })

  it('builds a complete mock bundle', async () => {
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
    // A title that is the business itself carries no label: no "Super Tav" over "Super Tav".
    expect(buildPassJson({ ...voucher, businessName: 'Super Tav', offerTitle: 'Super Tav' }, identity, null).eventTicket.secondaryFields[0]).not.toHaveProperty('label')
    expect(offerWithoutBusiness('Mega Sport', 'Mega Sport')).toBe('Mega Sport')
    expect(offerWithoutBusiness('Gift card', 'Mega Sport')).toBe('Gift card')
    expect(buildPassJson({ ...voucher, businessName: 'FOX', offerTitle: 'Gift card' }, identity, null).description).toBe('FOX — Gift card')
  })
})
