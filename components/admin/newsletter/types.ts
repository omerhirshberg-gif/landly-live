import type { CampaignRecord } from '@/lib/newsletter/campaigns.server'
import type { SubscriberRow } from '@/lib/newsletter/audience.server'

// Client-side shapes of the newsletter API (the server module itself is
// server-only, so only its types are borrowed).
export type { CampaignRecord, SubscriberRow }

export type AudienceKind = 'users' | 'leads' | 'all'
export type AudienceSegment = 'all' | 'new_oleh' | 'veteran_oleh' | 'lone_soldier' | 'student' | 'local'
export type AudienceLang = 'all' | 'en' | 'he' | 'ru' | 'fr' | 'es'

export interface AudienceState {
  kind: AudienceKind
  segment: AudienceSegment
  lang: AudienceLang
}

export interface ContentState {
  subject: string
  headline: string
  body: string
  ctaLabel: string
  ctaUrl: string
}

export const EMPTY_CONTENT: ContentState = { subject: '', headline: '', body: '', ctaLabel: '', ctaUrl: '' }
export const DEFAULT_AUDIENCE_STATE: AudienceState = { kind: 'users', segment: 'all', lang: 'all' }
export const SEGMENTS: AudienceSegment[] = ['all', 'new_oleh', 'veteran_oleh', 'lone_soldier', 'student', 'local']
export const LANGS: { value: AudienceLang; native: string }[] = [
  { value: 'en', native: 'English' },
  { value: 'he', native: 'עברית' },
  { value: 'ru', native: 'Русский' },
  { value: 'fr', native: 'Français' },
  { value: 'es', native: 'Español' },
]

export interface AudienceCount {
  status: 'loading' | 'ready' | 'error'
  count: number
  cap: number
  overCap: boolean
  simulated: boolean
  /** The people the filter matches, with the environment they come from (an empty DEV list is explained). */
  list: SubscriberRow[]
  env: string
}
