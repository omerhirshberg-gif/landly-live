import 'server-only'
import { createHash, createSign } from 'node:crypto'
import { localizedBusinessName } from '@/lib/business/businessText'
import { localizedName } from '@/lib/geo'
import { CONTENT_LANGS } from '@/lib/i18n/contentTranslation'
import { translations, type Lang } from '@/lib/i18n/translations'
import { isolate } from '@/lib/legal/bidi'
import { redeemVoucherKey, voucherRedeemUrl } from '@/lib/offers/redeemLink'
import { formatValueRatio, resolveVoucherValue } from '@/lib/vouchers/voucherValue'
import { passText } from './applePass'
import type { GoogleWalletConfig } from './passConfig'
import type { PassVoucher } from './passVoucher'

// A voucher as a Google Wallet pass: an OfferClass (one per environment, the look every
// GoLandly voucher shares) and an OfferObject (one per voucher, its codes and details).
// A static snapshot like the Apple pass: nothing is patched when the voucher is redeemed
// or cancelled, and it keeps looking valid until `validTimeInterval` ends. The save link is
// a "skinny" JWT: it only names the object, which is upserted through the REST API first
// (lib/wallet/googleWalletApi.ts), so it stays far under the link length limit.
//
// Strings travel in all five languages as LocalizedString.translatedValues and Wallet
// picks by the device's language. Wallet can't nest an isolate element, so in Hebrew a
// code, an order number, a percentage or a price is bracketed with Unicode isolate marks
// (as the native privacy screen does).

export type GoogleWalletConfigReady = Extract<GoogleWalletConfig, { mode: 'ready' }>
export const GOOGLE_SAVE_URL = 'https://pay.google.com/gp/v/save/'
const PASS_BACKGROUND = '#0B1B3D'

/** The stable, opaque object id suffix: the voucher id holds the member's uid, so it never leaves in a pass. */
export function googleObjectId(config: GoogleWalletConfigReady, voucherId: string): string {
  return `${config.issuerId}.${createHash('sha256').update(`landly-google-wallet:${config.classSuffix}:${voucherId}`).digest('hex').slice(0, 32)}`
}

type Localized = { defaultValue: { language: 'en'; value: string }; translatedValues: { language: Lang; value: string }[] }

/** English as the default, each other language as a translation (those equal to English are left out). */
function localized(valueFor: (lang: Lang) => string): Localized {
  const en = valueFor('en')
  return {
    defaultValue: { language: 'en', value: en },
    translatedValues: CONTENT_LANGS.filter((lang) => lang !== 'en').flatMap((lang) => {
      const value = valueFor(lang)
      return value && value !== en ? [{ language: lang, value }] : []
    }),
  }
}

const ltr = (lang: Lang, token: string) => (lang === 'he' ? isolate(token) : token)

export function buildOfferClass(config: GoogleWalletConfigReady) {
  const title = (lang: Lang) => translations[lang].wallet_google_class_title
  return {
    id: config.classId,
    issuerName: 'GoLandly',
    provider: 'GoLandly',
    title: title('en'),
    localizedTitle: localized(title),
    reviewStatus: 'UNDER_REVIEW',
    redemptionChannel: 'INSTORE',
    countryCode: 'IL',
    hexBackgroundColor: PASS_BACKGROUND,
    multipleDevicesAndHoldersAllowedStatus: 'ONE_USER_ALL_DEVICES',
    ...(config.siteOrigin
      ? { titleImage: { sourceUri: { uri: `${config.siteOrigin}/wallet/google/logo.png` }, contentDescription: { defaultValue: { language: 'en', value: 'GoLandly' } } } }
      : {}),
  }
}

export interface GooglePassOptions {
  discountPercent: number | null
  /** The offer's photo; only a public https URL goes on the pass. */
  imageUrl: string
  holderName?: string | null
}

export function buildOfferObject(voucher: PassVoucher, config: GoogleWalletConfigReady, options: GooglePassOptions) {
  const codeOnly = voucher.redemptionKind === 'code_only'
  const codeBarcode = codeOnly && !!voucher.externalCode
  const value = resolveVoucherValue(voucher)
  const holderName = options.holderName?.trim() || null
  const discount = options.discountPercent && options.discountPercent > 0 ? options.discountPercent : null

  const text = (lang: Lang) => passText(voucher, lang)
  type Module = { id: string; header: (lang: Lang) => string; body: (lang: Lang) => string }
  const modules: (Module | null)[] = [
    { id: 'offer', header: (l) => text(l).business || text(l).labelOrder, body: (l) => text(l).offer },
    codeOnly ? { id: 'redemption', header: (l) => text(l).labelRedemption, body: (l) => text(l).method } : null,
    codeOnly && voucher.externalCode ? { id: 'code', header: (l) => text(l).labelCode, body: (l) => ltr(l, voucher.externalCode!) } : null,
    codeOnly ? { id: 'issuer', header: (l) => text(l).labelIssuedBy || text(l).issuer, body: (l) => [text(l).issuerName, text(l).validYears].filter(Boolean).join(' · ') } : null,
    voucher.displayOrderNumber ? { id: 'order', header: (l) => text(l).labelOrder, body: (l) => ltr(l, voucher.displayOrderNumber!) } : null,
    holderName ? { id: 'member', header: (l) => text(l).labelMember, body: () => holderName } : null,
    value ? { id: 'paidValue', header: (l) => text(l).labelPaidValue, body: (l) => ltr(l, formatValueRatio(value)) } : null,
    discount ? { id: 'discount', header: (l) => text(l).labelDiscount, body: (l) => ltr(l, `${discount}%`) } : null,
    codeOnly && text('en').multiChain ? { id: 'multiChain', header: (l) => text(l).labelMultiChain, body: (l) => text(l).multiChain } : null,
    { id: 'how', header: (l) => text(l).labelHow, body: (l) => text(l).how },
    text('en').terms ? { id: 'terms', header: (l) => text(l).labelTerms, body: (l) => text(l).terms } : null,
    voucher.businessAddress ? { id: 'address', header: (l) => text(l).labelAddress, body: (l) => localizedName(voucher.businessAddress!.formatted, l) } : null,
  ]
  const geo = voucher.businessGeo

  return {
    id: googleObjectId(config, voucher.id),
    classId: config.classId,
    state: 'ACTIVE',
    hexBackgroundColor: PASS_BACKGROUND,
    // A Raayonit voucher is a code and nothing else: its code as Code 128. Any other: the redeem link's QR, the code under it.
    barcode: codeBarcode
      ? { type: 'CODE_128', value: voucher.externalCode!, alternateText: voucher.externalCode! }
      : { type: 'QR_CODE', value: voucherRedeemUrl(redeemVoucherKey(voucher)), alternateText: voucher.redemptionCode },
    ...(voucher.expiresAt ? { validTimeInterval: { end: { date: voucher.expiresAt.toISOString() } } } : {}),
    textModulesData: modules.flatMap((m) => (m ? [{ id: m.id, header: m.header('en'), body: m.body('en'), localizedHeader: localized(m.header), localizedBody: localized(m.body) }] : [])),
    ...(config.siteOrigin && options.imageUrl.startsWith('https://') ? { heroImage: { sourceUri: { uri: options.imageUrl } } } : {}),
    ...(geo ? { locations: [{ latitude: geo.lat, longitude: geo.lng }] } : {}),
  }
}

const base64url = (value: string | Buffer) => Buffer.from(value).toString('base64url')

/** The skinny save JWT: RS256, naming only the object (the class and object are upserted over REST beforehand). */
export function signSaveJwt(config: GoogleWalletConfigReady, objectId: string, nowMs = Date.now()): string {
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = base64url(JSON.stringify({
    iss: config.serviceAccountEmail,
    aud: 'google',
    typ: 'savetowallet',
    iat: Math.floor(nowMs / 1000),
    ...(config.siteOrigin ? { origins: [config.siteOrigin] } : {}),
    payload: { offerObjects: [{ id: objectId }] },
  }))
  const signature = createSign('RSA-SHA256').update(`${header}.${payload}`).sign(config.privateKey).toString('base64url')
  return `${header}.${payload}.${signature}`
}

export const googleSaveUrl = (jwt: string) => `${GOOGLE_SAVE_URL}${jwt}`
