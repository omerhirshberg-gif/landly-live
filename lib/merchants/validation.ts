// Field rules for merchant onboarding. Pure and client-safe: the form checks
// as you type, the server checks again before anything is stored.

export const LEGAL_ENTITY_TYPES = ['osek_patur', 'osek_murshe', 'company', 'nonprofit'] as const
export type LegalEntityType = (typeof LEGAL_ENTITY_TYPES)[number]
export const isLegalEntityType = (v: unknown): v is LegalEntityType => typeof v === 'string' && (LEGAL_ENTITY_TYPES as readonly string[]).includes(v)

/** Companies and nonprofits are identified by a public ח.פ; sole traders by a personal ID, which is never shown. */
export const isPublicTaxId = (type: LegalEntityType) => type === 'company' || type === 'nonprofit'

/** An Israeli ID / ח.פ: 9 digits (left-padded) with the standard check digit. */
export function isValidIsraeliId(value: string): boolean {
  if (!/^\d{5,9}$/.test(value)) return false
  const digits = value.padStart(9, '0')
  let sum = 0
  for (let i = 0; i < 9; i++) {
    const product = Number(digits[i]) * (i % 2 === 0 ? 1 : 2)
    sum += product > 9 ? product - 9 : product
  }
  return sum % 10 === 0
}

export const isBankCode = (v: string) => /^\d{2}$/.test(v)
export const isBranchCode = (v: string) => /^\d{3}$/.test(v)
export const isAccountNumber = (v: string) => /^\d{4,9}$/.test(v)

export const isEmail = (v: string) => v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

/** A phone as typed, reduced to digits and an optional leading +; null if it can't be a number. */
export function normalizePhone(v: string): string | null {
  const cleaned = v.replace(/[\s().-]/g, '')
  return /^\+?\d{9,15}$/.test(cleaned) ? cleaned : null
}

export interface OnboardingFields {
  legalEntityType: string
  legalName: string
  taxId: string
  signatoryName: string
  signatoryId: string
  signatoryRole: string
  bankCode: string
  branchCode: string
  accountNumber: string
}

export type OnboardingField = keyof OnboardingFields

const digits = (v: string) => v.replace(/\D/g, '')

/** The cleaned fields, or the first problem per field. Messages are keys the page translates. */
export function validateOnboarding(raw: Record<string, unknown>):
  | { ok: true; fields: OnboardingFields & { legalEntityType: LegalEntityType } }
  | { ok: false; errors: Partial<Record<OnboardingField, string>> } {
  const str = (k: string) => (typeof raw[k] === 'string' ? (raw[k] as string).trim() : '')
  const f: OnboardingFields = {
    legalEntityType: str('legalEntityType'), legalName: str('legalName'), taxId: digits(str('taxId')),
    signatoryName: str('signatoryName'), signatoryId: digits(str('signatoryId')), signatoryRole: str('signatoryRole'),
    bankCode: digits(str('bankCode')), branchCode: digits(str('branchCode')), accountNumber: digits(str('accountNumber')),
  }
  const errors: Partial<Record<OnboardingField, string>> = {}
  if (!isLegalEntityType(f.legalEntityType)) errors.legalEntityType = 'invalid'
  if (f.legalName.length < 2 || f.legalName.length > 120) errors.legalName = 'invalid'
  if (!isValidIsraeliId(f.taxId)) errors.taxId = 'invalid'
  if (f.signatoryName.length < 2 || f.signatoryName.length > 100) errors.signatoryName = 'invalid'
  if (!isValidIsraeliId(f.signatoryId)) errors.signatoryId = 'invalid'
  if (f.signatoryRole.length < 2 || f.signatoryRole.length > 60) errors.signatoryRole = 'invalid'
  if (!isBankCode(f.bankCode)) errors.bankCode = 'invalid'
  if (!isBranchCode(f.branchCode)) errors.branchCode = 'invalid'
  if (!isAccountNumber(f.accountNumber)) errors.accountNumber = 'invalid'
  if (Object.keys(errors).length) return { ok: false, errors }
  return { ok: true, fields: { ...f, taxId: f.taxId.padStart(9, '0'), signatoryId: f.signatoryId.padStart(9, '0'), legalEntityType: f.legalEntityType as LegalEntityType } }
}
