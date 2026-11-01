import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore'
import { PRELAUNCH_CONSENT_VERSION, PRELAUNCH_COPY } from './copy'
import type { LeadSubmission } from './validation'

// One /join sign-up, atomically. prelaunch_leads/{leadId} holds the lead;
// prelaunch_lead_keys/{hash} holds one document per phone and per email, so
// uniqueness on both comes from document ids and two racing submissions can't
// both win. Any match on either is the same person, whose first sign-up (its
// consent and attribution) is never overwritten. If the phone and the email
// belong to different leads, the phone's lead is the answer.
//
// The leadId doubles as the share code. Nothing here counts referrals: a lead
// only records who shared with it, and the export totals them
// (lib/prelaunch/demand.mjs), so a viral link never contends on one
// document. Nothing here touches users/* or Firebase Auth.
export const LEADS_COLLECTION = 'prelaunch_leads'
export const LEAD_KEYS_COLLECTION = 'prelaunch_lead_keys'

// RFC 4648 base32, lowercase. 256 is a multiple of 32, so each letter is uniform.
const CODE_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567'
const CODE_LENGTH = 10

export function newLeadId(): string {
  return Array.from(randomBytes(CODE_LENGTH), (byte) => CODE_ALPHABET[byte & 31]).join('')
}

export function leadKeyId(kind: 'phone' | 'email', value: string): string {
  return createHash('sha256').update(`${kind}:${value}`).digest('hex')
}

/** The referral code of this person's lead, new or existing. Callers can't tell which, so the form never reveals who has joined. */
export async function joinWaitlist(db: Firestore, lead: LeadSubmission): Promise<string> {
  const keys = db.collection(LEAD_KEYS_COLLECTION)
  const phoneKey = keys.doc(leadKeyId('phone', lead.phone))
  const emailKey = keys.doc(leadKeyId('email', lead.email))

  return db.runTransaction(async (tx) => {
    const [phoneSnap, emailSnap] = await Promise.all([tx.get(phoneKey), tx.get(emailKey)])
    const existing = phoneSnap.data()?.leadId ?? emailSnap.data()?.leadId
    if (typeof existing === 'string') return existing

    const leadId = newLeadId()
    const createdAt = FieldValue.serverTimestamp()
    const { clientTimestamp, ...attribution } = lead.attribution
    tx.create(db.collection(LEADS_COLLECTION).doc(leadId), {
      firstName: lead.firstName,
      phone: lead.phone,
      email: lead.email,
      lang: lead.lang,
      persona: lead.persona,
      status: 'interested',
      consent: {
        accepted: true,
        version: PRELAUNCH_CONSENT_VERSION,
        text: PRELAUNCH_COPY[lead.lang].consent,
        acceptedAt: createdAt,
      },
      referredBy: lead.referredBy,
      attribution: { ...attribution, clientTimestamp: clientTimestamp ? Timestamp.fromDate(clientTimestamp) : null },
      createdAt,
    })
    tx.create(phoneKey, { leadId, createdAt })
    tx.create(emailKey, { leadId, createdAt })
    return leadId
  })
}
