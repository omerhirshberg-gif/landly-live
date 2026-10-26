import { RTL_LANGS, translations, type Lang, type TranslationKey } from '@/lib/i18n/translations'
import type { WhatsAppMessage } from './graph'
import { BOT_LANGUAGES, isBotLanguage, type BotAction, type InboundEvent } from './webhookPayload'

// The support bot's decisions, with no I/O (lib/whatsapp/supportBotHandler.ts
// does the sending, storing and emailing).
//
// Every choice is one message (choiceMessage): up to three choices are
// reply buttons inside the chat bubble; more is a single list message, whose
// button opens the choices (a bottom sheet on phones, a dialog on WhatsApp
// Web and Desktop). A menu is never split across bubbles.
//
// A chat with no language picked in it (no langSelectedAt) is awaiting its
// language: whatever the member sends, the answer is the English welcome
// with the five languages in a list, and nothing else, until one is picked.
// Typing a language's name picks it too, for clients that can't open lists.
// Picking one saves it (and the member's profile language) and answers with
// the menu in that language; the menu's Language row and "lang", "שפה", ...
// bring the list back at any time, worded in the chat's language.
//
// The menu is one list of six: Existing order, New order, My Pass & perks,
// Talk to an agent, Login & Account help, Language. Typing 1-6 picks one too.
//
// - Existing order: three buttons. "My voucher & QR" links to the member's
//   vouchers (/member); "Issue at business" and "Cancel or refund" answer in
//   place (the redemption steps, the 14-day cancellation terms).
// - New order: a link to the deals (/categories), for terms, locations and
//   payment questions.
// - My Pass & perks: three buttons: the pass (/member), the perks
//   (/categories), or account help (straight to the team).
// - Talk to an agent: straight to the team.
// - Login & Account help: what to do about a verification code that didn't
//   arrive, with a link to a new sign-in link (/forgot-password); the
//   conversation is tagged login_help in the inbox.
//
// Every answer ends with three reply buttons: All set, Talk to Team, Main
// Menu. Talk to Team carries the topic it came from, so the team's email and
// the inbox show what the request is about (InquiryCategory). A link card
// can't hold reply buttons (Meta), so an answer with a link is two messages.
//
// Each conversation has a status:
//
// - active: a typed message gets the menu, at most once every
//   GREETING_COOLDOWN_MS; a message inside that window gets one short nudge,
//   and any more get nothing.
// - awaiting_user_inquiry: Talk to Team asks the member to describe their
//   request (with a Cancel button). The next message, within
//   INQUIRY_TIMEOUT_MS, is emailed to the team with that text.
// - escalated: the team has the request; typed messages get no reply for
//   ESCALATION_SILENCE_MS so the bot never talks over a person. Buttons and
//   menu keywords still answer, without ending the escalation.
// - resolved: the member tapped "All set"; the next message starts over.
//
// A conversation the bot spoke last in, and the member left for idleMs()
// (lib/whatsapp/idleSweep.ts), gets one check-in: Yes, need help (back to
// the request or the menu) or All set (resolved). Without an answer within
// IDLE_GRACE_MS it is resolved silently. A chat still awaiting its language
// gets no check-in.
//
// A conversation the team replied in last, and the member left, gets one
// follow-up from the team (teamNudgeMessage, inside Meta's window: see
// TEAM_NUDGE_HOURS): All set (resolved) or Still need help (back with the
// team, awaiting its reply). Without an answer within TEAM_RESOLVE_HOURS it
// is resolved silently. While the member wrote last, the team owes the reply
// and nothing times out.
//
// Buttons and menu keywords ("menu", "תפריט", ...) are never throttled.
// Every reply is sent within Meta's 24-hour customer-service window, so no
// template is needed.

export const GREETING_COOLDOWN_MS = 90 * 1000
export const INQUIRY_TIMEOUT_MS = 30 * 60 * 1000
export const ESCALATION_SILENCE_MS = 24 * 60 * 60 * 1000
/** Meta allows free-form messages for 24 hours after the member's last message. */
export const CUSTOMER_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000

/** How long the member may leave a conversation before the check-in: WHATSAPP_IDLE_MINUTES, 20 to 30, else 25. */
export const IDLE_MINUTES = { min: 20, max: 30, default: 25 } as const
/** After the check-in, how long before the conversation is resolved without an answer. */
export const IDLE_GRACE_MS = 30 * 60 * 1000

/**
 * After the team's reply, how long the member may stay quiet before the
 * follow-up: WHATSAPP_TEAM_NUDGE_HOURS, 12 to 24, else 12. It goes out no
 * later than TEAM_NUDGE_WINDOW_MARGIN_MS before Meta's window closes, and
 * not at all when that leaves the member less than TEAM_NUDGE_MIN_WAIT_MS
 * after the reply.
 */
export const TEAM_NUDGE_HOURS = { min: 12, max: 24, default: 12 } as const
/** After the follow-up (or when it is due, if there was none), how long before the conversation is resolved silently: WHATSAPP_TEAM_RESOLVE_HOURS, 12 to 24, else 24. */
export const TEAM_RESOLVE_HOURS = { min: 12, max: 24, default: 24 } as const
export const TEAM_NUDGE_WINDOW_MARGIN_MS = 60 * 60 * 1000
export const TEAM_NUDGE_MIN_WAIT_MS = 2 * 60 * 60 * 1000

/** A setting from the environment, held to its range, in ms. */
function setting(configured: string | undefined, range: { min: number; max: number; default: number }, unitMs: number): number {
  const value = Number(configured)
  const valid = configured?.trim() && Number.isFinite(value) ? Math.min(range.max, Math.max(range.min, value)) : range.default
  return valid * unitMs
}

export const idleMs = (configured = process.env.WHATSAPP_IDLE_MINUTES) => setting(configured, IDLE_MINUTES, 60 * 1000)
export const teamNudgeMs = (configured = process.env.WHATSAPP_TEAM_NUDGE_HOURS) => setting(configured, TEAM_NUDGE_HOURS, 60 * 60 * 1000)
export const teamResolveMs = (configured = process.env.WHATSAPP_TEAM_RESOLVE_HOURS) => setting(configured, TEAM_RESOLVE_HOURS, 60 * 60 * 1000)

/** Meta's limits: 20 characters for a button title or link label, 1024 for a body, 60 for a footer, three reply buttons. */
export const BUTTON_TITLE_MAX = 20
export const BODY_MAX = 1024
export const FOOTER_MAX = 60
export const BUTTONS_MAX = 3
/** A list message: 20 characters for its button, 24 for a row title, 72 for a row description, ten rows in all. */
export const LIST_BUTTON_MAX = 20
export const ROW_TITLE_MAX = 24
export const ROW_DESCRIPTION_MAX = 72
export const LIST_ROWS_MAX = 10

export type ConversationStatus = 'active' | 'awaiting_user_inquiry' | 'escalated' | 'resolved'

/** What a request to the team is about: the topic the member asked from. */
export type InquiryCategory = 'order_issue' | 'purchase_help' | 'login_help' | 'general'
const CATEGORIES: readonly InquiryCategory[] = ['order_issue', 'purchase_help', 'login_help', 'general']
export const isInquiryCategory = (value: unknown): value is InquiryCategory => CATEGORIES.includes(value as InquiryCategory)
/** How the team's email and the support inbox name each topic (the admin UI is English). */
export const INQUIRY_CATEGORY_LABELS: Record<InquiryCategory, string> = {
  order_issue: 'Existing order',
  purchase_help: 'New order',
  login_help: 'Login & account',
  general: 'General',
}

/** An answer the bot gives on its own: a link card or a few lines, then the follow-up buttons. */
export type Topic = 'vouchers' | 'venue' | 'refund' | 'new_order' | 'pass' | 'perks' | 'login_help'
export type Submenu = 'order' | 'pass'

const STATUSES: readonly ConversationStatus[] = ['active', 'awaiting_user_inquiry', 'escalated', 'resolved']
export const isConversationStatus = (value: unknown): value is ConversationStatus => STATUSES.includes(value as ConversationStatus)

export interface BotContext {
  lang: Lang
  /** The site origin (APP_URL), for the link buttons. */
  origin: string
  /** First name of the member whose phone matches the sender, when there is one. */
  memberFirstName?: string
  isMember: boolean
  /** No language picked in this chat yet (no langSelectedAt): every answer is the language list until one is. */
  needsLanguage?: boolean
  /** As stored; missing on conversations from before statuses. */
  status?: ConversationStatus
  lastMenuAt?: number
  lastNudgeAt?: number
  inquiryPromptedAt?: number
  /** The topic of the request the member was asked to describe. */
  inquiryCategory?: InquiryCategory
  escalatedAt?: number
  /** When the idle check-in went out, while it is unanswered. */
  idleCheckInAt?: number
  /** What "Yes, need help" goes back to: the request the member was asked to describe, else the menu. */
  idleResume?: 'inquiry'
  now: number
}

export type BotDecision =
  | { kind: 'silent' }
  | { kind: 'menu' }
  | { kind: 'submenu'; menu: Submenu }
  | { kind: 'languagePicker' }
  | { kind: 'languageChosen'; lang: Lang }
  | { kind: 'nudge' }
  | { kind: 'topic'; topic: Topic }
  | { kind: 'promptInquiry'; category: InquiryCategory }
  | { kind: 'alreadyEscalated' }
  | { kind: 'escalate' }
  | { kind: 'backToTeam' }
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

const MENU_KEYWORDS = new Set(['menu', 'help', 'תפריט', 'ראשי', 'עזרה', 'меню', 'помощь', 'aide', 'menú', 'ayuda'])
const LANGUAGE_KEYWORDS = new Set(['lang', 'language', 'languages', 'שפה', 'שפות', 'язык', 'langue', 'idioma'])

const keyword = (text: string) => text.trim().toLowerCase().replace(/[\s.!?,]+$/u, '')

/** "Menu", " תפריט! " and the like: the whole message is one of the menu words. */
export const isMenuKeyword = (text: string) => MENU_KEYWORDS.has(keyword(text))

/** "lang", "Language", "שפה" and the like, in any of the bot's languages. */
export const isLanguageKeyword = (text: string) => LANGUAGE_KEYWORDS.has(keyword(text))

// Each language as its own speakers, English and Hebrew name it.
const TYPED_LANGUAGES: Record<string, Lang> = {
  english: 'en', אנגלית: 'en',
  עברית: 'he', hebrew: 'he', ivrit: 'he',
  русский: 'ru', russian: 'ru', רוסית: 'ru',
  français: 'fr', francais: 'fr', french: 'fr', צרפתית: 'fr',
  español: 'es', espanol: 'es', spanish: 'es', ספרדית: 'es',
}

/** The language a typed name stands for ("english", "עברית", "Русский", ...), for clients that can't open the list. */
export const typedLanguage = (text: string): Lang | undefined => TYPED_LANGUAGES[keyword(text)]

/** What each button leads to; the legacy btn_perks / btn_pass are the Pass menu's buttons. */
const ACTIONS: Record<BotAction, { submenu: Submenu } | { topic: Topic } | { inquiry: InquiryCategory } | 'menu' | 'resolve' | 'language' | 'stillNeedHelp' | 'backToTeam'> = {
  menu_order: { submenu: 'order' },
  menu_pass: { submenu: 'pass' },
  menu_new_order: { topic: 'new_order' },
  opt_vouchers: { topic: 'vouchers' },
  opt_venue: { topic: 'venue' },
  opt_refund: { topic: 'refund' },
  opt_pass: { topic: 'pass' },
  btn_pass: { topic: 'pass' },
  opt_perks: { topic: 'perks' },
  btn_perks: { topic: 'perks' },
  menu_agent: { inquiry: 'general' },
  menu_login_help: { topic: 'login_help' },
  opt_account: { inquiry: 'general' },
  btn_talk_to_team: { inquiry: 'general' },
  btn_escalate_prompt: { inquiry: 'general' },
  btn_escalate_order: { inquiry: 'order_issue' },
  btn_escalate_purchase: { inquiry: 'purchase_help' },
  btn_escalate_login: { inquiry: 'login_help' },
  btn_ticket_resolved: 'resolve',
  btn_cancel_inquiry: 'menu',
  btn_back_to_menu: 'menu',
  menu_lang: 'language',
  btn_idle_yes: 'stillNeedHelp',
  btn_idle_done: 'resolve',
  btn_team_nudge_yes: 'backToTeam',
}

/** The menu's rows, in order; "1" to "6" typed pick them too. */
const MENU_ROWS = ['menu_order', 'menu_new_order', 'menu_pass', 'menu_agent', 'menu_login_help', 'menu_lang'] as const satisfies readonly BotAction[]
const MENU_SHORTCUTS: Record<string, BotAction> = Object.fromEntries(MENU_ROWS.map((action, i) => [String(i + 1), action]))

export function decide(event: InboundEvent, ctx: BotContext): BotDecision {
  const status = currentStatus(ctx)
  const greeting: BotDecision = ctx.needsLanguage ? { kind: 'languagePicker' } : { kind: 'menu' }
  if (event.kind === 'language') return { kind: 'languageChosen', lang: event.lang }
  // Only while the bot leads: an inquiry or a chat with the team may well be a number or a word.
  const botLeads = status === 'active' || status === 'resolved'
  const typed = event.kind === 'text' && botLeads ? typedLanguage(event.text) : undefined
  if (typed) return { kind: 'languageChosen', lang: typed }
  // Awaiting its language, a chat gets the language list for any button, even one from an older menu.
  if (event.kind === 'button' && ctx.needsLanguage) return { kind: 'languagePicker' }
  if (event.kind === 'button') {
    const next = ACTIONS[event.action]
    if (next === 'menu') return { kind: 'menu' }
    if (next === 'resolve') return { kind: 'resolve' }
    if (next === 'language') return { kind: 'languagePicker' }
    if (next === 'backToTeam') return { kind: 'backToTeam' }
    if (next === 'stillNeedHelp') {
      if (ctx.idleResume !== 'inquiry') return { kind: 'menu' }
      return status === 'escalated' ? { kind: 'alreadyEscalated' } : { kind: 'promptInquiry', category: ctx.inquiryCategory ?? 'general' }
    }
    if ('submenu' in next) return { kind: 'submenu', menu: next.submenu }
    if ('topic' in next) return { kind: 'topic', topic: next.topic }
    return status === 'escalated' ? { kind: 'alreadyEscalated' } : { kind: 'promptInquiry', category: next.inquiry }
  }
  if (event.kind === 'text' && isLanguageKeyword(event.text)) return { kind: 'languagePicker' }
  if (event.kind === 'text' && isMenuKeyword(event.text)) return greeting
  const shortcut = event.kind === 'text' && !ctx.needsLanguage && botLeads ? MENU_SHORTCUTS[keyword(event.text)] : undefined
  if (shortcut) return decide({ ...event, kind: 'button', action: shortcut }, ctx)
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
const isolate = (value: string) => `\u2066${value}\u2069`

// A number and its unit or word ("14 days", "100 ₪", "9 h") never split across lines.
const NUMBER_SPACE = /(\d) (?=[%₪\p{L}])/gu
const SHEKEL_SPACE = /₪ (?=\d)/gu
// Hours, dates, amounts and percentages, kept left-to-right in a right-to-left body.
const LTR_RUN = /\d{1,2}:\d{2}(?:[–-]\d{1,2}:\d{2})?|\d{1,2}[./]\d{1,2}[./]\d{2,4}|₪\u00A0?\d+(?:[,.]\d+)*|\d+(?:[,.]\d+)*\u00A0?[%₪]/gu

/** A body as the bot sends it: units joined to their numbers, and in Hebrew, ₪100, 5% and 09:00–18:00 isolated so they never flip. */
export function bidiSafe(lang: Lang, text: string): string {
  const joined = text.replace(NUMBER_SPACE, '$1\u00A0').replace(SHEKEL_SPACE, '₪\u00A0')
  return (RTL_LANGS as readonly Lang[]).includes(lang) ? joined.replace(LTR_RUN, isolate) : joined
}

// How each button or row is labelled; a member's tap shows in the inbox with this title.
const BUTTON_KEYS = {
  btn_perks: 'wa_bot_btn_perks',
  btn_pass: 'wa_bot_btn_pass',
  btn_talk_to_team: 'wa_bot_btn_team',
  btn_escalate_prompt: 'wa_bot_btn_escalate',
  btn_escalate_order: 'wa_bot_btn_escalate',
  btn_escalate_purchase: 'wa_bot_btn_escalate',
  btn_escalate_login: 'wa_bot_btn_escalate',
  btn_cancel_inquiry: 'wa_bot_btn_cancel',
  btn_ticket_resolved: 'wa_bot_btn_resolved',
  btn_back_to_menu: 'wa_bot_btn_menu',
  menu_order: 'wa_bot_row_order',
  menu_new_order: 'wa_bot_row_new_order',
  menu_pass: 'wa_bot_row_pass',
  menu_agent: 'wa_bot_row_agent',
  menu_login_help: 'wa_bot_row_login_help',
  opt_vouchers: 'wa_bot_row_vouchers',
  opt_venue: 'wa_bot_row_venue',
  opt_refund: 'wa_bot_row_refund',
  opt_pass: 'wa_bot_row_pass_open',
  opt_perks: 'wa_bot_row_perks',
  opt_account: 'wa_bot_row_account',
  menu_lang: 'wa_bot_btn_language',
  btn_idle_yes: 'wa_bot_btn_idle_yes',
  btn_idle_done: 'wa_bot_btn_resolved',
  btn_team_nudge_yes: 'wa_bot_btn_team_nudge_yes',
} as const satisfies Record<BotAction, TranslationKey>

/** Talk to Team from a topic's answer: the id carries the topic. */
const ESCALATE_IDS = {
  order_issue: 'btn_escalate_order',
  purchase_help: 'btn_escalate_purchase',
  login_help: 'btn_escalate_login',
  general: 'btn_escalate_prompt',
} as const satisfies Record<InquiryCategory, BotAction>

/** A button's label in `lang`, as the member saw it. */
export const buttonTitle = (lang: Lang, action: BotAction) => tr(lang, BUTTON_KEYS[action])

/** One choice: the id the tap answers with, its title, and (in a list) an optional line under it. */
export interface Choice {
  id: string
  title: string
  description?: string
}

/**
 * Every choice the bot offers goes through here, in one message: up to
 * three (BUTTONS_MAX) are reply buttons in the bubble; four to ten are a
 * list behind `listButton`. More than ten, or a list without its button,
 * is a programming error.
 */
export function choiceMessage(lang: Lang, body: string, choices: Choice[], options: { footer?: string; listButton?: string } = {}): WhatsAppMessage {
  const text = bidiSafe(lang, body)
  const footer = options.footer ? { footer: { text: options.footer } } : {}
  if (choices.length <= BUTTONS_MAX) {
    return {
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text },
        ...footer,
        action: { buttons: choices.map(({ id, title }) => ({ type: 'reply' as const, reply: { id, title } })) },
      },
    }
  }
  if (choices.length > LIST_ROWS_MAX) throw new Error(`A list holds at most ${LIST_ROWS_MAX} choices, not ${choices.length}.`)
  if (!options.listButton) throw new Error(`${choices.length} choices need a list button.`)
  return {
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text },
      ...footer,
      action: {
        button: options.listButton,
        sections: [{ rows: choices.map(({ id, title, description }) => ({ id, title, ...(description ? { description } : {}) })) }],
      },
    },
  }
}

const choicesOf = (lang: Lang, ids: readonly BotAction[]): Choice[] => ids.map((id) => ({ id, title: buttonTitle(lang, id), ...rowDescription(lang, id) }))

/** A body with up to three reply buttons. */
const buttonsMessage = (lang: Lang, body: string, ids: BotAction[], footer?: string) => choiceMessage(lang, body, choicesOf(lang, ids), { footer })

/** A message closed by a single "Main Menu" button. */
const withBackButton = (lang: Lang, key: TranslationKey): WhatsAppMessage => buttonsMessage(lang, tr(lang, key), ['btn_back_to_menu'])

// Login & Account help's full wording, where it is longer than the 24
// characters Meta allows a row title: the title is shortened and this is
// the row's description (a longer title would get the whole menu refused).
const LOGIN_HELP_DESCRIPTIONS: Partial<Record<Lang, string>> = {
  ru: 'Проблемы со входом и аккаунтом',
  fr: 'Aide à la connexion et compte',
  es: 'Ayuda para iniciar sesión y cuenta',
}

function rowDescription(lang: Lang, id: BotAction): { description?: string } {
  const description = id === 'menu_login_help' ? LOGIN_HELP_DESCRIPTIONS[lang] : undefined
  return description ? { description } : {}
}

/**
 * The main menu: its six rows in one list. After a language is picked,
 * `languageChanged` puts the confirmation ("Great! We'll continue in
 * English.") at the top of the same message.
 */
export function menuMessage(ctx: BotContext, options: { languageChanged?: boolean } = {}): WhatsAppMessage {
  const greeting = ctx.memberFirstName
    ? tr(ctx.lang, 'wa_bot_menu_body_named').replace('{name}', ctx.memberFirstName)
    : tr(ctx.lang, 'wa_bot_menu_body')
  const body = options.languageChanged ? `${tr(ctx.lang, 'wa_bot_lang_changed')}\n\n${greeting}` : greeting
  return choiceMessage(ctx.lang, body, choicesOf(ctx.lang, MENU_ROWS), { listButton: tr(ctx.lang, 'wa_bot_menu_button') })
}

/** "Existing order" and "My Pass & perks": their three options; "menu" (or any answer's Main Menu) goes back. */
export function submenuMessage(menu: Submenu, lang: Lang): WhatsAppMessage {
  const footer = tr(lang, 'wa_bot_submenu_footer')
  return menu === 'order'
    ? buttonsMessage(lang, tr(lang, 'wa_bot_order_body'), ['opt_vouchers', 'opt_venue', 'opt_refund'], footer)
    : buttonsMessage(lang, tr(lang, 'wa_bot_pass_menu_body'), ['opt_pass', 'opt_perks', 'opt_account'], footer)
}

/** Each language in its own script, as the picker shows it. */
export const LANGUAGE_NAMES: Record<Lang, string> = {
  en: 'English',
  he: 'עברית',
  ru: 'Русский',
  fr: 'Français',
  es: 'Español',
}

/** The first answer to a chat with no language picked, always in English. */
export const WELCOME_BODY = 'Hi! 👋 Welcome to Landly.\nPlease choose your language to continue:'
export const WELCOME_LIST_BUTTON = 'Choose language'

/**
 * The five languages in one list, ids lang_en … lang_es: the English
 * welcome while the chat awaits its language, else worded in `lang`.
 */
export function languagePickerMessage(lang: Lang | 'welcome'): WhatsAppMessage {
  const choices = BOT_LANGUAGES.map((code) => ({ id: `lang_${code}`, title: LANGUAGE_NAMES[code] }))
  if (lang === 'welcome') return choiceMessage('en', WELCOME_BODY, choices, { listButton: WELCOME_LIST_BUTTON })
  return choiceMessage(lang, tr(lang, 'wa_bot_language_body'), choices, { listButton: tr(lang, 'wa_bot_language_button') })
}

function linkCard(lang: Lang, bodyKey: TranslationKey, labelKey: TranslationKey, url: string): WhatsAppMessage {
  return {
    type: 'interactive',
    interactive: {
      type: 'cta_url',
      body: { text: bidiSafe(lang, tr(lang, bodyKey)) },
      action: { name: 'cta_url', parameters: { display_text: tr(lang, labelKey), url } },
    },
  }
}

/**
 * A topic's answer. A link card holds only its link (a reply button can't
 * hold one), so the follow-up buttons come next; an answer without a link
 * is the follow-up's own body.
 */
export function topicMessages(topic: Topic, ctx: BotContext): WhatsAppMessage[] {
  const { lang, origin } = ctx
  switch (topic) {
    case 'vouchers':
      return [linkCard(lang, 'wa_bot_vouchers_body', 'wa_bot_vouchers_cta', `${origin}/member`), followUpMessage(lang, 'order_issue')]
    case 'venue':
      return [followUpMessage(lang, 'order_issue', 'wa_bot_venue_body')]
    case 'refund':
      return [followUpMessage(lang, 'order_issue', 'wa_bot_refund_body')]
    case 'new_order':
      return [linkCard(lang, 'wa_bot_new_order_body', 'wa_bot_new_order_cta', `${origin}/categories`), followUpMessage(lang, 'purchase_help')]
    case 'pass':
      return [
        linkCard(lang, ctx.isMember ? 'wa_bot_pass_body_member' : 'wa_bot_pass_body_guest', 'wa_bot_pass_cta', `${origin}/member`),
        followUpMessage(lang, 'general'),
      ]
    case 'perks':
      return [linkCard(lang, 'wa_bot_perks_body', 'wa_bot_perks_cta', `${origin}/categories`), followUpMessage(lang, 'general')]
    case 'login_help':
      return [linkCard(lang, 'wa_bot_login_help_body', 'wa_bot_login_help_cta', `${origin}/forgot-password`), followUpMessage(lang, 'login_help')]
  }
}

/** Ends every answer: did it help, or does the member need a person (about `category`)? */
export function followUpMessage(lang: Lang, category: InquiryCategory = 'general', bodyKey: TranslationKey = 'wa_bot_followup_body'): WhatsAppMessage {
  const escalate = ESCALATE_IDS[category]
  return buttonsMessage(lang, tr(lang, bodyKey), ['btn_ticket_resolved', escalate, 'btn_back_to_menu'])
}

export const inquiryPromptMessage = (lang: Lang) => buttonsMessage(lang, tr(lang, 'wa_bot_inquiry_prompt'), ['btn_cancel_inquiry'])
/** The one check-in to a member who went quiet (lib/whatsapp/idleSweep.ts). */
export const idleCheckInMessage = (lang: Lang) => buttonsMessage(lang, tr(lang, 'wa_bot_idle_checkin'), ['btn_idle_yes', 'btn_idle_done'])
export const escalatedMessage = (lang: Lang) => withBackButton(lang, 'wa_bot_team_confirm')
export const alreadyEscalatedMessage = (lang: Lang) => withBackButton(lang, 'wa_bot_team_already')
export const resolvedMessage = (lang: Lang) => withBackButton(lang, 'wa_bot_resolved')
/** The team's one follow-up to a member who went quiet after its reply (lib/whatsapp/idleSweep.ts). */
export const teamNudgeMessage = (lang: Lang) => buttonsMessage(lang, tr(lang, 'wa_team_nudge'), ['btn_idle_done', 'btn_team_nudge_yes'])
/** The sign-off when the team resolves a conversation from the inbox. */
export const teamResolvedMessage = (lang: Lang) => withBackButton(lang, 'wa_team_resolved_thanks')

export function textMessage(lang: Lang, key: 'wa_bot_nudge' | 'wa_bot_team_failed', email = ''): WhatsAppMessage {
  return { type: 'text', text: { body: bidiSafe(lang, tr(lang, key)).replace('{email}', isolate(email)) } }
}

/** A sent message as plain text for the support inbox: its body, then its buttons, list rows or link. */
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
