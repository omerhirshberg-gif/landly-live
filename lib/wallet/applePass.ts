import 'server-only'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import * as doNotZip from 'do-not-zip'
import { PKPass } from 'passkit-generator'
import sharp from 'sharp'
import { localizedBusinessName } from '@/lib/business/businessText'
import { CATEGORY_TILES } from '@/lib/categories'
import { localizedName } from '@/lib/geo'
import { CONTENT_LANGS, localizeText } from '@/lib/i18n/contentTranslation'
import { translations, type Lang, type TranslationKey } from '@/lib/i18n/translations'
import { redeemVoucherKey, voucherRedeemUrl } from '@/lib/offers/redeemLink'
import { REDEMPTION_METHOD_LABEL_KEYS, redemptionSteps } from '@/lib/offers/redemption'
import { issuerLine } from '@/lib/payments/issuer'
import { isRaayonitMultiChain, withChainCount } from '@/lib/offers/multiChainNote'
import { formatValueRatio, resolveVoucherValue } from '@/lib/vouchers/voucherValue'
import type { PassConfig, PassIdentity } from './passConfig'
import type { PassVoucher } from './passVoucher'

// A voucher as an Apple Wallet pass. A static pass: it has no webServiceURL,
// so it never changes once added, and a redeemed or refunded voucher keeps
// looking valid until `expirationDate`. Everything on it is the voucher's
// purchase snapshot, never the live offer, like every other voucher screen; the
// one exception is the member's name, as it was when they added the pass.
//
// An event ticket, though a voucher is no event: on a strip pass Wallet draws
// the primary field over the image, so a clean photo means no primary field (the
// offer's title is the first secondary field), and only this style has two rows
// under the strip (a coupon has one). Its columns
// keep natural alignment: an explicit right wouldn't mirror in Hebrew.
//
// pass.json itself is written in English. Wallet swaps each string for its
// entry in <lang>.lproj/pass.strings, picked by the device's language (not the
// app's), so all five languages travel in one file.

export const PKPASS_MIME_TYPE = 'application/vnd.apple.pkpass'

const STATIC_IMAGES = ['icon.png', 'icon@2x.png', 'icon@3x.png', 'logo.png', 'logo@2x.png', 'logo@3x.png'] as const
const STRIP_WIDTH = 375
const STRIP_HEIGHT = 98
const STRIP_SCALES = [['strip.png', 1], ['strip@2x.png', 2], ['strip@3x.png', 3]] as const
const IMAGE_TIMEOUT_MS = 2500
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const MOCK_SIGNATURE = 'LANDLY MOCK PASS: UNSIGNED. WALLET WILL REJECT THIS BUNDLE.\n'
// Wallet takes opaque colours only, so the labels' soft tint is a solid one. Background: `ink`.
const PASS_COLORS = {
  backgroundColor: 'rgb(11,27,61)',
  foregroundColor: 'rgb(255,255,255)',
  labelColor: 'rgb(180,194,220)',
} as const

/** The stable, opaque serial: the voucher id holds the member's uid, so it never leaves in a pass. */
export function passSerialNumber(passTypeId: string, voucherId: string): string {
  return createHash('sha256').update(`landly-wallet:${passTypeId}:${voucherId}`).digest('hex').slice(0, 32)
}

/** Whole seconds, the W3C form Wallet documents. */
const passDate = (date: Date) => date.toISOString().replace(/\.\d{3}Z$/, 'Z')

export interface PassText {
  description: string
  offer: string
  business: string
  how: string
  terms: string
  address: string
  nearby: string
  labelValidUntil: string
  labelDiscount: string
  labelHow: string
  labelTerms: string
  labelAddress: string
  labelOrder: string
  labelMember: string
  /** A code-only voucher: the attribution line and the code's label ('' for any other). */
  issuer: string
  /** A code-only voucher's front: the label and name of the issuer, and how the voucher is redeemed. */
  labelIssuedBy: string
  issuerName: string
  labelRedemption: string
  method: string
  labelCode: string
  validYears: string
  /** A Raayonit voucher's back: the Multi-Chain Super Tav explanation and its label ('' for any other). */
  labelMultiChain: string
  multiChain: string
  /** Paid against the voucher's full worth ("₪79 / ₪100"): language-independent, so only its label is translated. */
  labelPaidValue: string
}

/**
 * The offer's title without the business's name when it starts with it ("Mega Sport — Super Tav" under "Mega Sport"),
 * so neither the pass's description nor its offer row says the business twice. Whole title kept when nothing else is left.
 */
export function offerWithoutBusiness(offer: string, business: string): string {
  const name = business.trim()
  const title = offer.trim()
  if (!name || title.toLocaleLowerCase().indexOf(name.toLocaleLowerCase()) !== 0) return offer
  const rest = title.slice(name.length).replace(/^[\s\-–—:·|,]+/, '')
  return rest || offer
}

export function passText(voucher: PassVoucher, lang: Lang): PassText {
  const t = (key: TranslationKey) => translations[lang][key]
  const business = localizedBusinessName(voucher, lang).text
  const offer = offerWithoutBusiness(localizeText(voucher.offerTitle, voucher.translations, lang, 'title').text, business)
  const instructions = localizeText(voucher.redemptionInstructions, voucher.translations, lang, 'redemptionInstructions').text
  const codeOnly = voucher.redemptionKind === 'code_only'
  const steps = redemptionSteps(voucher.redemptionMethod, instructions, t, codeOnly)
  const multiChain = isRaayonitMultiChain(voucher)
  const value = resolveVoucherValue(voucher)
  return {
    description: business ? `${business} — ${offer}` : offer,
    offer,
    business,
    how: steps.map((step, i) => `${i + 1}. ${step}`).join('\n'),
    terms: localizeText(voucher.redemptionTerms, voucher.translations, lang, 'redemptionTerms').text,
    address: voucher.businessAddress ? localizedName(voucher.businessAddress.formatted, lang) : '',
    nearby: t('wallet_pass_nearby'),
    labelValidUntil: t('wallet_pass_valid_until'),
    labelDiscount: t('wallet_pass_discount'),
    labelHow: t('redeem_how_title'),
    labelTerms: t('voucher_redemption_terms_label'),
    labelAddress: t('wallet_pass_address'),
    labelOrder: t('success_order_number_label'),
    labelMember: t('wallet_pass_member'),
    issuer: voucher.issuer ? issuerLine(voucher.issuer, lang) : '',
    // Without Raayonit's approval (display flag off) the issuer is null and the pass says only that it is a multi-chain voucher.
    labelIssuedBy: voucher.issuer ? t('wallet_pass_issued_by') : '',
    issuerName: voucher.issuer ? t('wallet_pass_issuer_name') : codeOnly ? t('multi_chain_voucher_label') : '',
    labelRedemption: t('wallet_pass_redemption'),
    method: t(REDEMPTION_METHOD_LABEL_KEYS[voucher.redemptionMethod]),
    labelCode: t('voucher_redemption_code_label'),
    validYears: voucher.issuer || codeOnly ? t('voucher_valid_years') : '',
    labelMultiChain: multiChain ? (voucher.issuer ? t('super_card_title') : t('multi_chain_voucher_label')) : '',
    multiChain: multiChain ? (voucher.issuer ? withChainCount(t('wallet_pass_multi_chain'), voucher.chainCount) : t('wallet_pass_multi_chain_neutral')) : '',
    labelPaidValue: value ? t('wallet_pass_paid_value') : '',
  }
}

const field = (key: string, label: string, value: string) => ({ key, label, value })

/**
 * pass.json. `discountPercent` and `holderName` are left out when there's none.
 *   header     valid until, top corner, seen even in a stack of passes
 *   strip      the photo alone
 *   primary    none: Wallet would draw it over the photo
 *   secondary  the business over the offer, then (a Raayonit pass) the redemption code
 *   auxiliary  order number and member
 *   barcode    centred by Wallet, the redemption code under it (a Raayonit pass: its code as Code 128)
 */
export function buildPassJson(voucher: PassVoucher, identity: PassIdentity, discountPercent: number | null, holderName: string | null = null) {
  const text = passText(voucher, 'en')
  const value = resolveVoucherValue(voucher)
  const expires = voucher.expiresAt ? passDate(voucher.expiresAt) : null
  const geo = voucher.businessGeo
  // A Raayonit voucher is a code and nothing else (no redeem link): the code is a Code 128 barcode, centred by Wallet
  // with the code as text under it, so a cashier scans or reads it without flipping the pass. A code that is not plain
  // ASCII (Code 128's range) is left as text on the front instead.
  const codeOnly = voucher.redemptionKind === 'code_only' && !!voucher.externalCode
  const codeBarcode = codeOnly && /^[\x20-\x7E]+$/.test(voucher.externalCode!)
  // The offer's label is the business, unless the title is the business (a Super Tav) and would say it twice.
  const offerLabel = text.business && text.business.trim().toLocaleLowerCase() !== text.offer.trim().toLocaleLowerCase() ? { label: text.business } : {}
  return {
    formatVersion: 1,
    passTypeIdentifier: identity.passTypeId,
    teamIdentifier: identity.teamId,
    serialNumber: passSerialNumber(identity.passTypeId, voucher.id),
    organizationName: 'GoLandly',
    description: text.description,
    // A Raayonit pass's logo is the GoLandly × Raayonit lockup (assets/logo-raayonit*.png), which carries both brands; any other pass has GoLandly's mark and name.
    ...(codeOnly && voucher.issuer ? {} : { logoText: 'GoLandly' }),
    ...PASS_COLORS,
    sharingProhibited: true,
    ...(expires ? { expirationDate: expires } : {}),
    // The same payload as the in-app QR, so a cashier sees one code everywhere.
    barcodes: codeBarcode ? [{
      format: 'PKBarcodeFormatCode128' as const,
      message: voucher.externalCode!,
      messageEncoding: 'iso-8859-1',
      altText: voucher.externalCode!,
    }] : codeOnly ? [] : [{
      format: 'PKBarcodeFormatQR' as const,
      message: voucherRedeemUrl(redeemVoucherKey(voucher)),
      messageEncoding: 'iso-8859-1',
      altText: voucher.redemptionCode,
    }],
    ...(geo ? { locations: [{ latitude: geo.lat, longitude: geo.lng, relevantText: text.nearby }] } : {}),
    eventTicket: {
      headerFields: expires
        ? [{ ...field('expires', text.labelValidUntil, expires), dateStyle: 'PKDateStyleMedium' as const, timeStyle: 'PKDateStyleNone' as const }]
        : [],
      // The strip carries no text (a primary field would be drawn over the photo). Beneath it, top to bottom: the offer's title, the
      // code (a Raayonit pass: in the barcode below) and, on its own row, who issued it and how it is redeemed. Any other pass: the title, then order and member.
      primaryFields: [],
      secondaryFields: codeOnly
        ? [
            { key: 'offer', value: text.offer, ...offerLabel },
            ...(codeBarcode ? [] : [field('code', text.labelCode, voucher.externalCode!)]),
          ]
        : [{ key: 'offer', value: text.offer, ...offerLabel }],
      auxiliaryFields: codeOnly
        ? [
            field('issuer', text.labelIssuedBy, text.issuerName),
            field('redemption', text.labelRedemption, text.method),
          ]
        : [
            ...(voucher.displayOrderNumber ? [field('order', text.labelOrder, voucher.displayOrderNumber)] : []),
            ...(holderName ? [field('member', text.labelMember, holderName)] : []),
          ],
      backFields: [
        ...(codeOnly ? [
          field('issuerBack', text.issuer || text.issuerName, text.validYears),
          field('multiChain', text.labelMultiChain, text.multiChain),
          ...(voucher.displayOrderNumber ? [field('order', text.labelOrder, voucher.displayOrderNumber)] : []),
          ...(holderName ? [field('member', text.labelMember, holderName)] : []),
        ] : []),
        ...(value ? [field('paidValue', text.labelPaidValue, formatValueRatio(value))] : []),
        field('how', text.labelHow, text.how),
        ...(discountPercent && discountPercent > 0 ? [field('discount', text.labelDiscount, `${discountPercent}%`)] : []),
        ...(text.terms ? [field('terms', text.labelTerms, text.terms)] : []),
        ...(text.address ? [field('address', text.labelAddress, text.address)] : []),
      ],
    },
  }
}

// The library writes "key" = "value"; verbatim, so a quote or a line break in
// a merchant's terms would corrupt the whole file unless escaped first.
const escapeStrings = (text: string) =>
  text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, '\\n')

/** One language's pass.strings: each English string on the pass, mapped to its translation (escaped). */
export function passStrings(voucher: PassVoucher, lang: Lang): Record<string, string> {
  const source = passText(voucher, 'en')
  const target = passText(voucher, lang)
  const strings: Record<string, string> = {}
  for (const key of Object.keys(source) as (keyof PassText)[]) {
    if (source[key]) strings[escapeStrings(source[key])] = escapeStrings(target[key] || source[key])
  }
  return strings
}

async function remoteImage(url: string): Promise<Buffer | null> {
  if (!url.startsWith('https://')) return null
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS) })
    if (!res.ok || !res.headers.get('content-type')?.startsWith('image/')) return null
    const bytes = Buffer.from(await res.arrayBuffer())
    return bytes.length > 0 && bytes.length <= MAX_IMAGE_BYTES ? bytes : null
  } catch {
    return null
  }
}

async function categoryPhoto(category: string): Promise<Buffer | null> {
  const photo = CATEGORY_TILES.find((tile) => tile.category === category)?.photo
  if (!photo) return null
  return readFile(join(process.cwd(), 'public', 'categories', `${photo}.webp`)).catch(() => null)
}

/**
 * The offer's photo, or its category's, cropped for each scale, and nothing drawn on it (the issuer's logo is in
 * Wallet's logo slot already). Wallet shows the brand colour with neither.
 */
export async function loadStripImages(imageUrl: string, category: string): Promise<Record<string, Buffer>> {
  for (const source of [imageUrl ? await remoteImage(imageUrl) : null, await categoryPhoto(category)]) {
    if (!source) continue
    try {
      const entries = await Promise.all(STRIP_SCALES.map(async ([name, scale]) => {
        const image = await sharp(source).resize(STRIP_WIDTH * scale, STRIP_HEIGHT * scale, { fit: 'cover' }).png({ compressionLevel: 9, palette: true }).toBuffer()
        return [name, image] as const
      }))
      return Object.fromEntries(entries)
    } catch {
      // Not an image sharp can read: try the next source.
    }
  }
  return {}
}

/** Wallet's logo slot (at most 160 x 50pt): the GoLandly × Raayonit lockup for a Raayonit pass, else GoLandly's mark. */
const RAAYONIT_LOGOS = { 'logo.png': 'logo-raayonit.png', 'logo@2x.png': 'logo-raayonit@2x.png', 'logo@3x.png': 'logo-raayonit@3x.png' } as const

export async function staticImages(withLockup = false): Promise<Record<string, Buffer>> {
  const source = (name: (typeof STATIC_IMAGES)[number]) => (withLockup && name in RAAYONIT_LOGOS ? RAAYONIT_LOGOS[name as keyof typeof RAAYONIT_LOGOS] : name)
  const entries = await Promise.all(STATIC_IMAGES.map(async (name) => [name, await readFile(join(process.cwd(), 'lib', 'wallet', 'assets', source(name)))] as const))
  return Object.fromEntries(entries)
}

/** The bundle a real signature would cover, zipped by hand: for flows and tests, never for Wallet. */
function mockBundle(files: Record<string, Buffer>, strings: Partial<Record<Lang, Record<string, string>>>): Buffer {
  const all: Record<string, Buffer> = { ...files }
  for (const [lang, entries] of Object.entries(strings)) {
    all[`${lang}.lproj/pass.strings`] = Buffer.from(Object.entries(entries).map(([key, value]) => `"${key}" = "${value}";`).join('\n'))
  }
  const manifest = Object.fromEntries(Object.entries(all).map(([path, data]) => [path, createHash('sha1').update(data).digest('hex')]))
  all['manifest.json'] = Buffer.from(JSON.stringify(manifest))
  all['signature'] = Buffer.from(MOCK_SIGNATURE)
  return doNotZip.toBuffer(Object.entries(all).map(([path, data]) => ({ path, data: [...data] })))
}

/** Where building a pass failed, for the server log. */
export class PassBuildError extends Error {
  constructor(readonly stage: 'assets' | 'sign', cause: unknown) {
    super(cause instanceof Error ? cause.message : 'unknown error')
  }
}

const atStage = async <T>(stage: PassBuildError['stage'], work: () => T | Promise<T>): Promise<T> => {
  try {
    return await work()
  } catch (error) {
    throw new PassBuildError(stage, error)
  }
}

/** The finished .pkpass: signed with the configured certificates, or the unsigned mock. */
export async function buildPkpass(
  voucher: PassVoucher,
  config: Exclude<PassConfig, { mode: 'unavailable' }>,
  options: { discountPercent: number | null; imageUrl: string; category: string; holderName?: string | null },
): Promise<Buffer> {
  const json = buildPassJson(voucher, config, options.discountPercent, options.holderName)
  const raayonit = voucher.redemptionKind === 'code_only' && !!voucher.issuer
  const files: Record<string, Buffer> = await atStage('assets', async () => ({
    'pass.json': Buffer.from(JSON.stringify(json)),
    ...(await staticImages(raayonit)),
    ...(await loadStripImages(options.imageUrl, options.category)),
  }))
  const strings = Object.fromEntries(CONTENT_LANGS.map((lang) => [lang, passStrings(voucher, lang)]))

  if (config.mode === 'mock') return mockBundle(files, strings)

  return atStage('sign', () => {
    const pass = new PKPass(files, {
      wwdr: config.wwdr,
      signerCert: config.signerCert,
      signerKey: config.signerKey,
      signerKeyPassphrase: config.signerKeyPassphrase,
    })
    // These three only reach the bundle through their setters.
    if (json.barcodes.length > 0) pass.setBarcodes(...json.barcodes)
    if (voucher.expiresAt) pass.setExpirationDate(voucher.expiresAt)
    if (json.locations) pass.setLocations(...json.locations)
    for (const [lang, entries] of Object.entries(strings)) pass.localize(lang, entries)
    return pass.getAsBuffer()
  })
}
