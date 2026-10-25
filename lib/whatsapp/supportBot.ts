import { translations, type Lang, type TranslationKey } from '@/lib/i18n/translations'
import type { WhatsAppMessage } from './graph'
import { BOT_LANGUAGES, isBotLanguage, type BotAction, type InboundEvent } from './webhookPayload'

// The support bot's decisions, with no I/O (lib/whatsapp/supportBotHandler.ts
// does the sending, storing and emailing).
//
// A number that has never picked a language, and isn't a member with a
// profile language, gets the English language list where the menu would go
// (same cooldown). Picking a row saves it and answers with the menu in that
// language; "lang", "שפה", ... bring the list back at any time.
//
// Each conversation has a status:
//
// - active: a typed message gets the menu of three reply buttons (Member
//   Perks, Landly Pass, Talk to Team), at most once every
//   GREETING_COOLDOWN_MS; a message inside that window gets one short nudge,
//   and any more get nothing.
// - "Member Perks" / "Landly Pass": a link button to /categories or /member
//   (a reply button can't hold a link), then a follow-up with three reply
//   buttons: All set, Talk to Team, Main Menu.
// - awaiting_user_inquiry: "Talk to Team" asks the member to describe their
//   request (with a Cancel button). The next message, within
//   INQUIRY_TIMEOUT_MS, is emailed to the team with that text.
// - escalated: the team has the request; typed messages get no reply for
//   ESCALATION_SILENCE_MS so the bot never talks over a person. Buttons and
//   menu keywords still answer, without ending the escalation.
// - resolved: the member tapped "All set"; the next message starts over.
//
// Buttons and menu keywords ("menu", "תפריט", ...) are never throttled.
// Every reply is sent within Meta's 24-hour customer-service window, so no
// template is needed.

export const GREETING_COOLDOWN_MS = 90 * 1000
export const INQUIRY_TIMEOUT_MS = 30 * 60 * 1000
export const ESCALATION_SILENCE_MS = 24 * 60 * 60 * 1000
/** Meta allows free-form messages for 24 hours after the member's last message. */
export const CUSTOMER_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000

/** Meta's limits: 20 characters for a button title or link label, 1024 for a body. */
export const BUTTON_TITLE_MAX = 20
/** Meta's limits for a list message: 24 characters a row title, 60 a footer. */
export const LIST_ROW_TITLE_MAX = 24
export const FOOTER_MAX = 60

export type ConversationStatus = 'active' | 'awaiting_user_inquiry' | 'escalated' | 'resolved'

const STATUSES: readonly ConversationStatus[] = ['active', 'awaiting_user_inquiry', 'escalated', 'resolved']
export const isConversationStatus = (value: unknown): value is ConversationStatus => STATUSES.includes(value as ConversationStatus)

export interface BotContext {
  lang: Lang
  /** The site origin (APP_URL), for the link buttons. */
  origin: string
  /** First name of the member whose phone matches the sender, when there is one. */
  memberFirstName?: string
  isMember: boolean
  /** No language picked in this chat and none on the member's profile: greet with the language list. */
  needsLanguage?: boolean
  /** As stored; missing on conversations from before statuses. */
  status?: ConversationStatus
  lastMenuAt?: number
  lastNudgeAt?: number
  inquiryPromptedAt?: number
  escalatedAt?: number
  now: number
}

export type LinkAction = Extract<BotAction, 'btn_perks' | 'btn_pass'>

export type BotDecision =
  | { kind: 'silent' }
  | { kind: 'menu' }
  | { kind: 'languagePicker' }
  | { kind: 'languageChosen'; lang: Lang }
  | { kind: 'nudge' }
  | { kind: 'link'; action: LinkAction }
  | { kind: 'promptInquiry' }
  | { kind: 'alreadyEscalated' }
  | { kind: 'escalate' }
  | { kind: 'resolve' }

/**
 * The status in force now: an escalation lapses after ESCALATION_SILENCE_MS
 * and an unanswered inquiry prompt after INQUIRY_TIMEOUT_MS. A conversation
 * from before statuses is escalated while its escalatedAt is recent.
 */
export function currentStatus(ctx: Pick<BotContext, 'status' | 'escalatedAt' | 'inquiryPromptedAt' | 'now'>): ConversationStatus {
  const since = (at: number | undefined) => (at === undefined ? Infinity : ctx.now - at)
  const status = ctx.status ?? (ctx.escalatedAt !== undefined ? 'escalated' : 'active')
  if (status === 'escalated') return since(ctx.escalatedAt) < ESCALATION_SILENCE_MS ? 'escalated' : 'active'
  if (status === 'awaiting_user_inquiry') return since(ctx.inquiryPromptedAt) < INQUIRY_TIMEOUT_MS ? 'awaiting_user_inquiry' : 'active'
  return status
}

const MENU_KEYWORDS = new Set(['menu', 'help', 'תפריט', 'ראשי', 'עזרה'])
const LANGUAGE_KEYWORDS = new Set(['lang', 'language', 'languages', 'שפה', 'שפות', 'язык', 'langue', 'idioma'])

const keyword = (text: string) => text.trim().toLowerCase().replace(/[\s.!?,]+$/u, '')

/** "Menu", " תפריט! " and the like: the whole message is one of the menu words. */
export const isMenuKeyword = (text: string) => MENU_KEYWORDS.has(keyword(text))

/** "lang", "Language", "שפה" and the like, in any of the bot's languages. */
export const isLanguageKeyword = (text: string) => LANGUAGE_KEYWORDS.has(keyword(text))

export function decide(event: InboundEvent, ctx: BotContext): BotDecision {
  const status = currentStatus(ctx)
  const greeting: BotDecision = ctx.needsLanguage ? { kind: 'languagePicker' } : { kind: 'menu' }
  if (event.kind === 'language') return { kind: 'languageChosen', lang: event.lang }
  if (event.kind === 'button') {
    switch (event.action) {
      case 'btn_perks':
      case 'btn_pass':
        return { kind: 'link', action: event.action }
      case 'btn_talk_to_team':
      case 'btn_escalate_prompt':
        return status === 'escalated' ? { kind: 'alreadyEscalated' } : { kind: 'promptInquiry' }
      case 'btn_ticket_resolved':
        return { kind: 'resolve' }
      case 'btn_cancel_inquiry':
      case 'btn_back_to_menu':
        return { kind: 'menu' }
    }
  }
  if (event.kind === 'text' && isLanguageKeyword(event.text)) return { kind: 'languagePicker' }
  if (event.kind === 'text' && isMenuKeyword(event.text)) return greeting
  if (status === 'awaiting_user_inquiry') return { kind: 'escalate' }
  if (status === 'escalated') return { kind: 'silent' }
  if (ctx.lastMenuAt !== undefined && ctx.now - ctx.lastMenuAt < GREETING_COOLDOWN_MS) {
    const nudged = ctx.lastNudgeAt !== undefined && ctx.lastNudgeAt >= ctx.lastMenuAt
    return nudged ? { kind: 'silent' } : { kind: 'nudge' }
  }
  return greeting
}

/**
 * The language the bot answers in: the first supported one of, in order,
 * the language picked in the chat and the member's profile language; else English.
 */
export function botLanguage(...candidates: unknown[]): Lang {
  return candidates.find(isBotLanguage) ?? 'en'
}

const tr = (lang: Lang, key: TranslationKey) => translations[lang][key] ?? translations.en[key]

// LRI…PDI: an address or number stays left-to-right inside a Hebrew sentence.
const isolate = (value: string) => `⁦${value}⁩`

const BUTTON_KEYS = {
  btn_perks: 'wa_bot_btn_perks',
  btn_pass: 'wa_bot_btn_pass',
  btn_talk_to_team: 'wa_bot_btn_team',
  btn_escalate_prompt: 'wa_bot_btn_escalate',
  btn_cancel_inquiry: 'wa_bot_btn_cancel',
  btn_ticket_resolved: 'wa_bot_btn_resolved',
  btn_back_to_menu: 'wa_bot_btn_menu',
} as const satisfies Record<BotAction, TranslationKey>

/** A button's label in `lang`, as the member saw it. */
export const buttonTitle = (lang: Lang, action: BotAction) => tr(lang, BUTTON_KEYS[action])

/** A body with up to three reply buttons (Meta's limit); `titles` overrides a button's usual label. */
function buttonsMessage(
  lang: Lang,
  body: string,
  ids: BotAction[],
  titles: Partial<Record<BotAction, TranslationKey>> = {},
  footer?: string
): WhatsAppMessage {
  return {
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: body },
      ...(footer ? { footer: { text: footer } } : {}),
      action: { buttons: ids.map((id) => ({ type: 'reply' as const, reply: { id, title: tr(lang, titles[id] ?? BUTTON_KEYS[id]) } })) },
    },
  }
}

/** A message closed by a single "Main Menu" button. */
const withBackButton = (lang: Lang, key: TranslationKey): WhatsAppMessage =>
  buttonsMessage(lang, tr(lang, key), ['btn_back_to_menu'], { btn_back_to_menu: 'wa_bot_btn_back' })

export function menuMessage(ctx: BotContext): WhatsAppMessage {
  const body = ctx.memberFirstName
    ? tr(ctx.lang, 'wa_bot_menu_body_named').replace('{name}', ctx.memberFirstName)
    : tr(ctx.lang, 'wa_bot_menu_body')
  return buttonsMessage(ctx.lang, body, ['btn_perks', 'btn_pass', 'btn_talk_to_team'], {}, tr(ctx.lang, 'wa_bot_lang_footer'))
}

/** Each language in its own script, as the picker lists it. */
export const LANGUAGE_NAMES: Record<Lang, string> = {
  en: '🇺🇸 English',
  he: '🇮🇱 עברית',
  ru: '🇷🇺 Русский',
  fr: '🇫🇷 Français',
  es: '🇪🇸 Español',
}

/**
 * The first answer to a new number, always in English: a list (reply
 * buttons stop at three) with a row per language, ids lang_en … lang_es.
 */
export function languagePickerMessage(): WhatsAppMessage {
  return {
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: 'Hi! 👋 Welcome to Landly.\nPlease choose your language to continue.' },
      footer: { text: 'בחרו שפה · Выберите язык · Langue · Idioma' },
      action: {
        button: '🌐 Choose language',
        sections: [{ title: 'Language', rows: BOT_LANGUAGES.map((lang) => ({ id: `lang_${lang}`, title: LANGUAGE_NAMES[lang] })) }],
      },
    },
  }
}

export function linkMessage(action: LinkAction, ctx: BotContext): WhatsAppMessage {
  const [bodyKey, labelKey, path]: [TranslationKey, TranslationKey, string] =
    action === 'btn_perks'
      ? ['wa_bot_perks_body', 'wa_bot_perks_cta', '/categories']
      : [ctx.isMember ? 'wa_bot_pass_body_member' : 'wa_bot_pass_body_guest', 'wa_bot_pass_cta', '/member']
  return {
    type: 'interactive',
    interactive: {
      type: 'cta_url',
      body: { text: tr(ctx.lang, bodyKey) },
      action: { name: 'cta_url', parameters: { display_text: tr(ctx.lang, labelKey), url: `${ctx.origin}${path}` } },
    },
  }
}

/** Sent after every link: did it help, or does the member need a person? */
export function followUpMessage(lang: Lang): WhatsAppMessage {
  return buttonsMessage(lang, tr(lang, 'wa_bot_followup_body'), ['btn_ticket_resolved', 'btn_escalate_prompt', 'btn_back_to_menu'])
}

export const inquiryPromptMessage = (lang: Lang) => buttonsMessage(lang, tr(lang, 'wa_bot_inquiry_prompt'), ['btn_cancel_inquiry'])
export const escalatedMessage = (lang: Lang) => withBackButton(lang, 'wa_bot_team_confirm')
export const alreadyEscalatedMessage = (lang: Lang) => withBackButton(lang, 'wa_bot_team_already')
export const resolvedMessage = (lang: Lang) => withBackButton(lang, 'wa_bot_resolved')

export function textMessage(lang: Lang, key: 'wa_bot_nudge' | 'wa_bot_team_failed' | 'wa_bot_lang_changed', email = ''): WhatsAppMessage {
  return { type: 'text', text: { body: tr(lang, key).replace('{email}', isolate(email)) } }
}

/** A sent message as plain text for the support inbox: its body, then its buttons, rows or link. */
export function transcriptText(message: WhatsAppMessage): string {
  if (message.type === 'text') return message.text.body
  if (message.type === 'template') return `(template: ${message.template.name})`
  const { interactive } = message
  const choices =
    interactive.type === 'button'
      ? interactive.action.buttons.map((b) => `[${b.reply.title}]`)
      : interactive.type === 'list'
        ? interactive.action.sections.flatMap((section) => section.rows.map((row) => `[${row.title}]`))
        : [`[${interactive.action.parameters.display_text}] ${interactive.action.parameters.url}`]
  return `${interactive.body.text}\n${choices.join(' ')}`
}
