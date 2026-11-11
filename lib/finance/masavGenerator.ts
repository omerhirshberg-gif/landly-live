// The Israeli MASAV clearing flat file (credit transfers): fixed-width text,
// exactly 128 characters a line, three record types:
//   K  header   one per file
//   1  detail   one per payee
//   5  trailer  count and control sum
// Pure functions, no I/O, so the layout can be tested to the column.
//
// Not yet connected to a bank. Until a real institution code is issued the
// file carries the fictitious test codes below and is named MASAV_MOCK_TEST_*,
// so it can't be mistaken for a live transmission.

export const MOCK_INSTITUTION_CODE = '99999999' // 8-char field (מוסד/נושא)
export const MOCK_SENDING_CODE = '99999' // 5-char field (מוסד שולח)
export const MASAV_LINE_LENGTH = 128
export const MASAV_INSTITUTION_NAME = 'LANDLY'
export const MASAV_REFERENCE = 'LANDLY-PAYROLL'
export const MASAV_MOVEMENT_TYPE = '006' // credit transfer (זיכוי)

export interface MasavConfig {
  institutionCode: string
  sendingCode: string
  /** True while the fictitious test codes are in use. */
  isMock: boolean
}

const digitsOnly = (value: string | undefined) => (value ?? '').trim()

/**
 * MASAV_INSTITUTION_CODE (up to 8 digits, zero-padded) and
 * MASAV_SENDING_INSTITUTION_CODE (up to 5 digits). Either missing or empty
 * falls back to its mock value; the file is mock while the institution code is.
 */
export function masavConfig(env: Record<string, string | undefined> = process.env): MasavConfig {
  const inst = digitsOnly(env.MASAV_INSTITUTION_CODE)
  const send = digitsOnly(env.MASAV_SENDING_INSTITUTION_CODE)
  if (inst && !/^\d{1,8}$/.test(inst)) throw new Error('MASAV_INSTITUTION_CODE must be 1 to 8 digits.')
  if (send && !/^\d{1,5}$/.test(send)) throw new Error('MASAV_SENDING_INSTITUTION_CODE must be 1 to 5 digits.')
  const institutionCode = inst ? inst.padStart(8, '0') : MOCK_INSTITUTION_CODE
  return {
    institutionCode,
    sendingCode: send ? send.padStart(5, '0') : MOCK_SENDING_CODE,
    isMock: institutionCode === MOCK_INSTITUTION_CODE,
  }
}

/** MASAV_MOCK_TEST_<timestamp>.dat while mock; MASAV_<YYMMDD>.dat once real. */
export function masavFileName(config: MasavConfig, valueDate: string, now: Date): string {
  if (config.isMock) return `MASAV_MOCK_TEST_${now.toISOString().replace(/\D/g, '').slice(0, 14)}.dat`
  return `MASAV_${yymmdd(valueDate)}.dat`
}

export interface MasavPayment {
  bankCode: string // 2 digits
  branchCode: string // 3 digits
  accountNumber: string // digits
  taxId: string // 9 digits
  name: string
  amountAgorot: number
}

export interface MasavFileInput {
  config: MasavConfig
  valueDate: string // YYYY-MM-DD
  createdAt: string // YYYY-MM-DD
  payments: readonly MasavPayment[]
}

const num = (value: number | string, width: number, label: string) => {
  const text = String(value)
  if (!/^\d+$/.test(text) || text.length > width) throw new Error(`MASAV ${label} "${text}" does not fit ${width} digits.`)
  return text.padStart(width, '0')
}
const text = (value: string, width: number) => value.slice(0, width).padEnd(width, ' ')

/** "2026-11-30" -> "261130". */
export function yymmdd(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) throw new Error(`Invalid date "${isoDate}".`)
  return isoDate.slice(2, 4) + isoDate.slice(5, 7) + isoDate.slice(8, 10)
}

/**
 * A payee's name for the 16-character field: forbidden punctuation ( ) / _ -
 * removed, any other character that isn't a letter or digit (Hebrew or Latin)
 * turned into a space, runs of spaces collapsed, upper-cased, cut to 16.
 */
export function sanitizeMasavName(raw: string): string {
  return raw
    .replace(/[()/_-]/g, '')
    .replace(/[^0-9A-Za-zא-ת ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .slice(0, 16)
    .trimEnd()
}

/** Bank Leumi (10) takes an 8-digit account (positions 28-35, position 27 left 0); every other bank 9 (27-35). */
export function formatAccount(bankCode: string, accountNumber: string): string {
  const digits = accountNumber.replace(/\D/g, '')
  if (bankCode === '10') {
    if (digits.length > 8) throw new Error('A Bank Leumi (10) account number can have at most 8 digits.')
    return '0' + digits.padStart(8, '0')
  }
  if (digits.length > 9) throw new Error('An account number can have at most 9 digits.')
  return digits.padStart(9, '0')
}

export function buildHeader({ config, valueDate, createdAt }: Pick<MasavFileInput, 'config' | 'valueDate' | 'createdAt'>): string {
  return 'K' // 1
    + num(config.institutionCode, 8, 'institution code') // 2-9
    + '00' // 10-11 currency (ILS)
    + yymmdd(valueDate) // 12-17
    + '0' // 18
    + '001' // 19-21 serial
    + '0' // 22
    + yymmdd(createdAt) // 23-28
    + num(config.sendingCode, 5, 'sending institution code') // 29-33
    + '000000' // 34-39
    + text(MASAV_INSTITUTION_NAME, 30) // 40-69
    + ' '.repeat(56) // 70-125
    + 'KOT' // 126-128
}

export function buildDetail(config: MasavConfig, payment: MasavPayment, periodYYMM: string): string {
  if (!/^\d{4}$/.test(periodYYMM)) throw new Error('Payment period must be YYMM.')
  if (!Number.isSafeInteger(payment.amountAgorot) || payment.amountAgorot <= 0) throw new Error('A payment must be a positive whole number of agorot.')
  return '1' // 1
    + num(config.institutionCode, 8, 'institution code') // 2-9
    + '00' // 10-11
    + '000000' // 12-17
    + num(payment.bankCode, 2, 'bank code') // 18-19
    + num(payment.branchCode, 3, 'branch code') // 20-22
    + '0000' // 23-26 account type
    + formatAccount(payment.bankCode, payment.accountNumber) // 27-35
    + '0' // 36
    + num(payment.taxId, 9, 'tax ID') // 37-45
    + text(sanitizeMasavName(payment.name), 16) // 46-61
    + num(payment.amountAgorot, 13, 'amount') // 62-74
    + text(MASAV_REFERENCE, 20) // 75-94
    + periodYYMM + '0000' // 95-102
    + '000' // 103-105
    + MASAV_MOVEMENT_TYPE // 106-108
    + '0'.repeat(18) // 109-126
    + '  ' // 127-128
}

export function buildTrailer(config: MasavConfig, valueDate: string, count: number, totalAgorot: number): string {
  return '5' // 1
    + num(config.institutionCode, 8, 'institution code') // 2-9
    + '00' // 10-11
    + yymmdd(valueDate) // 12-17
    + '0' // 18
    + '001' // 19-21
    + num(totalAgorot, 15, 'control sum') // 22-36
    + '0'.repeat(15) // 37-51
    + num(count, 7, 'record count') // 52-58
    + '0'.repeat(7) // 59-65
    + ' '.repeat(63) // 66-128
}

/** The whole file as text: header, one detail line per payment, trailer, CRLF between lines. */
export function buildMasavFile(input: MasavFileInput): { text: string; lines: string[]; totalAgorot: number } {
  if (input.payments.length === 0) throw new Error('A MASAV file needs at least one payment.')
  const periodYYMM = yymmdd(input.valueDate).slice(0, 4)
  const total = input.payments.reduce((sum, p) => sum + p.amountAgorot, 0)
  const lines = [
    buildHeader(input),
    ...input.payments.map((p) => buildDetail(input.config, p, periodYYMM)),
    buildTrailer(input.config, input.valueDate, input.payments.length, total),
  ]
  for (const line of lines) {
    if (line.length !== MASAV_LINE_LENGTH) throw new Error(`MASAV line is ${line.length} characters, not ${MASAV_LINE_LENGTH}.`)
  }
  return { text: lines.join('\r\n') + '\r\n', lines, totalAgorot: total }
}

/**
 * Windows-1255 (single-byte Hebrew), so a Hebrew name still takes one byte a
 * character and every line stays 128 bytes. Anything outside ASCII and the
 * Hebrew letters is replaced with a space.
 */
export function encodeWindows1255(value: string): Buffer {
  const out = Buffer.alloc(value.length)
  let n = 0
  for (const ch of value) {
    const cp = ch.codePointAt(0)!
    out[n++] = cp < 0x80 ? cp : cp >= 0x05d0 && cp <= 0x05ea ? 0xe0 + (cp - 0x05d0) : 0x20
  }
  return out.subarray(0, n)
}
