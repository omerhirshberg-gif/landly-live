import 'server-only'
import { BUSINESS_CATEGORIES, type BusinessCategory } from '@/lib/business/inquiryCategories'
import { isValidEmail, multiLine, singleLine } from './formFields'
import { buildTeamInboxEmail, sendToTeamInbox } from './teamInboxEmail'

// The /business "Apply to Become a Partner" form, delivered to the team inbox
// (teamInboxEmail.ts) with Reply-To set to the lead.

export const BUSINESS_LIMITS = { businessName: 120, contactName: 100, email: 254, phone: 30, message: 3000 } as const

export interface BusinessInquiry {
  businessName: string
  contactName: string
  email: string
  phone: string
  category: BusinessCategory | ''
  message: string
}

// Digits plus the usual separators, 7–15 digits (E.164's ceiling).
function isValidPhone(value: string): boolean {
  if (!/^[0-9+()\-.\s]+$/.test(value)) return false
  const digits = value.replace(/\D/g, '').length
  return digits >= 7 && digits <= 15
}

/** Cleans the raw request body, or returns null when any required field is missing or invalid. */
export function parseBusinessInquiry(body: unknown): BusinessInquiry | null {
  if (!body || typeof body !== 'object') return null
  const raw = body as Record<string, unknown>
  const str = (key: string) => (typeof raw[key] === 'string' ? (raw[key] as string) : '')
  const businessName = singleLine(str('businessName'))
  const contactName = singleLine(str('contactName'))
  const email = singleLine(str('email'))
  const phone = singleLine(str('phone'))
  const message = multiLine(str('message'))
  const category = (BUSINESS_CATEGORIES as readonly string[]).includes(str('category'))
    ? (str('category') as BusinessCategory)
    : ''
  if (!businessName || businessName.length > BUSINESS_LIMITS.businessName) return null
  if (!contactName || contactName.length > BUSINESS_LIMITS.contactName) return null
  if (!isValidEmail(email, BUSINESS_LIMITS.email)) return null
  if (phone.length > BUSINESS_LIMITS.phone || !isValidPhone(phone)) return null
  if (message.length > BUSINESS_LIMITS.message) return null
  return { businessName, contactName, email, phone, category, message }
}

function businessEmail(lead: BusinessInquiry) {
  return {
    subject: `[Landly Business Lead] ${lead.businessName} — ${lead.contactName}`,
    heading: 'New business partner application',
    rows: [
      { label: 'Business name', value: lead.businessName },
      { label: 'Contact name', value: lead.contactName },
      { label: 'Email', value: lead.email, href: `mailto:${lead.email}` },
      { label: 'Phone', value: lead.phone, href: `tel:${lead.phone.replace(/[^0-9+]/g, '')}` },
      { label: 'Category', value: lead.category || 'Not specified' },
    ],
    message: lead.message || '(No message)',
    replyName: lead.contactName,
    source: 'the Landly For Businesses form',
  }
}

export function buildBusinessInquiryEmail(lead: BusinessInquiry) {
  return buildTeamInboxEmail(businessEmail(lead))
}

export async function sendBusinessInquiry(lead: BusinessInquiry): Promise<void> {
  await sendToTeamInbox({ ...businessEmail(lead), replyTo: lead.email })
}
