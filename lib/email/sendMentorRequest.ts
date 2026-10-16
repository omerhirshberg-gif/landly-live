import 'server-only'
import { isValidEmail, singleLine } from './formFields'
import { buildTeamInboxEmail, sendToTeamInbox } from './teamInboxEmail'

// The /olim "Connect with a Personal Mentor" form, delivered to the team inbox
// (teamInboxEmail.ts) with Reply-To set to the member.

// Mentor languages offered on the form; the client sends the code, the team
// sees the English name.
export const MENTOR_LANGUAGES = {
  ru: 'Russian',
  fr: 'French',
  es: 'Spanish',
  en: 'English',
} as const
export type MentorLanguage = keyof typeof MENTOR_LANGUAGES

export const MENTOR_LIMITS = { name: 100, email: 254, aliyahDate: 60 } as const

export interface MentorRequest {
  name: string
  email: string
  mentorLanguage: MentorLanguage | ''
  aliyahDate: string
  lang: string
}

/** Cleans the raw request body, or returns null when any required field is missing or invalid. */
export function parseMentorRequest(body: unknown): MentorRequest | null {
  if (!body || typeof body !== 'object') return null
  const raw = body as Record<string, unknown>
  const str = (key: string) => (typeof raw[key] === 'string' ? (raw[key] as string) : '')
  const name = singleLine(str('name'))
  const email = singleLine(str('email'))
  const aliyahDate = singleLine(str('aliyahDate'))
  const mentorLanguage = Object.hasOwn(MENTOR_LANGUAGES, str('mentorLanguage')) ? (str('mentorLanguage') as MentorLanguage) : ''
  const lang = singleLine(str('lang')).slice(0, 8)
  if (!name || name.length > MENTOR_LIMITS.name) return null
  if (!isValidEmail(email, MENTOR_LIMITS.email)) return null
  if (aliyahDate.length > MENTOR_LIMITS.aliyahDate) return null
  return { name, email, mentorLanguage, aliyahDate, lang }
}

function mentorEmail(req: MentorRequest) {
  const language = req.mentorLanguage ? MENTOR_LANGUAGES[req.mentorLanguage] : ''
  return {
    subject: `[Landly Mentor Request] ${req.name} — ${language ? `${language}-speaking mentor` : 'Aliyah mentor'}`,
    heading: 'New personal mentor request',
    rows: [
      { label: 'Name', value: req.name },
      { label: 'Email', value: req.email, href: `mailto:${req.email}` },
      { label: 'Mentor language', value: language || 'Not specified' },
      { label: 'Planned Aliyah date', value: req.aliyahDate || 'Not specified' },
      { label: 'Site language', value: req.lang || 'unknown' },
    ],
    message: `${req.name} asked to be matched with a personal Aliyah mentor.`,
    replyName: req.name,
    source: 'the Landly "Connect with a Personal Mentor" form',
  }
}

export function buildMentorRequestEmail(req: MentorRequest) {
  return buildTeamInboxEmail(mentorEmail(req))
}

export async function sendMentorRequest(req: MentorRequest): Promise<void> {
  await sendToTeamInbox({ ...mentorEmail(req), replyTo: req.email })
}
