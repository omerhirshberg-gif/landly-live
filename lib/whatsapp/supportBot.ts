import { translations, type Lang, type TranslationKey } from '@/lib/i18n/translations'
import type { WhatsAppMessage } from './graph'
import type { BotAction, InboundEvent } from './webhookPayload'

// The support bot's decisions, with no I/O (lib/whatsapp/supportBotHandler.ts
// does the sending, storing and emailing):
//
// - any message: a menu of three reply buttons (Member Perks, Landly Pass,
//   Talk to Team), at most once every MENU_THROTTLE_MS per number;
// - "Member Perks" / "Landly Pass": a link button to /categories or /member
//   (a reply button can't hold a link);
// - "Talk to Team": the team is emailed, the member is told, and the bot
//   stays quiet for ESCALATION_SILENCE_MS so it never talks over a person.
//   A link button tapped meanwhile still answers; typed messages don't.
//
// Every reply is sent within Meta's 24-hour customer-service window, so no
// template is needed.

export const MENU_THROTTLE_MS = 10 * 60 * 1000
export const ESCALATION_SILENCE_MS = 24 * 60 * 60 * 1000

/** Meta's limits: 20 characters for a button title or link label, 1024 for a body. */
export const BUTTON_TITLE_MAX = 20

export interface BotContext {
  lang: Lang
  /** The site origin (APP_URL), for the link buttons. */
  origin: string
  /** First name of the member whose phone matches the sender, when there is one. */
  memberFirstName?: string
  isMember: boolean
  lastMenuAt?: number
  escalatedAt?: number
  now: number
}

export type BotDecision =
  | { kind: 'silent' }
  | { kind: 'menu' }
  | { kind: 'link'; action: Exclude<BotAction, 'team'> }
  | { kind: 'escalate' }
  | { kind: 'alreadyEscalated' }

export function decide(event: InboundEvent, ctx: BotContext): BotDecision {
  const escalated = ctx.escalatedAt !== undefined && ctx.now - ctx.escalatedAt < ESCALATION_SILENCE_MS
  if (event.kind === 'button') {
    if (event.action !== 'team') return { kind: 'link', action: event.action }
    return escalated ? { kind: 'alreadyEscalated' } : { kind: 'escalate' }
  }
  if (escalated) return { kind: 'silent' }
  if (ctx.lastMenuAt !== undefined && ctx.now - ctx.lastMenuAt < MENU_THROTTLE_MS) return { kind: 'silent' }
  return { kind: 'menu' }
}

/**
 * The language the bot answers in: the member's profile language when the
 * number belongs to one, else Hebrew for Israeli numbers and English for the rest.
 */
export function botLanguage(waId: string, memberLang?: unknown): Lang {
  if (typeof memberLang === 'string' && Object.hasOwn(translations, memberLang)) return memberLang as Lang
  return waId.startsWith('972') ? 'he' : 'en'
}

const tr = (lang: Lang, key: TranslationKey) => translations[lang][key] ?? translations.en[key]

// LRI…PDI: an address or number stays left-to-right inside a Hebrew sentence.
const isolate = (value: string) => `⁦${value}⁩`

const BUTTON_KEYS = { perks: 'wa_bot_btn_perks', pass: 'wa_bot_btn_pass', team: 'wa_bot_btn_team' } as const satisfies Record<BotAction, TranslationKey>

export function menuMessage(ctx: BotContext): WhatsAppMessage {
  const body = ctx.memberFirstName
    ? tr(ctx.lang, 'wa_bot_menu_body_named').replace('{name}', ctx.memberFirstName)
    : tr(ctx.lang, 'wa_bot_menu_body')
  return {
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: body },
      action: {
        buttons: (['perks', 'pass', 'team'] as const).map((id) => ({
          type: 'reply' as const,
          reply: { id, title: tr(ctx.lang, BUTTON_KEYS[id]) },
        })),
      },
    },
  }
}

export function linkMessage(action: Exclude<BotAction, 'team'>, ctx: BotContext): WhatsAppMessage {
  const [bodyKey, labelKey, path]: [TranslationKey, TranslationKey, string] =
    action === 'perks'
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

export function textMessage(lang: Lang, key: 'wa_bot_team_confirm' | 'wa_bot_team_already' | 'wa_bot_team_failed', email = ''): WhatsAppMessage {
  return { type: 'text', text: { body: tr(lang, key).replace('{email}', isolate(email)) } }
}
