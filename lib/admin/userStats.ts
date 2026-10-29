import { getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js'
import { CUSTOMER_TYPES, isCustomerType } from '@/lib/customerTypes'

// The admin's Users page (/admin/users): one row per member (users/{uid}),
// merged on the server from the Firestore doc, the Auth record and their
// active vouchers, then grouped by member type and by country in the browser.
// Pure, so GET /api/admin/users and the unit tests share it.

export interface AdminUserRow {
  uid: string
  name: string
  email: string
  photoURL: string
  /** E.164, or '' when the member skipped the WhatsApp card. */
  phone: string
  /** ISO code of the phone number's country ('' without a number), e.g. 'IL' for +972. */
  phoneCountry: string
  /** ISO code of the country the member moved from, or ''. */
  originCountry: string
  /** A CUSTOMER_TYPES value, or '' when not set (or not a known type). */
  customerType: string
  customerTypeOther: string
  emailVerified: boolean
  phoneVerified: boolean
  activePasses: number
  /** ISO 8601, from Auth. */
  createdAt: string | null
  lastSignInAt: string | null
}

export interface UserDocFields {
  firstName?: unknown
  lastName?: unknown
  displayName?: unknown
  email?: unknown
  photoURL?: unknown
  phone?: unknown
  customerType?: unknown
  customerTypeOther?: unknown
  countryOfOrigin?: unknown
  phoneVerified?: unknown
}

export interface AuthFields {
  email?: string
  emailVerified: boolean
  creationTime?: string
  lastSignInTime?: string
}

/** The users/{uid} fields the route reads (a `select`, so each member costs one small read). */
export const USER_FIELDS = [
  'firstName', 'lastName', 'displayName', 'email', 'photoURL', 'phone', 'customerType', 'customerTypeOther', 'countryOfOrigin', 'phoneVerified',
] as const

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
const iso = (value: string | undefined) => {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null
}

/** The country a stored number dials, by its digits (so +1 tells the US from Canada); '' when there's none. */
export function phoneCountryOf(e164: string): string {
  return (e164 && parsePhoneNumberFromString(e164)?.country) || ''
}

/** "+972" for 'IL'; '' for no country. */
export function dialCode(country: string): string {
  if (!country) return ''
  try {
    return `+${getCountryCallingCode(country as CountryCode)}`
  } catch {
    return ''
  }
}

export function toAdminUserRow(uid: string, doc: UserDocFields, auth: AuthFields | undefined, activePasses: number): AdminUserRow {
  const phone = text(doc.phone)
  const name = text(doc.displayName) || [text(doc.firstName), text(doc.lastName)].filter(Boolean).join(' ')
  const origin = text(doc.countryOfOrigin)
  return {
    uid,
    name,
    email: text(doc.email) || auth?.email || '',
    photoURL: text(doc.photoURL),
    phone,
    phoneCountry: phoneCountryOf(phone),
    originCountry: /^[A-Z]{2}$/.test(origin) ? origin : '',
    customerType: isCustomerType(doc.customerType) ? doc.customerType : '',
    customerTypeOther: text(doc.customerTypeOther),
    emailVerified: !!auth?.emailVerified,
    phoneVerified: doc.phoneVerified === true,
    activePasses,
    createdAt: iso(auth?.creationTime),
    lastSignInAt: iso(auth?.lastSignInTime),
  }
}

/** How many active vouchers each member holds, from the `userId`s of every active voucher. */
export function countPasses(userIds: readonly unknown[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const id of userIds) if (typeof id === 'string' && id) counts.set(id, (counts.get(id) ?? 0) + 1)
  return counts
}

export interface Share {
  key: string
  count: number
  /** 0–100, rounded to one decimal. */
  percent: number
}

const percentOf = (count: number, total: number) => (total ? Math.round((count / total) * 1000) / 10 : 0)

/**
 * Members per type, every type in the onboarding order (zeros included) and
 * then '' (not set) when anyone is. `counts` overrides the tally from `rows`
 * (the route's exact count() totals when the list was cut off).
 */
export function segmentShares(rows: readonly AdminUserRow[], counts?: Readonly<Record<string, number>>): Share[] {
  const tally = counts ?? Object.fromEntries([...countBy(rows, (row) => row.customerType)])
  const keys = [...CUSTOMER_TYPES.map((type) => type.value as string), '']
  const total = keys.reduce((sum, key) => sum + (tally[key] ?? 0), 0)
  return keys
    .map((key) => ({ key, count: tally[key] ?? 0, percent: percentOf(tally[key] ?? 0, total) }))
    .filter((share) => share.key !== '' || share.count > 0)
}

/**
 * Members per country, largest first (ties by code), the top `limit` and the
 * rest folded into '*'; '' (not set) always last when anyone has none.
 */
export function countryShares(rows: readonly AdminUserRow[], country: (row: AdminUserRow) => string, limit = 8): Share[] {
  const counts = countBy(rows, country)
  const unset = counts.get('') ?? 0
  counts.delete('')
  const sorted = [...counts].sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
  const shown = sorted.slice(0, limit)
  const rest = sorted.slice(limit).reduce((sum, [, count]) => sum + count, 0)
  const entries: [string, number][] = [...shown, ...(rest ? [['*', rest] as [string, number]] : []), ...(unset ? [['', unset] as [string, number]] : [])]
  return entries.map(([key, count]) => ({ key, count, percent: percentOf(count, rows.length) }))
}

function countBy(rows: readonly AdminUserRow[], key: (row: AdminUserRow) => string): Map<string, number> {
  const counts = new Map<string, number>()
  for (const row of rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1)
  return counts
}

export interface UserFilters {
  query: string
  /** A type, '' for not set, or null for every type. */
  customerType: string | null
  /** An ISO code, '' for not set, or null for every country. */
  originCountry: string | null
  phoneCountry: string | null
}

/** Search by name, email or phone (with or without "+", spaces or dashes), then the dropdowns. */
export function filterUsers(rows: readonly AdminUserRow[], filters: UserFilters): AdminUserRow[] {
  const query = filters.query.trim().toLowerCase()
  const digits = query.replace(/[\s()+-]/g, '')
  const byPhone = /^\d{3,}$/.test(digits)
  return rows.filter(
    (row) =>
      (filters.customerType === null || row.customerType === filters.customerType) &&
      (filters.originCountry === null || row.originCountry === filters.originCountry) &&
      (filters.phoneCountry === null || row.phoneCountry === filters.phoneCountry) &&
      (!query ||
        row.name.toLowerCase().includes(query) ||
        row.email.toLowerCase().includes(query) ||
        (byPhone && (row.phone.includes(digits) || localDigits(row.phone).includes(digits)))),
  )
}

/** "0501234567" for "+972501234567", so a number typed the local way matches. */
function localDigits(e164: string): string {
  const parsed = e164 ? parsePhoneNumberFromString(e164) : undefined
  return parsed ? `0${parsed.nationalNumber}` : ''
}

export interface UserTotals {
  members: number
  emailVerified: number
  phoneVerified: number
  withPasses: number
}

export function userTotals(rows: readonly AdminUserRow[]): UserTotals {
  return {
    members: rows.length,
    emailVerified: rows.filter((row) => row.emailVerified).length,
    phoneVerified: rows.filter((row) => row.phoneVerified).length,
    withPasses: rows.filter((row) => row.activePasses > 0).length,
  }
}
