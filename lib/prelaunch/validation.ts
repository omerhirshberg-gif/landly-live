import { parsePhoneNumberFromString } from 'libphonenumber-js'
import { isValidEmail, singleLine } from '@/lib/email/formFields'
import { isPrelaunchLang, PERSONAS, type Persona, type PrelaunchLang } from './copy'
import { parseAttribution, type LeadAttribution } from './telemetry'

// The /join form's rules, run in the browser for instant errors and again on
// the server, which trusts nothing the browser sent.

export const MAX_NAME_LENGTH = 50
const MAX_EMAIL_LENGTH = 254
export const REFERRAL_CODE_RE = /^[a-z2-7]{10}$/

export type LeadField = 'firstName' | 'lastName' | 'phone' | 'email' | 'consent'
export type LeadErrors = Partial<Record<LeadField, true>>

export interface LeadFormValues {
  firstName: string
  lastName: string
  phone: string
  email: string
  consent: boolean
}

export interface LeadSubmission {
  firstName: string
  lastName: string
  phone: string
  email: string
  lang: PrelaunchLang
  /** The form's optional "which describes you" answer. */
  persona: Persona | null
  referredBy: string | null
  attribution: LeadAttribution
}

/** E.164, or null. A leading 0 after the country code ("+972 050…") is accepted and dropped. */
export function normalizeLeadPhone(input: string): string | null {
  const parsed = parsePhoneNumberFromString(input)
  return parsed?.isValid() ? parsed.number : null
}

export function normalizeLeadEmail(input: string): string {
  return singleLine(input).toLowerCase()
}

// Invisible direction marks and overrides, which can make a name read as
// something else in the admin and in a campaign.
const BIDI_CONTROLS = /[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g

export function normalizeLeadName(input: string): string {
  return singleLine(input.replace(BIDI_CONTROLS, ''))
}

// React escapes names on our pages, but they also go to Rav Messer, whose
// campaigns can merge them into HTML. Angle brackets are the one thing no name
// needs; apostrophes, hyphens and geresh all pass.
function isValidName(input: string): boolean {
  const name = normalizeLeadName(input)
  return name.length > 0 && name.length <= MAX_NAME_LENGTH && !/[<>]/.test(name)
}

export function leadFormErrors(values: LeadFormValues): LeadErrors {
  const errors: LeadErrors = {}
  if (!isValidName(values.firstName)) errors.firstName = true
  if (!isValidName(values.lastName)) errors.lastName = true
  if (!normalizeLeadPhone(values.phone)) errors.phone = true
  if (!isValidEmail(normalizeLeadEmail(values.email), MAX_EMAIL_LENGTH)) errors.email = true
  if (values.consent !== true) errors.consent = true
  return errors
}

/** The clean lead from a request body, or null if anything required is missing or malformed. */
export function parseLeadSubmission(body: unknown): LeadSubmission | null {
  if (!body || typeof body !== 'object') return null
  const raw = body as Record<string, unknown>
  const text = (key: string) => (typeof raw[key] === 'string' ? (raw[key] as string) : '')
  const values: LeadFormValues = {
    firstName: text('firstName'),
    lastName: text('lastName'),
    phone: text('phone'),
    email: text('email'),
    consent: raw.consent === true,
  }
  if (Object.keys(leadFormErrors(values)).length || !isPrelaunchLang(raw.lang)) return null
  return {
    firstName: normalizeLeadName(values.firstName),
    lastName: normalizeLeadName(values.lastName),
    phone: normalizeLeadPhone(values.phone)!,
    email: normalizeLeadEmail(values.email),
    lang: raw.lang,
    // Optional, so a value we don't know is dropped, never a reason to lose the lead.
    persona: (PERSONAS as readonly unknown[]).includes(raw.persona) ? (raw.persona as Persona) : null,
    // A malformed code is dropped, never a reason to lose the lead.
    referredBy: REFERRAL_CODE_RE.test(text('ref')) ? text('ref') : null,
    attribution: parseAttribution(raw.attribution),
  }
}
