// The company behind a pre-bought voucher. Shown with its logo on the offer, the voucher, the
// order email and the Apple Wallet pass; frozen onto the voucher at purchase (claimOfferForOrder).
// Pure, so web, native and the server share it.

import { translations } from '../i18n/translations'

export interface VoucherIssuer {
  id: 'raayonit'
  nameHe: string
  nameEn: string
}

export const RAAYONIT_ISSUER: VoucherIssuer = { id: 'raayonit', nameHe: 'רעיונית בע״מ', nameEn: 'Raayonit Ltd.' }

/** Where the logo lives under the web `public/` folder; the official logo (on white). */
export const RAAYONIT_LOGO_PATH = '/images/partners/raayonit-logo.png'

/** How many years a Raayonit voucher stays valid from its purchase. */
export const RAAYONIT_VALIDITY_YEARS = 5

export function parseIssuer(value: unknown): VoucherIssuer | null {
  if (!value || typeof value !== 'object') return null
  return (value as { id?: unknown }).id === 'raayonit' ? RAAYONIT_ISSUER : null
}

/**
 * "Issued by Raayonit Ltd." in English, "מונפק באמצעות רעיונית בע״מ" in Hebrew, and the dictionary's
 * translation in the other languages (voucher_issued_by), English when the language is unknown.
 */
export function issuerLine(_issuer: VoucherIssuer, lang: string): string {
  const dictionary = (translations as Record<string, Record<string, string>>)[lang] ?? translations.en
  return dictionary.voucher_issued_by ?? translations.en.voucher_issued_by
}
