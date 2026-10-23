import { SUPPORT_EMAIL, SUPPORT_PHONE_TEL, SUPPORT_WHATSAPP_DISPLAY } from '@/lib/config'
import { translations, type Lang, type TranslationKey } from '@/lib/i18n/translations'

// The privacy policy as plain data, in all five languages: the structure
// (sections, their order and block kinds) lives here once, and every string
// is a pp_* key in lib/i18n/translations.ts. The website
// (components/legal/PrivacyPolicy.tsx, server-rendered in English for
// Google's OAuth reviewers, then in the member's language) and the app's
// native screen (landly-mobile/src/app/settings/privacy.tsx) both render
// privacyPolicy(lang), and tests/unit/privacyPolicyContent.test.ts checks
// every block, in every language, against what the website shows. The
// English version governs; the "Changes" section and legal_translation_notice
// say so.
//
// Strings carry a small inline markup, parsed by parseInline:
//   **bold**   `code`   [label](https://… or #section-id)
//   {email} {phone} {site} {googlePermissions}

/** A run of text: plain, bold, inline code, a link (an http URL, or "#id" for another section), or the support email. */
export type PolicyInline = string | { bold: string } | { code: string } | { link: string; href: string } | { email: true }

export type PolicyBlock =
  | { kind: 'p'; text: PolicyInline[] }
  | { kind: 'h3'; text: string }
  | { kind: 'ul'; items: PolicyInline[][] }
  | { kind: 'ol'; items: PolicyInline[][] }
  /** The Limited Use statement, set apart in a tinted box. */
  | { kind: 'callout'; text: PolicyInline[] }
  /** The contact card: one line per entry. */
  | { kind: 'address'; lines: PolicyInline[][] }

export interface PolicySection {
  id: string
  title: string
  blocks: PolicyBlock[]
}

export interface PrivacyPolicyText {
  title: string
  updatedLabel: string
  updatedDate: string
  contents: string
  intro: PolicyInline[]
  sections: PolicySection[]
}

/** When the policy last changed; each language's pp_updated_date spells this date. */
export const PRIVACY_POLICY_UPDATED_ISO = '2026-10-23'

const PLACEHOLDERS: Record<string, PolicyInline> = {
  email: { email: true },
  phone: { link: SUPPORT_WHATSAPP_DISPLAY, href: SUPPORT_PHONE_TEL },
  site: { link: 'www.golandly.com', href: 'https://www.golandly.com' },
  googlePermissions: { link: 'myaccount.google.com/permissions', href: 'https://myaccount.google.com/permissions' },
}

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|\{(?:email|phone|site|googlePermissions)\})/

/** Splits a marked-up policy string into runs. */
export function parseInline(source: string): PolicyInline[] {
  return source
    .split(INLINE)
    .filter(Boolean)
    .map((piece): PolicyInline => {
      if (piece.startsWith('**') && piece.endsWith('**')) return { bold: piece.slice(2, -2) }
      if (piece.startsWith('`') && piece.endsWith('`')) return { code: piece.slice(1, -1) }
      const link = piece.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)
      if (link) return { link: link[1], href: link[2] }
      const placeholder = piece.match(/^\{(\w+)\}$/)
      if (placeholder && PLACEHOLDERS[placeholder[1]]) return PLACEHOLDERS[placeholder[1]]
      return piece
    })
}

// The structure: each block names its translation keys.
type BlockSpec =
  | { kind: 'p' | 'h3' | 'callout'; key: TranslationKey }
  | { kind: 'ul' | 'ol' | 'address'; keys: TranslationKey[] }

const p = (key: TranslationKey): BlockSpec => ({ kind: 'p', key })
const h3 = (key: TranslationKey): BlockSpec => ({ kind: 'h3', key })
const ul = (...keys: TranslationKey[]): BlockSpec => ({ kind: 'ul', keys })
const ol = (...keys: TranslationKey[]): BlockSpec => ({ kind: 'ol', keys })

export const PRIVACY_POLICY_STRUCTURE: { id: string; title: TranslationKey; blocks: BlockSpec[] }[] = [
  { id: 'who-we-are', title: 'pp_who_title', blocks: [p('pp_who_p1'), p('pp_who_p2')] },
  { id: 'scope', title: 'pp_scope_title', blocks: [p('pp_scope_p1'), p('pp_scope_p2')] },
  {
    id: 'information-we-collect',
    title: 'pp_collect_title',
    blocks: [
      h3('pp_collect_account_h'),
      ul('pp_collect_account_1', 'pp_collect_account_2', 'pp_collect_account_3', 'pp_collect_account_4', 'pp_collect_account_5', 'pp_collect_account_6'),
      h3('pp_collect_member_h'),
      ul('pp_collect_member_1', 'pp_collect_member_2', 'pp_collect_member_3', 'pp_collect_member_4', 'pp_collect_member_5', 'pp_collect_member_6'),
      h3('pp_collect_contact_h'),
      ul('pp_collect_contact_1', 'pp_collect_contact_2', 'pp_collect_contact_3'),
      h3('pp_collect_orders_h'),
      ul('pp_collect_orders_1', 'pp_collect_orders_2'),
      h3('pp_collect_payment_h'),
      p('pp_collect_payment_1'),
      p('pp_collect_payment_2'),
      h3('pp_collect_location_h'),
      ul('pp_collect_location_1', 'pp_collect_location_2', 'pp_collect_location_3'),
      h3('pp_collect_messages_h'),
      p('pp_collect_messages_p'),
      h3('pp_collect_mentor_h'),
      p('pp_collect_mentor_p'),
      h3('pp_collect_technical_h'),
      p('pp_collect_technical_p'),
    ],
  },
  {
    id: 'google-user-data',
    title: 'pp_google_title',
    blocks: [
      p('pp_google_p1'),
      h3('pp_google_receive_h'),
      p('pp_google_p2'),
      ul('pp_google_receive_1', 'pp_google_receive_2', 'pp_google_receive_3', 'pp_google_receive_4'),
      p('pp_google_p3'),
      h3('pp_google_use_h'),
      p('pp_google_p4'),
      ul('pp_google_use_1', 'pp_google_use_2', 'pp_google_use_3', 'pp_google_use_4'),
      h3('pp_google_limited_h'),
      { kind: 'callout', key: 'pp_google_callout' },
      p('pp_google_p5'),
      ul('pp_google_particular_1', 'pp_google_particular_2', 'pp_google_particular_3', 'pp_google_particular_4', 'pp_google_particular_5'),
      p('pp_google_p6'),
    ],
  },
  {
    id: 'sign-in-security',
    title: 'pp_signin_title',
    blocks: [
      p('pp_signin_p1'),
      h3('pp_signin_lock_h'),
      ul('pp_signin_lock_1', 'pp_signin_lock_2'),
      h3('pp_signin_how_h'),
      ul('pp_signin_how_1', 'pp_signin_how_2', 'pp_signin_how_3'),
      h3('pp_signin_passkey_h'),
      ul('pp_signin_passkey_1', 'pp_signin_passkey_2', 'pp_signin_passkey_3'),
    ],
  },
  {
    id: 'how-we-use-information',
    title: 'pp_use_title',
    blocks: [
      p('pp_use_p1'),
      ul('pp_use_1', 'pp_use_2', 'pp_use_3', 'pp_use_4', 'pp_use_5', 'pp_use_6', 'pp_use_7', 'pp_use_8', 'pp_use_9', 'pp_use_10'),
      p('pp_use_p2'),
      p('pp_use_p3'),
    ],
  },
  { id: 'partner-businesses', title: 'pp_partners_title', blocks: [p('pp_partners_p1')] },
  {
    id: 'service-providers',
    title: 'pp_providers_title',
    blocks: [
      p('pp_providers_p1'),
      ul('pp_providers_1', 'pp_providers_2', 'pp_providers_3', 'pp_providers_4', 'pp_providers_5', 'pp_providers_6', 'pp_providers_7', 'pp_providers_8'),
    ],
  },
  {
    id: 'other-disclosures',
    title: 'pp_disclosures_title',
    blocks: [p('pp_disclosures_p1'), ul('pp_disclosures_1', 'pp_disclosures_2', 'pp_disclosures_3', 'pp_disclosures_4')],
  },
  { id: 'cookies', title: 'pp_cookies_title', blocks: [p('pp_cookies_p1')] },
  {
    id: 'security',
    title: 'pp_protect_title',
    blocks: [
      ul('pp_protect_1', 'pp_protect_2', 'pp_protect_3', 'pp_protect_4', 'pp_protect_5', 'pp_protect_6', 'pp_protect_7', 'pp_protect_8'),
      p('pp_protect_p1'),
    ],
  },
  {
    id: 'retention',
    title: 'pp_retention_title',
    blocks: [
      ul('pp_retention_1', 'pp_retention_2', 'pp_retention_3', 'pp_retention_4', 'pp_retention_5', 'pp_retention_6', 'pp_retention_7', 'pp_retention_8', 'pp_retention_9'),
    ],
  },
  {
    id: 'deletion',
    title: 'pp_deletion_title',
    blocks: [p('pp_deletion_p1'), ol('pp_deletion_1', 'pp_deletion_2', 'pp_deletion_3'), p('pp_deletion_p2'), p('pp_deletion_p3')],
  },
  {
    id: 'your-rights',
    title: 'pp_rights_title',
    blocks: [p('pp_rights_p1'), ul('pp_rights_1', 'pp_rights_2', 'pp_rights_3', 'pp_rights_4', 'pp_rights_5', 'pp_rights_6', 'pp_rights_7'), p('pp_rights_p2')],
  },
  { id: 'international-transfers', title: 'pp_transfers_title', blocks: [p('pp_transfers_p1')] },
  { id: 'children', title: 'pp_children_title', blocks: [p('pp_children_p1')] },
  { id: 'changes', title: 'pp_changes_title', blocks: [p('pp_changes_p1')] },
  { id: 'contact', title: 'pp_contact_title', blocks: [{ kind: 'address', keys: ['pp_contact_1', 'pp_contact_2', 'pp_contact_3', 'pp_contact_4', 'pp_contact_5'] }] },
]

/** The policy in one language. */
export function privacyPolicy(lang: Lang): PrivacyPolicyText {
  const t = (key: TranslationKey): string => translations[lang][key] || translations.en[key]
  const block = (spec: BlockSpec): PolicyBlock => {
    switch (spec.kind) {
      case 'h3':
        return { kind: 'h3', text: t(spec.key) }
      case 'p':
      case 'callout':
        return { kind: spec.kind, text: parseInline(t(spec.key)) }
      case 'ul':
      case 'ol':
        return { kind: spec.kind, items: spec.keys.map((key) => parseInline(t(key))) }
      case 'address':
        return { kind: 'address', lines: spec.keys.map((key) => parseInline(t(key))) }
    }
  }
  return {
    title: t('pp_title'),
    updatedLabel: t('pp_updated_label'),
    updatedDate: t('pp_updated_date'),
    contents: t('pp_contents'),
    intro: parseInline(t('pp_intro')),
    sections: PRIVACY_POLICY_STRUCTURE.map((s) => ({ id: s.id, title: t(s.title), blocks: s.blocks.map(block) })),
  }
}

// The English (governing) text, for tests and English-only callers.
const english = privacyPolicy('en')
export const PRIVACY_POLICY_TITLE = english.title
export const PRIVACY_POLICY_UPDATED_LABEL = english.updatedDate
export const PRIVACY_POLICY_INTRO = english.intro
export const PRIVACY_POLICY_SECTIONS = english.sections

/** A run's visible text. */
export function inlineText(part: PolicyInline): string {
  if (typeof part === 'string') return part
  if ('bold' in part) return part.bold
  if ('code' in part) return part.code
  if ('link' in part) return part.link
  return SUPPORT_EMAIL
}

/** A block's visible text, one string per paragraph, heading, list item or address line. */
export function blockTexts(block: PolicyBlock): string[] {
  const join = (parts: PolicyInline[]) => parts.map(inlineText).join('')
  switch (block.kind) {
    case 'h3':
      return [block.text]
    case 'p':
    case 'callout':
      return [join(block.text)]
    case 'ul':
    case 'ol':
      return block.items.map(join)
    case 'address':
      return block.lines.map(join)
  }
}

/** Runs that hold left-to-right tokens (addresses, numbers, URLs, code) which must be isolated inside right-to-left text. */
export function isLtrToken(part: PolicyInline): boolean {
  if (typeof part === 'string' || 'bold' in part) return false
  if ('link' in part) return !part.href.startsWith('#')
  return true
}
