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
import { redemptionSteps } from '@/lib/offers/redemption'
import type { PassConfig, PassIdentity } from './passConfig'
import type { PassVoucher } from './passVoucher'

// A voucher as an Apple Wallet pass. A static pass: it has no webServiceURL,
// so it never changes once added, and a redeemed or refunded voucher keeps
// looking valid until `expirationDate`. Everything on it is the voucher's
// purchase snapshot, never the live offer, like every other voucher screen; the
// one exception is the member's name, as it was when they added the pass.
//
// An event ticket, though a voucher is no event: on a strip pass Wallet draws
// the primary field over the image, so a clean photo means no primary field, and
// only this style has two rows under the strip (a coupon has one). Its columns
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

interface PassText {
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
}

function passText(voucher: PassVoucher, lang: Lang): PassText {
  const t = (key: TranslationKey) => translations[lang][key]
  const offer = localizeText(voucher.offerTitle, voucher.translations, lang, 'title').text
  const business = localizedBusinessName(voucher, lang).text
  const instructions = localizeText(voucher.redemptionInstructions, voucher.translations, lang, 'redemptionInstructions').text
  const steps = redemptionSteps(voucher.redemptionMethod, instructions, t)
  return {
    description: `${business} – ${offer}`,
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
  }
}

const field = (key: string, label: string, value: string) => ({ key, label, value })

/**
 * pass.json. `discountPercent` and `holderName` are left out when there's none.
 *   header     valid until, top corner, seen even in a stack of passes
 *   strip      the photo alone
 *   secondary  the business over the offer, the row's full width
 *   auxiliary  order number and member
 *   barcode    centred by Wallet, the redemption code under it
 */
export function buildPassJson(voucher: PassVoucher, identity: PassIdentity, discountPercent: number | null, holderName: string | null = null) {
  const text = passText(voucher, 'en')
  const expires = voucher.expiresAt ? passDate(voucher.expiresAt) : null
  const geo = voucher.businessGeo
  return {
    formatVersion: 1,
    passTypeIdentifier: identity.passTypeId,
    teamIdentifier: identity.teamId,
    serialNumber: passSerialNumber(identity.passTypeId, voucher.id),
    organizationName: 'Landly',
    description: text.description,
    logoText: 'Landly',
    ...PASS_COLORS,
    sharingProhibited: true,
    ...(expires ? { expirationDate: expires } : {}),
    // The same payload as the in-app QR, so a cashier sees one code everywhere.
    barcodes: [{
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
      primaryFields: [],
      secondaryFields: [{ key: 'offer', value: text.offer, ...(text.business ? { label: text.business } : {}) }],
      auxiliaryFields: [
        ...(voucher.displayOrderNumber ? [field('order', text.labelOrder, voucher.displayOrderNumber)] : []),
        ...(holderName ? [field('member', text.labelMember, holderName)] : []),
      ],
      backFields: [
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

/** The offer's photo, or its category's, cropped for each scale. Wallet shows the brand colour with neither. */
export async function loadStripImages(imageUrl: string, category: string): Promise<Record<string, Buffer>> {
  for (const source of [imageUrl ? await remoteImage(imageUrl) : null, await categoryPhoto(category)]) {
    if (!source) continue
    try {
      const entries = await Promise.all(STRIP_SCALES.map(async ([name, scale]) => [
        name,
        await sharp(source).resize(STRIP_WIDTH * scale, STRIP_HEIGHT * scale, { fit: 'cover' }).png({ compressionLevel: 9, palette: true }).toBuffer(),
      ] as const))
      return Object.fromEntries(entries)
    } catch {
      // Not an image sharp can read: try the next source.
    }
  }
  return {}
}

async function staticImages(): Promise<Record<string, Buffer>> {
  const entries = await Promise.all(STATIC_IMAGES.map(async (name) => [name, await readFile(join(process.cwd(), 'lib', 'wallet', 'assets', name))] as const))
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
  const files: Record<string, Buffer> = await atStage('assets', async () => ({
    'pass.json': Buffer.from(JSON.stringify(json)),
    ...(await staticImages()),
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
    pass.setBarcodes(...json.barcodes)
    if (voucher.expiresAt) pass.setExpirationDate(voucher.expiresAt)
    if (json.locations) pass.setLocations(...json.locations)
    for (const [lang, entries] of Object.entries(strings)) pass.localize(lang, entries)
    return pass.getAsBuffer()
  })
}
