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

// A voucher as a Google Wallet pass: a GenericClass (one per environment: the two-column row layout every GoLandly
// voucher shares) and a GenericObject (one per voucher: its title, codes and details). A Generic pass is what lets each
// voucher carry its own title, issuer line, logo and hero, as the Apple pass does (an Offer pass shows only its class's
// title). The older Offer classes (golandly_voucher_*) stay registered so passes already saved keep working.
// A static snapshot like the Apple pass: nothing is patched when the voucher is redeemed or cancelled, and it keeps
// looking valid until `validTimeInterval` ends. The save link is a "skinny" JWT: it only names the object, which is
// upserted through the REST API first (lib/wallet/googleWalletApi.ts), so it stays far under the link length limit.
//
// Strings travel in all five languages as LocalizedString.translatedValues and Wallet picks by the device's language.
// Wallet can't nest an isolate element, so in Hebrew a code, an order number, a date, a percentage or a price is bracketed
// with Unicode isolate marks (as the native privacy screen does).
//
// Images (the logo and the hero) are fetched by Google's servers when the object is saved, so they always come from a
// public https origin (`config.assetOrigin`: the deployment, else WALLET_ASSET_ORIGIN, else the live site), never localhost.

export type GoogleWalletConfigReady = Extract<GoogleWalletConfig, { mode: 'ready' }>
export const GOOGLE_SAVE_URL = 'https://pay.google.com/gp/v/save/'
const PASS_BACKGROUND = '#0B1B3D'
const LOGO_PATH = '/wallet/google/logo.png'
const HERO_PATH = '/wallet/google/hero.png'
const TIME_ZONE = 'Asia/Jerusalem'
const DATE_LOCALES: Record<Lang, string> = { he: 'he-IL', en: 'en-GB', ru: 'ru-RU', fr: 'fr-FR', es: 'es-ES' }

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
const textField = (id: string) => ({ firstValue: { fields: [{ fieldPath: `object.textModulesData['${id}']` }] } })

/** The two-column rows under the barcode: issuer | redemption, then order | valid until. */
const CARD_ROWS = [['issuer', 'redemption'], ['order', 'validUntil']] as const
/** The details list, in order: everything except the four fields already shown in the rows (Wallet would repeat them). */
const DETAIL_IDS = ['code', 'member', 'paidValue', 'discount', 'multiChain', 'how', 'terms', 'address'] as const

export function buildGenericClass(config: GoogleWalletConfigReady) {
  return {
    id: config.classId,
    multipleDevicesAndHoldersAllowedStatus: 'ONE_USER_ALL_DEVICES',
    classTemplateInfo: {
      cardTemplateOverride: {
        cardRowTemplateInfos: CARD_ROWS.map(([start, end]) => ({ twoItems: { startItem: textField(start), endItem: textField(end) } })),
      },
      detailsTemplateOverride: { detailsItemInfos: DETAIL_IDS.map((id) => ({ item: textField(id) })) },
    },
  }
}

export interface GooglePassOptions {
  discountPercent: number | null
  holderName?: string | null
}

/** "22 Nov 2031" in the reader's language, in Israel's time zone (the voucher's expiry is shown as a date only). */
function expiryText(expiresAt: Date | null, lang: Lang): string {
  if (!expiresAt) return '—'
  return ltr(lang, new Intl.DateTimeFormat(DATE_LOCALES[lang], { day: 'numeric', month: 'short', year: 'numeric', timeZone: TIME_ZONE }).format(expiresAt))
}

export function buildGenericObject(voucher: PassVoucher, config: GoogleWalletConfigReady, options: GooglePassOptions) {
  const codeOnly = voucher.redemptionKind === 'code_only'
  const codeBarcode = codeOnly && !!voucher.externalCode
  const value = resolveVoucherValue(voucher)
  const holderName = options.holderName?.trim() || null
  const discount = options.discountPercent && options.discountPercent > 0 ? options.discountPercent : null

  const text = (lang: Lang) => passText(voucher, lang)
  const t = (lang: Lang) => translations[lang]
  type Module = { id: string; header: (lang: Lang) => string; body: (lang: Lang) => string }
  const modules: (Module | null)[] = [
    // The four fields of the two rows are always present (the class template names them): a stand-in dash, never a hole.
    { id: 'issuer', header: (l) => t(l).wallet_pass_issued_by, body: (l) => text(l).issuerName || text(l).business || 'GoLandly' },
    { id: 'redemption', header: (l) => text(l).labelRedemption, body: (l) => text(l).method },
    { id: 'order', header: (l) => text(l).labelOrder, body: (l) => (voucher.displayOrderNumber ? ltr(l, voucher.displayOrderNumber) : '—') },
    { id: 'validUntil', header: (l) => text(l).labelValidUntil, body: (l) => expiryText(voucher.expiresAt, l) },
    codeOnly && voucher.externalCode ? { id: 'code', header: (l) => text(l).labelCode, body: (l) => ltr(l, voucher.externalCode!) } : null,
    holderName ? { id: 'member', header: (l) => text(l).labelMember, body: () => holderName } : null,
    value ? { id: 'paidValue', header: (l) => text(l).labelPaidValue, body: (l) => ltr(l, formatValueRatio(value)) } : null,
    discount ? { id: 'discount', header: (l) => text(l).labelDiscount, body: (l) => ltr(l, `${discount}%`) } : null,
    codeOnly && text('en').multiChain ? { id: 'multiChain', header: (l) => text(l).labelMultiChain, body: (l) => text(l).multiChain } : null,
    { id: 'how', header: (l) => text(l).labelHow, body: (l) => text(l).how },
    text('en').terms ? { id: 'terms', header: (l) => text(l).labelTerms, body: (l) => text(l).terms } : null,
    voucher.businessAddress ? { id: 'address', header: (l) => text(l).labelAddress, body: (l) => localizedName(voucher.businessAddress!.formatted, l) } : null,
  ]
  const image = (path: string, description: string) => ({ sourceUri: { uri: `${config.assetOrigin}${path}` }, contentDescription: { defaultValue: { language: 'en' as const, value: description } } })
  // Never the voucher's own page: its id holds the member's uid, which must not leave in a pass. The member area opens it.
  const linkOrigin = config.siteOrigin ?? config.assetOrigin

  return {
    id: googleObjectId(config, voucher.id),
    classId: config.classId,
    state: 'ACTIVE',
    hexBackgroundColor: PASS_BACKGROUND,
    logo: image(LOGO_PATH, 'GoLandly'),
    cardTitle: localized(() => 'GoLandly'),
    // The issuer line for a Raayonit voucher, else the merchant.
    subheader: localized((l) => text(l).issuer ? `${text(l).issuer} ${text(l).issuerName}`.trim() : text(l).business || text(l).issuerName),
    // The deduplicated offer title, never a fixed string.
    header: localized((l) => text(l).offer || text(l).business || 'GoLandly'),
    heroImage: image(HERO_PATH, 'GoLandly'),
    // A Raayonit voucher is a code and nothing else: its code as Code 128. Any other: the redeem link's QR, the code under it.
    barcode: codeBarcode
      ? { type: 'CODE_128', value: voucher.externalCode!, alternateText: voucher.externalCode! }
      : { type: 'QR_CODE', value: voucherRedeemUrl(redeemVoucherKey(voucher)), alternateText: voucher.redemptionCode },
    ...(voucher.expiresAt ? { validTimeInterval: { end: { date: voucher.expiresAt.toISOString() } } } : {}),
    textModulesData: modules.flatMap((m) => (m ? [{ id: m.id, header: m.header('en'), body: m.body('en'), localizedHeader: localized(m.header), localizedBody: localized(m.body) }] : [])),
    linksModuleData: { uris: [{ id: 'member', uri: `${linkOrigin}/member`, description: translations.en.wallet_google_link_label, localizedDescription: localized((l) => t(l).wallet_google_link_label) }] },
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
    payload: { genericObjects: [{ id: objectId }] },
  }))
  const signature = createSign('RSA-SHA256').update(`${header}.${payload}`).sign(config.privateKey).toString('base64url')
  return `${header}.${payload}.${signature}`
}

export const googleSaveUrl = (jwt: string) => `${GOOGLE_SAVE_URL}${jwt}`
