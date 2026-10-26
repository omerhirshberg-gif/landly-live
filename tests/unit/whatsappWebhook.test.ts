import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Timestamp } from 'firebase-admin/firestore'
import { MemoryFirestore } from '../helpers/memoryFirestore'

const mocks = vi.hoisted(() => ({
  store: null as unknown as MemoryFirestore,
  send: vi.fn(),
  tasks: [] as Promise<unknown>[],
}))
// after() needs a request scope; here it runs the task at once and keeps its promise.
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (task: () => unknown) => { mocks.tasks.push(Promise.resolve(task())) },
}))
vi.mock('resend', () => ({ Resend: class { emails = { send: mocks.send } } }))
vi.mock('@/lib/firebase/admin', () => ({ getAdminDb: () => mocks.store.db, getAdminProjectId: () => 'demo-landly' }))

import { GET, POST } from '@/app/api/webhooks/whatsapp/route'
import { verifyMetaSignature, verifyTokenMatches } from '@/lib/whatsapp/signature'
import { parseWebhookPayload, payloadPhoneNumberIds, type BotAction, type InboundEvent } from '@/lib/whatsapp/webhookPayload'
import { graphVersion } from '@/lib/whatsapp/graph'
import {
  alreadyEscalatedMessage,
  bidiSafe,
  BODY_MAX,
  botLanguage,
  BUTTON_TITLE_MAX,
  BUTTONS_MAX,
  choiceMessage,
  currentStatus,
  decide,
  ESCALATION_SILENCE_MS,
  escalatedMessage,
  followUpMessage,
  FOOTER_MAX,
  GREETING_COOLDOWN_MS,
  idleCheckInMessage,
  INQUIRY_TIMEOUT_MS,
  inquiryPromptMessage,
  isLanguageKeyword,
  isMenuKeyword,
  languagePickerMessage,
  LIST_BUTTON_MAX,
  LIST_ROWS_MAX,
  menuMessage,
  resolvedMessage,
  teamNudgeMessage,
  teamResolvedMessage,
  ROW_DESCRIPTION_MAX,
  ROW_TITLE_MAX,
  submenuMessage,
  topicMessages,
  transcriptText,
  typedLanguage,
  WELCOME_BODY,
  WELCOME_LIST_BUTTON,
  type Topic,
  type BotContext,
} from '@/lib/whatsapp/supportBot'
import { MESSAGE_TTL_MS } from '@/lib/whatsapp/conversationLog'
import { handleInboundEvent } from '@/lib/whatsapp/supportBotHandler'
import { escalationEmail } from '@/lib/whatsapp/escalation'
import { translations, type Lang } from '@/lib/i18n/translations'
import { assertAdminCredentials, firebaseDeployTarget, PRODUCTION_FIREBASE_PROJECT_ID, STAGING_FIREBASE_PROJECT_ID } from '@/lib/firebase/envGuard'

const SECRET = 'app-secret'
const PHONE_ID = '1460975470423545'
const WA_ID = '972501234567'
const nowSeconds = () => String(Math.floor(Date.now() / 1000))

function payload(messages: unknown[], { phoneNumberId = PHONE_ID, name = 'Dana' } = {}) {
  return {
    object: 'whatsapp_business_account',
    entry: [{
      id: 'WABA',
      changes: [{
        field: 'messages',
        value: {
          messaging_product: 'whatsapp',
          metadata: { display_phone_number: '15550000000', phone_number_id: phoneNumberId },
          contacts: [{ profile: { name }, wa_id: WA_ID }],
          messages,
        },
      }],
    }],
  }
}
const textMsg = (id: string, body: string) => ({ from: WA_ID, id, timestamp: nowSeconds(), type: 'text', text: { body } })
const buttonMsg = (id: string, button: string) => ({
  from: WA_ID, id, timestamp: nowSeconds(), type: 'interactive', interactive: { type: 'button_reply', button_reply: { id: button, title: button } },
})
const listMsg = (id: string, row: string) => ({
  from: WA_ID, id, timestamp: nowSeconds(), type: 'interactive', interactive: { type: 'list_reply', list_reply: { id: row, title: row } },
})

const sign = (raw: string, secret = SECRET) => `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`
function signedPost(body: unknown, signature?: string) {
  const raw = JSON.stringify(body)
  return new Request('https://landly.test/api/webhooks/whatsapp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': signature ?? sign(raw) },
    body: raw,
  })
}
const verifyGet = (query: string) => new Request(`https://landly.test/api/webhooks/whatsapp?${query}`)

/** Bodies the bot "sent", read back from the simulated-reply log. */
let info: ReturnType<typeof vi.spyOn>
let log: ReturnType<typeof vi.spyOn>
let warn: ReturnType<typeof vi.spyOn>
let error: ReturnType<typeof vi.spyOn>
const lines = (spy: ReturnType<typeof vi.spyOn>) => (spy.mock.calls as unknown[][]).map(([line]) => String(line))
const replies = () =>
  (info.mock.calls as unknown[][])
    .map(([line]) => String(line))
    .filter((line) => line.startsWith('[whatsapp-bot] simulated reply'))
    .map((line) => JSON.parse(line.slice(line.indexOf('{'))))

type SentChoices = { interactive: { action: { buttons?: { reply: { id: string } }[]; sections?: { rows: { id: string }[] }[] } } }
/** The ids a message offers: its reply buttons, or its list rows. */
const choiceIds = (message: unknown) => {
  const { action } = (message as SentChoices).interactive
  return action.buttons ? action.buttons.map((b) => b.reply.id) : (action.sections ?? []).flatMap((s) => s.rows.map((r) => r.id))
}
/** Every choice id across a run of messages, in order. */
const allChoiceIds = (messages: unknown[]) => messages.flatMap(choiceIds)
/** The rows of the language list, and of the menu. */
const LANGUAGE_IDS = ['lang_en', 'lang_he', 'lang_ru', 'lang_fr', 'lang_es']
const MENU_IDS = ['menu_order', 'menu_new_order', 'menu_pass', 'menu_agent', 'menu_login_help', 'menu_lang']
const TOPICS: Topic[] = ['vouchers', 'venue', 'refund', 'new_order', 'pass', 'perks', 'login_help']
const LANGUAGE_NAMES_IN_ORDER = ['English', 'עברית', 'Русский', 'Français', 'Español']

const event = (overrides: Partial<InboundEvent> & Pick<InboundEvent, 'kind'>): InboundEvent =>
  ({ messageId: `wamid.${Math.random()}`, waId: WA_ID, at: Date.now(), ...(overrides.kind === 'text' ? { text: 'hi' } : {}), ...overrides }) as InboundEvent

beforeEach(() => {
  vi.clearAllMocks()
  mocks.tasks = []
  mocks.store = new MemoryFirestore()
  mocks.send.mockResolvedValue({ error: null })
  vi.stubEnv('WHATSAPP_APP_SECRET', SECRET)
  vi.stubEnv('WHATSAPP_VERIFY_TOKEN', 'verify-me')
  vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', PHONE_ID)
  vi.stubEnv('APP_URL', 'https://landly.test/')
  vi.stubEnv('EMAIL_FROM', 'test@landly.test')
  vi.stubEnv('RESEND_API_KEY', 'fake-test-key')
  info = vi.spyOn(console, 'info').mockImplementation(() => {})
  log = vi.spyOn(console, 'log').mockImplementation(() => {})
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  error = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('webhook signature', () => {
  const raw = Buffer.from('{"object":"whatsapp_business_account"}')

  it('accepts the app-secret HMAC of the raw body', () => {
    expect(verifyMetaSignature(raw, sign(raw.toString()), SECRET)).toBe(true)
  })

  it('refuses a missing, malformed, wrong-secret or tampered signature', () => {
    expect(verifyMetaSignature(raw, null, SECRET)).toBe(false)
    expect(verifyMetaSignature(raw, 'sha1=abc', SECRET)).toBe(false)
    expect(verifyMetaSignature(raw, 'sha256=abc', SECRET)).toBe(false)
    expect(verifyMetaSignature(raw, sign(raw.toString(), 'other'), SECRET)).toBe(false)
    expect(verifyMetaSignature(Buffer.from('{"object":"x"}'), sign(raw.toString()), SECRET)).toBe(false)
    expect(verifyMetaSignature(raw, sign(raw.toString()), '')).toBe(false)
  })

  it('compares verify tokens of any length', () => {
    expect(verifyTokenMatches('verify-me', 'verify-me')).toBe(true)
    expect(verifyTokenMatches('verify', 'verify-me')).toBe(false)
    expect(verifyTokenMatches(null, 'verify-me')).toBe(false)
  })
})

describe('GET /api/webhooks/whatsapp', () => {
  it('echoes the challenge for the right verify token', async () => {
    const res = GET(verifyGet('hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=1158201444'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/plain')
    expect(await res.text()).toBe('1158201444')
  })

  it('refuses a wrong token, mode or challenge', () => {
    expect(GET(verifyGet('hub.mode=subscribe&hub.verify_token=nope&hub.challenge=1')).status).toBe(403)
    expect(GET(verifyGet('hub.mode=unsubscribe&hub.verify_token=verify-me&hub.challenge=1')).status).toBe(403)
    expect(GET(verifyGet('hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=%3Cscript%3E')).status).toBe(403)
    expect(GET(verifyGet('hub.mode=subscribe&hub.verify_token=verify-me')).status).toBe(403)
  })

  it('is unavailable until WHATSAPP_VERIFY_TOKEN is set', () => {
    vi.stubEnv('WHATSAPP_VERIFY_TOKEN', '')
    expect(GET(verifyGet('hub.mode=subscribe&hub.verify_token=&hub.challenge=1')).status).toBe(503)
  })
})

describe('POST /api/webhooks/whatsapp', () => {
  it('refuses every delivery while WHATSAPP_APP_SECRET is unset', async () => {
    vi.stubEnv('WHATSAPP_APP_SECRET', '')
    expect((await POST(signedPost(payload([textMsg('wamid.1', 'hi')])))).status).toBe(503)
    expect(mocks.tasks).toHaveLength(0)
  })

  it('refuses a bad signature without touching anything', async () => {
    const res = await POST(signedPost(payload([textMsg('wamid.1', 'hi')]), 'sha256=' + '0'.repeat(64)))
    expect(res.status).toBe(401)
    expect(mocks.tasks).toHaveLength(0)
    expect(lines(error)).toEqual([expect.stringContaining('[whatsapp-webhook] Invalid signature')])
  })

  it('logs a delivery without a signature header before refusing it', async () => {
    const res = await POST(new Request('https://landly.test/api/webhooks/whatsapp', { method: 'POST', body: '{}' }))
    expect(res.status).toBe(401)
    expect(lines(error)).toEqual(['[whatsapp-webhook] Delivery without an x-hub-signature-256 header'])
  })

  it('logs each delivery with its event count, receiving number and masked senders', async () => {
    await POST(signedPost(payload([textMsg('wamid.1', 'היי')])))
    expect(lines(log)).toEqual([`[whatsapp-webhook] Received 1 message event(s) for phone_number_id ${PHONE_ID} from +97 •••• 4567`])
    expect(lines(log)[0]).not.toContain(WA_ID)
  })

  it('answers a message to another number on the account from that number, with a notice', async () => {
    vi.stubEnv('WHATSAPP_OTP_LIVE', 'true')
    vi.stubEnv('WHATSAPP_ACCESS_TOKEN', 'token')
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const res = await POST(signedPost(payload([textMsg('wamid.1', 'menu')], { phoneNumberId: '1367683866451764' })))
    expect(res.status).toBe(200)
    await Promise.all(mocks.tasks)
    expect(lines(info)).toContain(`[whatsapp-webhook] Ingesting message for phone ID: 1367683866451764 (configured env: ${PHONE_ID})`)
    expect(lines(log)).toEqual(['[whatsapp-webhook] Received 1 message event(s) for phone_number_id 1367683866451764 from +97 •••• 4567'])
    expect(fetchMock.mock.calls[0][0]).toBe('https://graph.facebook.com/v21.0/1367683866451764/messages')
    expect(warn).not.toHaveBeenCalled()
  })

  it('answers 200 and greets a new number with one English language list in after()', async () => {
    const res = await POST(signedPost(payload([textMsg('wamid.1', 'Hello')])))
    expect(res.status).toBe(200)
    await Promise.all(mocks.tasks)
    const picker = replies()
    // Even a +972 number: English until they pick.
    expect(picker).toHaveLength(1)
    expect(picker[0].interactive).toMatchObject({ type: 'list', body: { text: WELCOME_BODY }, action: { button: WELCOME_LIST_BUTTON } })
    expect(picker[0].interactive).not.toHaveProperty('footer')
    expect(allChoiceIds(picker)).toEqual(LANGUAGE_IDS)
  })

  it('answers a picked language row with the menu in that language, in one message', async () => {
    await POST(signedPost(payload([listMsg('wamid.1', 'lang_es')])))
    await Promise.all(mocks.tasks)
    expect(replies()).toHaveLength(1)
    const [menu] = replies()
    expect(menu.interactive.type).toBe('list')
    expect(menu.interactive.body.text).toBe(`${translations.es.wa_bot_lang_changed}\n\n${translations.es.wa_bot_menu_body}`)
    expect(choiceIds(menu)).toEqual(MENU_IDS)
    expect(mocks.store.read(`whatsappConversations/${WA_ID}`)).toMatchObject({ lang: 'es' })
  })

  it('still answers a language button sent before the list', async () => {
    await POST(signedPost(payload([buttonMsg('wamid.1', 'lang_ru')])))
    await Promise.all(mocks.tasks)
    expect(replies()[0].interactive.body.text.startsWith(translations.ru.wa_bot_lang_changed)).toBe(true)
  })

  it('never splits a reply: the welcome, the menu after a pick, and the menu on request are one list each', async () => {
    const deliver = async (message: unknown) => {
      const before = replies().length
      await POST(signedPost(payload([message])))
      await Promise.all(mocks.tasks)
      return replies().slice(before)
    }
    const welcome = await deliver(textMsg('wamid.1', 'hi'))
    expect(welcome.map((m) => m.interactive.type)).toEqual(['list'])
    expect(allChoiceIds(welcome)).toEqual(LANGUAGE_IDS)
    const afterPick = await deliver(listMsg('wamid.2', 'lang_he'))
    expect(afterPick.map((m) => m.interactive.type)).toEqual(['list'])
    expect(allChoiceIds(afterPick)).toEqual(MENU_IDS)
    const onRequest = await deliver(textMsg('wamid.3', 'תפריט'))
    expect(onRequest.map((m) => m.interactive.type)).toEqual(['list'])
    expect(onRequest[0].interactive.body.text).toBe(translations.he.wa_bot_menu_body)
    // A row picked from the menu list works like a tapped button.
    const agent = await deliver(listMsg('wamid.4', 'menu_agent'))
    expect(agent).toHaveLength(1)
    expect(agent[0].interactive.body.text).toBe(translations.he.wa_bot_inquiry_prompt)
  })

  it('acknowledges delivery statuses without any bot work', async () => {
    const body = payload([])
    ;(body.entry[0].changes[0].value as Record<string, unknown>).statuses = [{ id: 'wamid.1', status: 'delivered' }]
    const res = await POST(signedPost(body))
    expect(res.status).toBe(200)
    expect(mocks.tasks).toHaveLength(0)
  })

  it('answers a retried delivery only once', async () => {
    await POST(signedPost(payload([textMsg('wamid.same', 'hi')])))
    await POST(signedPost(payload([textMsg('wamid.same', 'hi')])))
    await Promise.all(mocks.tasks)
    // One language list.
    expect(replies()).toHaveLength(1)
  })
})

describe('parseWebhookPayload', () => {
  it('flattens text, reply-button and attachment messages with the profile name', () => {
    const events = parseWebhookPayload(
      payload([textMsg('a', 'hi'), buttonMsg('b', 'pass'), { from: WA_ID, id: 'c', timestamp: nowSeconds(), type: 'image', image: {} }]),
      PHONE_ID
    )
    // An attachment keeps its kind even without a usable media id (it shows as not saved).
    expect(events.map((e) => e.kind)).toEqual(['text', 'button', 'media'])
    expect(events[2]).toMatchObject({ media: { type: 'image' } })
    expect(events[0]).toMatchObject({ messageId: 'a', waId: WA_ID, name: 'Dana', text: 'hi' })
    // A menu sent before the btn_* ids still works.
    expect(events[1]).toMatchObject({ action: 'btn_pass' })
    expect(events.every((e) => e.phoneNumberId === PHONE_ID)).toBe(true)
  })

  it('keeps messages to every number on the account, each with its receiving number', () => {
    expect(parseWebhookPayload(payload([textMsg('a', 'hi')], { phoneNumberId: '999' }), PHONE_ID)[0]).toMatchObject({ messageId: 'a', phoneNumberId: '999' })
    expect(parseWebhookPayload(payload([textMsg('a', 'hi')], { phoneNumberId: '1367683866451764' }))[0].phoneNumberId).toBe('1367683866451764')
    // A malformed id never reaches the Graph URL.
    expect(parseWebhookPayload(payload([textMsg('a', 'hi')], { phoneNumberId: '../me' }))[0].phoneNumberId).toBeUndefined()
    expect(payloadPhoneNumberIds(payload([], { phoneNumberId: '42' }))).toEqual(['42'])
    expect(payloadPhoneNumberIds({ object: 'page' })).toEqual([])
  })

  it('stays quiet about statuses for the business account\'s other numbers', () => {
    const body = payload([], { phoneNumberId: '999' })
    ;(body.entry[0].changes[0].value as Record<string, unknown>).statuses = [{ id: 'wamid.1', status: 'read' }]
    expect(parseWebhookPayload(body, PHONE_ID)).toEqual([])
    expect(info).not.toHaveBeenCalled()
  })

  it('skips other objects, reactions and malformed senders', () => {
    expect(parseWebhookPayload({ object: 'page', entry: [] }, PHONE_ID)).toEqual([])
    expect(parseWebhookPayload(payload([{ from: WA_ID, id: 'r', type: 'reaction' }]), PHONE_ID)).toEqual([])
    expect(parseWebhookPayload(payload([{ from: '+97250', id: 'x', type: 'text', text: { body: 'hi' } }]), PHONE_ID)).toEqual([])
    expect(parseWebhookPayload(null)).toEqual([])
  })

  it('maps every btn_* id and the legacy ids to their actions', () => {
    const ids = ['btn_ticket_resolved', 'btn_escalate_prompt', 'btn_escalate_login', 'btn_back_to_menu', 'btn_cancel_inquiry', 'btn_idle_yes', 'btn_idle_done', 'menu_lang', 'menu_login_help', 'perks', 'team']
    const events = parseWebhookPayload(payload(ids.map((id, i) => buttonMsg(`m${i}`, id))), PHONE_ID)
    expect(events.map((e) => e.kind === 'button' && e.action)).toEqual([
      'btn_ticket_resolved', 'btn_escalate_prompt', 'btn_escalate_login', 'btn_back_to_menu', 'btn_cancel_inquiry', 'btn_idle_yes', 'btn_idle_done', 'menu_lang', 'menu_login_help', 'btn_perks', 'btn_talk_to_team',
    ])
  })

  it('reads a picked language row or an older button, and keeps the type of other messages and attachments', () => {
    const events = parseWebhookPayload(
      payload([
        buttonMsg('a', 'lang_he'),
        listMsg('b', 'lang_ru'),
        buttonMsg('c', 'lang_de'),
        listMsg('d', 'lang_toString'),
        { from: WA_ID, id: 'e', timestamp: nowSeconds(), type: 'audio', audio: {} },
      ]),
      PHONE_ID
    )
    expect(events[0]).toMatchObject({ kind: 'language', lang: 'he' })
    expect(events[1]).toMatchObject({ kind: 'language', lang: 'ru' })
    expect(events[2]).toMatchObject({ kind: 'other', media: 'interactive' })
    expect(events[3]).toMatchObject({ kind: 'other', media: 'interactive' })
    expect(events[4]).toMatchObject({ kind: 'media', media: { type: 'audio' } })
  })

  it('reads a row picked from the menu list as the action it stands for', () => {
    const events = parseWebhookPayload(
      payload([listMsg('wamid.1', 'menu_order'), listMsg('wamid.2', 'menu_agent'), listMsg('wamid.3', 'menu_login_help'), listMsg('wamid.4', 'opt_refund'), listMsg('wamid.5', 'nope')])
    )
    expect(events.map((e) => [e.kind, e.kind === 'button' ? e.action : e.kind === 'other' ? e.media : null])).toEqual([
      ['button', 'menu_order'],
      ['button', 'menu_agent'],
      ['button', 'menu_login_help'],
      ['button', 'opt_refund'],
      ['other', 'interactive'],
    ])
  })

  it('treats an unknown button id as a plain message', () => {
    expect(parseWebhookPayload(payload([buttonMsg('b', 'evil')]), PHONE_ID)[0].kind).toBe('other')
    expect(parseWebhookPayload(payload([buttonMsg('b', 'toString')]), PHONE_ID)[0].kind).toBe('other')
  })
})

describe('support bot decisions', () => {
  const ctx = (over: Partial<BotContext> = {}): BotContext => ({ lang: 'en', origin: 'https://landly.test', isMember: false, now: Date.now(), ...over })
  const text = (body: string) => event({ kind: 'text', text: body })

  it('answers free text with the menu, then one nudge per 90-second window, then nothing', () => {
    const now = Date.now()
    expect(decide(text('hi'), ctx({ now }))).toEqual({ kind: 'menu' })
    expect(decide(text('hi'), ctx({ lastMenuAt: now - 1000, now }))).toEqual({ kind: 'nudge' })
    expect(decide(text('hi'), ctx({ lastMenuAt: now - 2000, lastNudgeAt: now - 1000, now }))).toEqual({ kind: 'silent' })
    // A nudge from an earlier window doesn't count.
    expect(decide(text('hi'), ctx({ lastMenuAt: now - 1000, lastNudgeAt: now - 5000, now }))).toEqual({ kind: 'nudge' })
    expect(decide(text('hi'), ctx({ lastMenuAt: now - GREETING_COOLDOWN_MS, lastNudgeAt: now - 1000, now }))).toEqual({ kind: 'menu' })
  })

  it('answers every button at once, whatever the cooldown', () => {
    const now = Date.now()
    const busy = ctx({ lastMenuAt: now - 1000, lastNudgeAt: now - 500, now })
    expect(decide(event({ kind: 'button', action: 'btn_perks' }), busy)).toEqual({ kind: 'topic', topic: 'perks' })
    expect(decide(event({ kind: 'button', action: 'btn_back_to_menu' }), busy)).toEqual({ kind: 'menu' })
    expect(decide(event({ kind: 'button', action: 'btn_cancel_inquiry' }), busy)).toEqual({ kind: 'menu' })
    expect(decide(event({ kind: 'button', action: 'btn_ticket_resolved' }), busy)).toEqual({ kind: 'resolve' })
    expect(decide(event({ kind: 'button', action: 'btn_talk_to_team' }), busy)).toEqual({ kind: 'promptInquiry', category: 'general' })
    expect(decide(event({ kind: 'button', action: 'btn_escalate_prompt' }), busy)).toEqual({ kind: 'promptInquiry', category: 'general' })
  })

  it('walks the menu tree: two submenus, self-service answers, and Talk to Team tagged by topic', () => {
    const tap = (action: BotAction) => decide(event({ kind: 'button', action }), ctx())
    expect(tap('menu_order')).toEqual({ kind: 'submenu', menu: 'order' })
    expect(tap('menu_pass')).toEqual({ kind: 'submenu', menu: 'pass' })
    expect(tap('menu_new_order')).toEqual({ kind: 'topic', topic: 'new_order' })
    expect(tap('menu_agent')).toEqual({ kind: 'promptInquiry', category: 'general' })
    expect(tap('opt_vouchers')).toEqual({ kind: 'topic', topic: 'vouchers' })
    expect(tap('opt_venue')).toEqual({ kind: 'topic', topic: 'venue' })
    expect(tap('opt_refund')).toEqual({ kind: 'topic', topic: 'refund' })
    expect(tap('opt_pass')).toEqual({ kind: 'topic', topic: 'pass' })
    expect(tap('opt_perks')).toEqual({ kind: 'topic', topic: 'perks' })
    expect(tap('opt_account')).toEqual({ kind: 'promptInquiry', category: 'general' })
    expect(tap('btn_escalate_order')).toEqual({ kind: 'promptInquiry', category: 'order_issue' })
    expect(tap('btn_escalate_purchase')).toEqual({ kind: 'promptInquiry', category: 'purchase_help' })
    expect(tap('menu_login_help')).toEqual({ kind: 'topic', topic: 'login_help' })
    expect(tap('btn_escalate_login')).toEqual({ kind: 'promptInquiry', category: 'login_help' })
  })

  it('ends each order answer with Talk to Team for the order, and a new-order answer with Talk to Team for a purchase', () => {
    const escalateId = (topic: Topic) => choiceIds(topicMessages(topic, ctx()).at(-1) as never)[1]
    expect(escalateId('vouchers')).toBe('btn_escalate_order')
    expect(escalateId('venue')).toBe('btn_escalate_order')
    expect(escalateId('refund')).toBe('btn_escalate_order')
    expect(escalateId('new_order')).toBe('btn_escalate_purchase')
    expect(escalateId('pass')).toBe('btn_escalate_prompt')
    expect(escalateId('perks')).toBe('btn_escalate_prompt')
    expect(escalateId('login_help')).toBe('btn_escalate_login')
    // Answers without a link are a single message: the answer is the follow-up's body.
    expect(topicMessages('refund', ctx())).toHaveLength(1)
    expect(transcriptText(topicMessages('refund', ctx())[0])).toContain('14\u00A0days')
    expect(topicMessages('vouchers', ctx())).toHaveLength(2)
  })

  it('answers Login & Account help with the OTP tips and a Resend link card to /forgot-password', () => {
    const [card, followUp] = topicMessages('login_help', ctx({ lang: 'he' }))
    if (card.type !== 'interactive' || card.interactive.type !== 'cta_url') throw new Error('expected a link card')
    expect(card.interactive.body.text).toBe(bidiSafe('he', translations.he.wa_bot_login_help_body))
    expect(card.interactive.action.parameters).toEqual({ display_text: translations.he.wa_bot_login_help_cta, url: 'https://landly.test/forgot-password' })
    expect(translations.en.wa_bot_login_help_cta).toBe('Resend link')
    expect(choiceIds(followUp)).toEqual(['btn_ticket_resolved', 'btn_escalate_login', 'btn_back_to_menu'])
  })

  it('titles the Login & Account row as asked, moving wording past 24 characters into the row description', () => {
    const row = (lang: Lang) => {
      const menu = menuMessage(ctx({ lang }))
      if (menu.type !== 'interactive' || menu.interactive.type !== 'list') throw new Error('expected a list message')
      return menu.interactive.action.sections[0].rows.find((r) => r.id === 'menu_login_help')
    }
    expect(row('en')).toEqual({ id: 'menu_login_help', title: '\uD83D\uDD10 Login & Account help' })
    expect(row('he')).toEqual({ id: 'menu_login_help', title: '\uD83D\uDD10 \u05E2\u05D6\u05E8\u05D4 \u05D1\u05D4\u05EA\u05D7\u05D1\u05E8\u05D5\u05EA \u05D5\u05D7\u05E9\u05D1\u05D5\u05DF' })
    expect(row('ru')).toEqual({ id: 'menu_login_help', title: '\uD83D\uDD10 \u0412\u0445\u043E\u0434 \u0438 \u0430\u043A\u043A\u0430\u0443\u043D\u0442', description: '\u041F\u0440\u043E\u0431\u043B\u0435\u043C\u044B \u0441\u043E \u0432\u0445\u043E\u0434\u043E\u043C \u0438 \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u043E\u043C' })
    expect(row('fr')).toEqual({ id: 'menu_login_help', title: '\uD83D\uDD10 Connexion et compte', description: 'Aide \u00E0 la connexion et compte' })
    expect(row('es')).toEqual({ id: 'menu_login_help', title: '\uD83D\uDD10 Sesi\u00F3n y cuenta', description: 'Ayuda para iniciar sesi\u00F3n y cuenta' })
  })

  it('dispatches choices by count: up to three as buttons, four to ten as one list, never more', () => {
    const choices = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `c${i}`, title: `Choice ${i}`, description: 'More' }))
    for (const n of [1, 2, 3]) {
      const message = choiceMessage('en', 'Body', choices(n), { listButton: 'Pick' })
      if (message.type !== 'interactive' || message.interactive.type !== 'button') throw new Error('expected a button message')
      expect(message.interactive.action.buttons).toHaveLength(n)
      expect(JSON.stringify(message)).not.toContain('description')
    }
    for (const n of [4, 7, 10]) {
      const message = choiceMessage('en', 'Body', choices(n), { listButton: 'Pick' })
      if (message.type !== 'interactive' || message.interactive.type !== 'list') throw new Error('expected a list message')
      expect(message.interactive.action.button).toBe('Pick')
      expect(message.interactive.action.sections).toHaveLength(1)
      expect(message.interactive.action.sections[0].rows).toHaveLength(n)
      expect(message.interactive.action.sections[0].rows[0]).toEqual({ id: 'c0', title: 'Choice 0', description: 'More' })
    }
    expect(() => choiceMessage('en', 'Body', choices(11), { listButton: 'Pick' })).toThrow()
    expect(() => choiceMessage('en', 'Body', choices(4))).toThrow()
  })

  it('shows all six topics in one list, and each submenu as three buttons with the way back in the footer', () => {
    const menu = menuMessage(ctx())
    if (menu.type !== 'interactive' || menu.interactive.type !== 'list') throw new Error('expected a list message')
    expect(choiceIds(menu)).toEqual(MENU_IDS)
    expect(menu.interactive.action.button).toBe(translations.en.wa_bot_menu_button)
    expect(menu.interactive.body.text).toBe(translations.en.wa_bot_menu_body)
    const order = submenuMessage('order', 'en')
    const pass = submenuMessage('pass', 'en')
    expect(choiceIds(order as never)).toEqual(['opt_vouchers', 'opt_venue', 'opt_refund'])
    expect(choiceIds(pass as never)).toEqual(['opt_pass', 'opt_perks', 'opt_account'])
    for (const message of [order, pass]) {
      if (message.type !== 'interactive' || message.interactive.type !== 'button') throw new Error('expected a button message')
      expect(message.interactive.footer).toEqual({ text: translations.en.wa_bot_submenu_footer })
    }
  })

  it('opens the language list from the menu, and takes 1-6 typed as the menu rows', () => {
    const now = Date.now()
    const busy = ctx({ lastMenuAt: now - 1000, lastNudgeAt: now - 500, now })
    expect(decide(event({ kind: 'button', action: 'menu_lang' }), busy)).toEqual({ kind: 'languagePicker' })
    expect(decide(text('1'), busy)).toEqual({ kind: 'submenu', menu: 'order' })
    expect(decide(text(' 2 '), ctx())).toEqual({ kind: 'topic', topic: 'new_order' })
    expect(decide(text('3.'), ctx())).toEqual({ kind: 'submenu', menu: 'pass' })
    expect(decide(text('4'), ctx())).toEqual({ kind: 'promptInquiry', category: 'general' })
    expect(decide(text('5'), ctx())).toEqual({ kind: 'topic', topic: 'login_help' })
    expect(decide(text('6'), ctx())).toEqual({ kind: 'languagePicker' })
    expect(decide(text('7'), ctx())).toEqual({ kind: 'menu' })
    expect(decide(text('1'), ctx({ status: 'resolved', now }))).toEqual({ kind: 'submenu', menu: 'order' })
    // A number is the member's own words while the bot waits for a request or the team has the chat.
    expect(decide(text('1'), ctx({ status: 'awaiting_user_inquiry', inquiryPromptedAt: now - 1000, now }))).toEqual({ kind: 'escalate' })
    expect(decide(text('1'), ctx({ status: 'escalated', escalatedAt: now - 1000, now }))).toEqual({ kind: 'silent' })
    expect(decide(text('1'), ctx({ needsLanguage: true }))).toEqual({ kind: 'languagePicker' })
  })

  it('answers the idle check-in: Yes goes back to the request or the menu, All set resolves', () => {
    const now = Date.now()
    const yes = event({ kind: 'button', action: 'btn_idle_yes' })
    expect(decide(yes, ctx({ idleCheckInAt: now - 1000, now }))).toEqual({ kind: 'menu' })
    expect(decide(yes, ctx({ idleCheckInAt: now - 1000, idleResume: 'inquiry', inquiryCategory: 'order_issue', now }))).toEqual({
      kind: 'promptInquiry',
      category: 'order_issue',
    })
    expect(decide(yes, ctx({ idleResume: 'inquiry', status: 'escalated', escalatedAt: now - 1000, now }))).toEqual({ kind: 'alreadyEscalated' })
    expect(decide(event({ kind: 'button', action: 'btn_idle_done' }), ctx({ idleCheckInAt: now - 1000, now }))).toEqual({ kind: 'resolve' })
    const checkIn = idleCheckInMessage('en')
    expect(transcriptText(checkIn)).toBe(`${translations.en.wa_bot_idle_checkin}\n[Yes, need help] [All set, thanks]`)
  })

  it('shows the menu for a menu keyword during the cooldown and while escalated', () => {
    const now = Date.now()
    for (const word of ['menu', 'MENU', ' Help ', 'תפריט', 'ראשי', 'עזרה', 'תפריט!', 'Меню', 'menú', 'aide', 'ayuda']) expect(isMenuKeyword(word), word).toBe(true)
    for (const word of ['main menu please', 'hi', 'שלום']) expect(isMenuKeyword(word), word).toBe(false)
    expect(decide(text('תפריט'), ctx({ lastMenuAt: now - 1000, lastNudgeAt: now - 500, now }))).toEqual({ kind: 'menu' })
    expect(decide(text('menu'), ctx({ status: 'escalated', escalatedAt: now - 1000, now }))).toEqual({ kind: 'menu' })
    expect(decide(text('help'), ctx({ status: 'awaiting_user_inquiry', inquiryPromptedAt: now - 1000, now }))).toEqual({ kind: 'menu' })
  })

  it('takes the next message as the inquiry for 30 minutes after the prompt', () => {
    const now = Date.now()
    const awaiting = (ago: number) => ctx({ status: 'awaiting_user_inquiry', inquiryPromptedAt: now - ago, lastMenuAt: now - 1000, now })
    expect(decide(text('My voucher failed'), awaiting(1000))).toEqual({ kind: 'escalate' })
    expect(decide(event({ kind: 'other' }), awaiting(1000))).toEqual({ kind: 'escalate' })
    expect(currentStatus(awaiting(INQUIRY_TIMEOUT_MS))).toBe('active')
    expect(decide(text('My voucher failed'), awaiting(INQUIRY_TIMEOUT_MS))).toEqual({ kind: 'nudge' })
  })

  it('stays silent on free text for 24 hours after an escalation, but still answers buttons', () => {
    const now = Date.now()
    const escalated = ctx({ status: 'escalated', escalatedAt: now - 1000, now })
    expect(decide(text('hello?'), escalated)).toEqual({ kind: 'silent' })
    expect(decide(event({ kind: 'button', action: 'btn_talk_to_team' }), escalated)).toEqual({ kind: 'alreadyEscalated' })
    expect(decide(event({ kind: 'button', action: 'btn_pass' }), escalated)).toEqual({ kind: 'topic', topic: 'pass' })
    expect(decide(event({ kind: 'button', action: 'menu_order' }), escalated)).toEqual({ kind: 'submenu', menu: 'order' })
    expect(decide(event({ kind: 'button', action: 'btn_escalate_order' }), escalated)).toEqual({ kind: 'alreadyEscalated' })
    expect(decide(text('hello?'), ctx({ status: 'escalated', escalatedAt: now - ESCALATION_SILENCE_MS - 1, now }))).toEqual({ kind: 'menu' })
    // A conversation from before statuses, escalated by escalatedAt alone.
    expect(currentStatus(ctx({ escalatedAt: now - 1000, now }))).toBe('escalated')
  })

  it('links Perks and New order to /categories, and Pass and My voucher to /member', () => {
    const url = (topic: Topic) => {
      const [card] = topicMessages(topic, ctx({ isMember: true }))
      return card.type === 'interactive' && card.interactive.type === 'cta_url' && card.interactive.action.parameters.url
    }
    expect(url('perks')).toBe('https://landly.test/categories')
    expect(url('new_order')).toBe('https://landly.test/categories')
    expect(url('pass')).toBe('https://landly.test/member')
    expect(url('vouchers')).toBe('https://landly.test/member')
  })

  it('follows a link with Resolved, Talk to Team and Main Menu', () => {
    const followUp = followUpMessage('he')
    if (followUp.type !== 'interactive' || followUp.interactive.type !== 'button') throw new Error('expected a button message')
    expect(followUp.interactive.action.buttons).toEqual([
      { type: 'reply', reply: { id: 'btn_ticket_resolved', title: 'הסתדרתי, תודה' } },
      { type: 'reply', reply: { id: 'btn_escalate_prompt', title: 'דברו עם הצוות' } },
      { type: 'reply', reply: { id: 'btn_back_to_menu', title: 'תפריט ראשי' } },
    ])
    const en = followUpMessage('en')
    if (en.type !== 'interactive' || en.interactive.type !== 'button') throw new Error('expected a button message')
    expect(en.interactive.action.buttons.map((b) => b.reply.title)).toEqual(['All set, thanks', 'Talk to Team', 'Main Menu'])
  })

  it('answers in the picked language, else the member language, else English', () => {
    expect(botLanguage('fr', 'ru')).toBe('fr')
    expect(botLanguage(undefined, 'ru')).toBe('ru')
    expect(botLanguage('xx', 'he')).toBe('he')
    expect(botLanguage(undefined, undefined)).toBe('en')
    expect(botLanguage('toString')).toBe('en')
  })

  it('answers anything from a number without a language with the picker, even a button from an older menu', () => {
    const now = Date.now()
    const fresh = ctx({ needsLanguage: true, now })
    expect(decide(text('hi'), fresh)).toEqual({ kind: 'languagePicker' })
    expect(decide(text('menu'), fresh)).toEqual({ kind: 'languagePicker' })
    expect(decide(event({ kind: 'other' }), fresh)).toEqual({ kind: 'languagePicker' })
    // The list obeys the menu's cooldown.
    expect(decide(text('hi'), ctx({ needsLanguage: true, lastMenuAt: now - 1000, now }))).toEqual({ kind: 'nudge' })
    for (const action of ['btn_perks', 'menu_agent', 'menu_login_help', 'btn_talk_to_team'] as BotAction[]) {
      expect(decide(event({ kind: 'button', action }), fresh), action).toEqual({ kind: 'languagePicker' })
    }
    expect(decide(event({ kind: 'language', lang: 'fr' }), fresh)).toEqual({ kind: 'languageChosen', lang: 'fr' })
    // Escalated before a language was picked: the team has the chat, the bot stays quiet.
    expect(decide(text('hi'), ctx({ needsLanguage: true, status: 'escalated', escalatedAt: now - 1000, now }))).toEqual({ kind: 'silent' })
  })

  it('takes a typed language name as the pick while the bot leads the chat', () => {
    const now = Date.now()
    expect(['English', ' עברית ', 'Русский', 'francais!', 'Español', 'hebrew', 'ספרדית'].map(typedLanguage)).toEqual(['en', 'he', 'ru', 'fr', 'es', 'he', 'es'])
    for (const word of ['english please', 'hi', 'עברית בבקשה']) expect(typedLanguage(word), word).toBeUndefined()
    expect(decide(text('עברית'), ctx({ needsLanguage: true, now }))).toEqual({ kind: 'languageChosen', lang: 'he' })
    expect(decide(text('Русский'), ctx({ now }))).toEqual({ kind: 'languageChosen', lang: 'ru' })
    expect(decide(text('english'), ctx({ status: 'resolved', now }))).toEqual({ kind: 'languageChosen', lang: 'en' })
    // A request to the team, or a chat the team has, is the member's own words.
    expect(decide(text('english'), ctx({ status: 'awaiting_user_inquiry', inquiryPromptedAt: now - 1000, now }))).toEqual({ kind: 'escalate' })
    expect(decide(text('english'), ctx({ status: 'escalated', escalatedAt: now - 1000, now }))).toEqual({ kind: 'silent' })
  })

  it('brings the language list back for a language keyword in any state', () => {
    const now = Date.now()
    for (const word of ['lang', 'Language', ' שפה ', 'язык', 'Langue!', 'idioma']) expect(isLanguageKeyword(word), word).toBe(true)
    for (const word of ['change language please', 'menu', 'langu']) expect(isLanguageKeyword(word), word).toBe(false)
    expect(decide(text('lang'), ctx({ lastMenuAt: now - 1000, lastNudgeAt: now - 500, now }))).toEqual({ kind: 'languagePicker' })
    expect(decide(text('שפה'), ctx({ status: 'escalated', escalatedAt: now - 1000, now }))).toEqual({ kind: 'languagePicker' })
    expect(decide(text('language'), ctx({ status: 'awaiting_user_inquiry', inquiryPromptedAt: now - 1000, now }))).toEqual({ kind: 'languagePicker' })
    expect(decide(event({ kind: 'language', lang: 'he' }), ctx({ status: 'awaiting_user_inquiry', inquiryPromptedAt: now - 1000, now }))).toEqual({
      kind: 'languageChosen',
      lang: 'he',
    })
  })

  it('offers the five languages in one list under the English welcome, with no footer', () => {
    const picker = languagePickerMessage('welcome')
    if (picker.type !== 'interactive' || picker.interactive.type !== 'list') throw new Error('expected a list message')
    expect(WELCOME_BODY).toBe('Hi! 👋 Welcome to Landly.\nPlease choose your language to continue:')
    expect(picker.interactive.body.text).toBe(WELCOME_BODY)
    expect(picker.interactive.action.button).toBe('Choose language')
    expect(picker.interactive).not.toHaveProperty('footer')
    expect(picker.interactive.action.sections[0].rows.map((r) => r.title)).toEqual(LANGUAGE_NAMES_IN_ORDER)
    expect(choiceIds(picker)).toEqual(LANGUAGE_IDS)
  })

  it('words a reopened language list in the chat\'s language', () => {
    const he = languagePickerMessage('he')
    if (he.type !== 'interactive' || he.interactive.type !== 'list') throw new Error('expected a list message')
    expect(he.interactive.body.text).toBe('בחירת שפה:')
    expect(he.interactive.action.button).toBe('בחר שפה')
    expect(choiceIds(he)).toEqual(LANGUAGE_IDS)
    // A language keeps its own name whatever the list's language.
    expect(transcriptText(he)).toBe(`בחירת שפה:\n${LANGUAGE_NAMES_IN_ORDER.map((name) => `[${name}]`).join(' ')}`)
  })

  it('puts the language confirmation at the top of the menu it comes with', () => {
    const menu = menuMessage(ctx({ lang: 'fr', memberFirstName: 'Dana' }), { languageChanged: true })
    if (menu.type !== 'interactive' || menu.interactive.type !== 'list') throw new Error('expected a list message')
    expect(menu.interactive.body.text).toBe(`${translations.fr.wa_bot_lang_changed}\n\n${translations.fr.wa_bot_menu_body_named.replace('{name}', 'Dana')}`)
  })

  it('writes every kind of reply as plain text for the inbox', () => {
    expect(transcriptText({ type: 'text', text: { body: 'Hello' } })).toBe('Hello')
    expect(transcriptText(followUpMessage('en'))).toBe(`${translations.en.wa_bot_followup_body}\n[All set, thanks] [Talk to Team] [Main Menu]`)
    expect(transcriptText(topicMessages('perks', ctx())[0])).toBe(`${translations.en.wa_bot_perks_body}\n[${translations.en.wa_bot_perks_cta}] https://landly.test/categories`)
    // A list: its (two-line) body, then its rows.
    expect(transcriptText(languagePickerMessage('welcome'))).toBe(`${WELCOME_BODY}\n[English] [עברית] [Русский] [Français] [Español]`)
  })

  it('sends every reply as one message: buttons for up to three choices, one list for more', () => {
    for (const lang of Object.keys(translations) as Lang[]) {
      const all = [
        languagePickerMessage('welcome'),
        languagePickerMessage(lang),
        menuMessage(ctx({ lang, memberFirstName: 'Dana' })),
        submenuMessage('order', lang),
        submenuMessage('pass', lang),
        ...TOPICS.flatMap((topic) => topicMessages(topic, ctx({ lang }))),
        followUpMessage(lang),
        inquiryPromptMessage(lang),
        escalatedMessage(lang),
        alreadyEscalatedMessage(lang),
        resolvedMessage(lang),
        idleCheckInMessage(lang),
        teamNudgeMessage(lang),
        teamResolvedMessage(lang),
      ]
      for (const message of all) {
        if (message.type !== 'interactive') continue
        const count = choiceIds(message).length
        expect(message.interactive.type === 'cta_url' || count > 0).toBe(true)
        if (message.interactive.type === 'cta_url') continue
        expect(message.interactive.type, transcriptText(message)).toBe(count > BUTTONS_MAX ? 'list' : 'button')
      }
      // The menu and the language list are lists; everything else fits in buttons.
      expect(all.filter((m) => m.type === 'interactive' && m.interactive.type === 'list')).toHaveLength(3)
    }
  })

  it.each(Object.keys(translations) as Lang[])('keeps the %s copy free of emoji and nested quotes', (lang) => {
    const strings = translations[lang] as Record<string, string>
    for (const [key, value] of Object.entries(strings)) {
      // The one exception: the Login & Account row's lock, as asked for.
      const copy = key === 'wa_bot_row_login_help' ? value.replace(/^🔐 /u, '') : value
      if (key.startsWith('wa_bot_')) expect(copy, key).not.toMatch(/[\p{Extended_Pictographic}“”«»״"]/u)
    }
  })

  it.each(Object.keys(translations) as Lang[])('keeps every %s list within Meta limits, with unique row ids and titles', (lang) => {
    const lists = [
      languagePickerMessage('welcome'),
      languagePickerMessage(lang),
      menuMessage(ctx({ lang })),
      menuMessage(ctx({ lang, memberFirstName: 'Dana' })),
      menuMessage(ctx({ lang, memberFirstName: 'Dana' }), { languageChanged: true }),
    ]
    for (const message of lists) {
      if (message.type !== 'interactive' || message.interactive.type !== 'list') throw new Error('expected a list message')
      const { body, action } = message.interactive
      expect(body.text.length).toBeLessThanOrEqual(BODY_MAX)
      expect(action.button.length, action.button).toBeLessThanOrEqual(LIST_BUTTON_MAX)
      const rows = action.sections.flatMap((section) => section.rows)
      expect(rows.length).toBeLessThanOrEqual(LIST_ROWS_MAX)
      expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length)
      expect(new Set(rows.map((r) => r.title)).size).toBe(rows.length)
      for (const row of rows) {
        expect(row.title.length, row.title).toBeLessThanOrEqual(ROW_TITLE_MAX)
        expect(row.description?.length ?? 0, row.description).toBeLessThanOrEqual(ROW_DESCRIPTION_MAX)
      }
    }
  })

  it.each(Object.keys(translations) as Lang[])('keeps every %s button and link label within Meta limits', (lang) => {
    const buttonMessages = [
      submenuMessage('order', lang),
      submenuMessage('pass', lang),
      idleCheckInMessage(lang),
      followUpMessage(lang),
      followUpMessage(lang, 'order_issue', 'wa_bot_refund_body'),
      followUpMessage(lang, 'login_help'),
      inquiryPromptMessage(lang),
      escalatedMessage(lang),
      alreadyEscalatedMessage(lang),
      resolvedMessage(lang),
      teamNudgeMessage(lang),
      teamResolvedMessage(lang),
    ]
    for (const message of buttonMessages) {
      if (message.type !== 'interactive' || message.interactive.type !== 'button') throw new Error('expected a button message')
      expect(message.interactive.footer?.text.length ?? 0).toBeLessThanOrEqual(FOOTER_MAX)
      expect(message.interactive.action.buttons.length).toBeLessThanOrEqual(BUTTONS_MAX)
      expect(message.interactive.body.text.length).toBeLessThanOrEqual(BODY_MAX)
      const titles = message.interactive.action.buttons.map((button) => button.reply.title)
      // Meta refuses a message whose buttons repeat a title.
      expect(new Set(titles).size).toBe(titles.length)
      for (const title of titles) expect(title.length, title).toBeLessThanOrEqual(BUTTON_TITLE_MAX)
    }
    for (const topic of TOPICS) {
      for (const message of topicMessages(topic, ctx({ lang }))) {
        if (message.type !== 'interactive') throw new Error('expected an interactive message')
        expect(message.interactive.body.text.length).toBeLessThanOrEqual(1024)
        if (message.interactive.type === 'cta_url') {
          expect(message.interactive.action.parameters.display_text.length).toBeLessThanOrEqual(BUTTON_TITLE_MAX)
        } else if (message.interactive.type === 'button') {
          for (const button of message.interactive.action.buttons) expect(button.reply.title.length, button.reply.title).toBeLessThanOrEqual(BUTTON_TITLE_MAX)
        }
      }
    }
  })

  it('keeps the support hours left-to-right inside the Hebrew confirmation', () => {
    const confirm = escalatedMessage('he')
    if (confirm.type !== 'interactive') throw new Error('expected an interactive message')
    expect(confirm.interactive.body.text).toContain('\u206609:00–18:00\u2069')
  })

  it('keeps amounts, percentages and dates whole and left-to-right in Hebrew, and joined to their units everywhere', () => {
    const refund = bidiSafe('he', translations.he.wa_bot_refund_body)
    expect(refund).toContain('\u2066₪100\u2069')
    expect(refund).toContain('\u20665%\u2069')
    expect(refund).toContain('14\u00A0יום')
    expect(bidiSafe('he', 'עד 25.10.2026 בשעה 18:30')).toBe('עד \u206625.10.2026\u2069\u00A0בשעה \u206618:30\u2069')
    expect(bidiSafe('he', 'מחיר ₪ 100, הנחה 5 %')).toBe('מחיר \u2066₪\u00A0100\u2069, הנחה \u20665\u00A0%\u2069')
    // Left-to-right languages get the joined units, no isolates.
    expect(bidiSafe('en', translations.en.wa_bot_refund_body)).toContain('within 14\u00A0days')
    const fr = bidiSafe('fr', translations.fr.wa_bot_refund_body)
    expect(fr).toContain('5\u00A0%')
    expect(fr).toContain('100\u00A0₪')
    expect(fr).not.toContain('\u2066')
    // Every Hebrew answer goes out this way.
    const [answer] = topicMessages('refund', ctx({ lang: 'he' }))
    if (answer.type !== 'interactive') throw new Error('expected an interactive message')
    expect(answer.interactive.body.text).toBe(refund)
  })
})

describe('support bot handler', () => {
  const seedMember = () =>
    mocks.store.seed('users/member-1', { phone: `+${WA_ID}`, firstName: 'Dana', displayName: 'Dana Levi', email: 'dana@landly.test', preferredLanguage: 'fr' })
  const conversation = () => mocks.store.read(`whatsappConversations/${WA_ID}`)
  const transcript = () => Object.values(mocks.store.list(`whatsappConversations/${WA_ID}/messages`)).sort((a, b) => a.at.toMillis() - b.at.toMillis())
  /** A number that already picked Hebrew in the chat. */
  /** A number that already picked `lang` in the chat. */
  const picked = (lang: Lang) => ({ lang, langSelectedAt: Timestamp.fromMillis(Date.now() - 60 * 60 * 1000) })
  const hebrew = () => picked('he')
  const pick = (lang: Lang) => mocks.store.seed(`whatsappConversations/${WA_ID}`, picked(lang))
  const pickHebrew = () => pick('he')
  /** The choice ids of the last `n` replies. */
  const lastIds = (n = 1) => allChoiceIds(replies().slice(-n))

  it('asks a member with a profile language but no pick in the chat for their language, and records the conversation', async () => {
    seedMember()
    await handleInboundEvent(event({ kind: 'text', text: 'Bonjour', name: 'Dana WA' }))
    expect(replies()).toHaveLength(1)
    expect(replies()[0].interactive).toMatchObject({ type: 'list', body: { text: WELCOME_BODY } })
    expect(lastIds()).toEqual(LANGUAGE_IDS)
    expect(conversation()).toMatchObject({ uid: 'member-1', memberName: 'Dana Levi', profileName: 'Dana WA', lastText: 'Bonjour', status: 'active' })
    expect(conversation()).not.toHaveProperty('langSelectedAt')

    await handleInboundEvent(event({ kind: 'language', lang: 'fr' }))
    expect(replies()).toHaveLength(2)
    expect(replies()[1].interactive.body.text).toBe(`${translations.fr.wa_bot_lang_changed}\n\n${translations.fr.wa_bot_menu_body_named.replace('{name}', 'Dana')}`)
    expect(lastIds()).toEqual(MENU_IDS)
  })

  it('answers a button from an older menu with the language list while the chat has no language', async () => {
    await handleInboundEvent(event({ kind: 'button', action: 'btn_perks' }))
    expect(replies()).toHaveLength(1)
    expect(lastIds()).toEqual(LANGUAGE_IDS)
    expect(conversation()?.langSelectedAt).toBeUndefined()
  })

  it('takes a typed language name as the pick and answers with the menu in it', async () => {
    seedMember()
    await handleInboundEvent(event({ kind: 'text', text: 'עברית' }))
    expect(replies()).toHaveLength(1)
    expect(replies()[0].interactive.body.text.startsWith(translations.he.wa_bot_lang_changed)).toBe(true)
    expect(lastIds()).toEqual(MENU_IDS)
    expect(conversation()).toMatchObject({ lang: 'he' })
    expect(conversation()?.langSelectedAt).toBeInstanceOf(Timestamp)
    expect(mocks.store.read('users/member-1')).toMatchObject({ preferredLanguage: 'he' })
  })

  it('greets a new number in English with the language list, then continues in the picked language', async () => {
    const now = Date.now()
    await handleInboundEvent(event({ kind: 'text', text: 'שלום' }), now)
    expect(lastIds()).toEqual(LANGUAGE_IDS)
    expect(conversation()).toMatchObject({ lang: 'en', status: 'active' })
    expect(conversation()?.lastMenuAt).toBeInstanceOf(Timestamp)

    await handleInboundEvent(event({ kind: 'language', lang: 'ru' }), now + 5000)
    const after = replies().slice(1)
    expect(after).toHaveLength(1)
    expect(after[0].interactive.body.text).toBe(`${translations.ru.wa_bot_lang_changed}\n\n${translations.ru.wa_bot_menu_body}`)
    expect(lastIds()).toEqual(MENU_IDS)
    expect(conversation()).toMatchObject({ lang: 'ru' })
    expect(conversation()?.langSelectedAt).toBeInstanceOf(Timestamp)

    // Everything after stays in Russian: the nudge, the links, the escalation.
    await handleInboundEvent(event({ kind: 'text', text: 'hi' }), now + 10_000)
    expect(replies().at(-1).text.body).toBe(translations.ru.wa_bot_nudge)
    await handleInboundEvent(event({ kind: 'button', action: 'btn_perks' }), now + 20_000)
    expect(replies().at(-1).interactive.body.text).toBe(translations.ru.wa_bot_followup_body)
    await handleInboundEvent(event({ kind: 'button', action: 'btn_talk_to_team' }), now + 30_000)
    expect(replies().at(-1).interactive.body.text).toBe(translations.ru.wa_bot_inquiry_prompt)
  })

  it('saves a member\'s pick to their profile, and the pick outranks the profile afterwards', async () => {
    seedMember()
    const now = Date.now()
    await handleInboundEvent(event({ kind: 'text', text: 'שפה' }), now)
    expect(lastIds()).toEqual(LANGUAGE_IDS)
    await handleInboundEvent(event({ kind: 'language', lang: 'he' }), now + 1000)
    expect(mocks.store.read('users/member-1')).toMatchObject({ preferredLanguage: 'he', firstName: 'Dana' })
    expect(replies().at(-1).interactive.body.text).toBe(`${translations.he.wa_bot_lang_changed}\n\n${translations.he.wa_bot_menu_body_named.replace('{name}', 'Dana')}`)
    // Even if the profile changes back on the site, the chat keeps the pick.
    mocks.store.seed('users/member-1', { phone: `+${WA_ID}`, firstName: 'Dana', preferredLanguage: 'fr' })
    await handleInboundEvent(event({ kind: 'text', text: 'menu' }), now + 2000)
    expect(replies().at(-1).interactive.body.text).toBe(translations.he.wa_bot_menu_body_named.replace('{name}', 'Dana'))
  })

  it('shows the language list during an inquiry prompt without emailing it as the request', async () => {
    pickHebrew()
    const now = Date.now()
    await handleInboundEvent(event({ kind: 'button', action: 'btn_talk_to_team' }), now)
    await handleInboundEvent(event({ kind: 'text', text: 'language' }), now + 1000)
    expect(mocks.send).not.toHaveBeenCalled()
    expect(lastIds()).toEqual(LANGUAGE_IDS)
  })

  it('opens the language list, worded in the chat\'s language, from the menu\'s Language row', async () => {
    pickHebrew()
    await handleInboundEvent(event({ kind: 'button', action: 'menu_lang' }))
    expect(replies()).toHaveLength(1)
    expect(replies()[0].interactive).toMatchObject({ type: 'list', body: { text: 'בחירת שפה:' }, action: { button: 'בחר שפה' } })
    expect(lastIds()).toEqual(LANGUAGE_IDS)
    expect(transcript().find((m) => m.kind === 'button')?.text).toBe(translations.he.wa_bot_btn_language)
  })

  it('answers 2 typed instead of a tap with the New order answer', async () => {
    pickHebrew()
    await handleInboundEvent(event({ kind: 'text', text: '2' }))
    expect(replies()[0].interactive).toMatchObject({ type: 'cta_url', action: { parameters: { url: 'https://landly.test/categories' } } })
  })

  it('answers Login & Account help (or 5 typed), tags it login_help, and escalates it with that topic', async () => {
    pickHebrew()
    const now = Date.now()
    await handleInboundEvent(event({ kind: 'text', text: '5' }), now)
    const [card, followUp] = replies()
    expect(card.interactive).toMatchObject({ type: 'cta_url', action: { parameters: { url: 'https://landly.test/forgot-password' } } })
    expect(choiceIds(followUp)).toEqual(['btn_ticket_resolved', 'btn_escalate_login', 'btn_back_to_menu'])
    expect(conversation()).toMatchObject({ inquiryCategory: 'login_help', status: 'active' })

    await handleInboundEvent(event({ kind: 'button', action: 'btn_escalate_login' }), now + 1000)
    expect(conversation()).toMatchObject({ status: 'awaiting_user_inquiry', inquiryCategory: 'login_help' })
    await handleInboundEvent(event({ kind: 'text', text: 'The code never arrives' }), now + 2000)
    expect(mocks.send).toHaveBeenCalledTimes(1)
    expect(mocks.send.mock.calls[0][0].text).toContain('Topic: Login & account')
    expect(conversation()).toMatchObject({ status: 'escalated', inquiryCategory: 'login_help' })
  })

  it('keeps the transcript: the message and each reply, in order, expiring after 180 days', async () => {
    pickHebrew()
    const now = Date.now()
    await handleInboundEvent(event({ messageId: 'wamid.in1', kind: 'text', text: 'היי', at: now - 2000 }), now)
    await handleInboundEvent(event({ messageId: 'wamid.in2', kind: 'button', action: 'btn_perks', at: now + 1000 }), now + 1000)
    await handleInboundEvent(event({ messageId: 'wamid.in3', kind: 'other', media: 'image', at: now + 2000 } as InboundEvent), now + GREETING_COOLDOWN_MS + 5000)
    const entries = transcript()
    expect(entries.map((m) => [m.direction, m.author, m.kind])).toEqual([
      ['in', 'member', 'text'],
      ['out', 'bot', 'interactive'],
      ['in', 'member', 'button'],
      ['out', 'bot', 'interactive'],
      ['out', 'bot', 'interactive'],
      ['in', 'member', 'media'],
      ['out', 'bot', 'interactive'],
    ])
    expect(entries[0]).toMatchObject({ text: 'היי' })
    // The menu list: its body, then every row.
    expect(entries[1].text).toContain(translations.he.wa_bot_menu_body)
    expect(entries[1].text).toContain(`[${translations.he.wa_bot_row_login_help}]`)
    expect(entries[1]).toMatchObject({ simulated: true })
    expect(entries[2].text).toBe(translations.he.wa_bot_btn_perks)
    expect(entries[3].text).toContain('https://landly.test/categories')
    expect(entries[5].text).toBe('(image)')
    for (const entry of entries) expect(entry.expiresAt.toMillis() - entry.at.toMillis()).toBe(MESSAGE_TTL_MS)
    expect(mocks.store.list(`whatsappConversations/${WA_ID}/messages`)['wamid.in1']).toBeDefined()
    expect(conversation()?.lastSnippet).toMatchObject({ text: '(image)', direction: 'in' })
    expect(conversation()?.lastOutboundAt).toBeInstanceOf(Timestamp)
    // The conversation goes 180 days after its latest message, not after it began.
    expect(conversation()?.expiresAt.toMillis()).toBe(entries.at(-1)!.at.toMillis() + MESSAGE_TTL_MS)
  })

  it('stores the id Meta gives each sent reply', async () => {
    vi.stubEnv('WHATSAPP_OTP_LIVE', 'true')
    vi.stubEnv('WHATSAPP_ACCESS_TOKEN', 'token')
    let sent = 0
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify({ messages: [{ id: `wamid.out${++sent}` }] }), { status: 200 })))
    pickHebrew()
    await handleInboundEvent(event({ messageId: 'wamid.in1', kind: 'text', text: 'היי', phoneNumberId: PHONE_ID }))
    expect(Object.keys(mocks.store.list(`whatsappConversations/${WA_ID}/messages`)).sort()).toEqual(['wamid.in1', 'wamid.out1'])
    expect(conversation()).toMatchObject({ phoneNumberId: PHONE_ID })
  })

  it('escalates in two steps: prompts with Cancel, emails the inquiry, confirms with the hours, then stays silent', async () => {
    seedMember()
    pick('fr')
    const now = Date.now()
    await handleInboundEvent(event({ kind: 'button', action: 'btn_talk_to_team' }), now)
    expect(mocks.send).not.toHaveBeenCalled()
    const prompt = replies().at(-1)
    expect(prompt.interactive.body.text).toBe(translations.fr.wa_bot_inquiry_prompt)
    expect(choiceIds(prompt)).toEqual(['btn_cancel_inquiry'])
    expect(conversation()).toMatchObject({ status: 'awaiting_user_inquiry' })
    expect(conversation()?.inquiryPromptedAt).toBeInstanceOf(Timestamp)

    await handleInboundEvent(event({ kind: 'text', text: 'My voucher does not work' }), now + 5000)
    expect(mocks.send).toHaveBeenCalledTimes(1)
    const mail = mocks.send.mock.calls[0][0]
    expect(mail.to).toBe('contact@golandly.com')
    expect(mail.replyTo).toBe('dana@landly.test')
    expect(mail.html).toContain(`https://wa.me/${WA_ID}`)
    expect(mail.html).toContain(`https://landly.test/admin/support?c=${WA_ID}`)
    expect(mail.text).toContain('member-1')
    expect(mail.text).toContain('Dana Levi')
    expect(mail.text).toContain('Language: fr')
    expect(mail.text).toContain('My voucher does not work')
    const confirm = replies().at(-1)
    expect(confirm.interactive.body.text).toBe(bidiSafe('fr', translations.fr.wa_bot_team_confirm))
    expect(choiceIds(confirm)).toEqual(['btn_back_to_menu'])
    expect(conversation()).toMatchObject({ status: 'escalated' })
    expect(conversation()?.escalatedAt).toBeInstanceOf(Timestamp)
    expect(conversation()?.inquiryPromptedAt).toBeUndefined()

    const before = replies().length
    await handleInboundEvent(event({ kind: 'text', text: 'hello?' }), now + GREETING_COOLDOWN_MS + 10_000)
    expect(replies()).toHaveLength(before)
    await handleInboundEvent(event({ kind: 'button', action: 'btn_escalate_prompt' }), now + 20_000)
    expect(mocks.send).toHaveBeenCalledTimes(1)
    expect(replies().at(-1).interactive.body.text).toBe(translations.fr.wa_bot_team_already)
  })

  it('cancels the inquiry prompt back to the menu without emailing anyone', async () => {
    pickHebrew()
    const now = Date.now()
    await handleInboundEvent(event({ kind: 'button', action: 'btn_talk_to_team' }), now)
    await handleInboundEvent(event({ kind: 'button', action: 'btn_cancel_inquiry' }), now + 1000)
    expect(lastIds()).toEqual(MENU_IDS)
    expect(conversation()).toMatchObject({ status: 'active' })
    expect(conversation()?.inquiryPromptedAt).toBeUndefined()
    // The next message is an ordinary one, not an inquiry.
    await handleInboundEvent(event({ kind: 'text', text: 'never mind' }), now + 2000)
    expect(mocks.send).not.toHaveBeenCalled()
    expect(replies().at(-1).text.body).toBe(translations.he.wa_bot_nudge)
  })

  it('keeps an escalation when the member asks for the menu', async () => {
    const now = Date.now()
    mocks.store.seed(`whatsappConversations/${WA_ID}`, { ...hebrew(), status: 'escalated', escalatedAt: Timestamp.fromMillis(now - 1000) })
    await handleInboundEvent(event({ kind: 'text', text: 'תפריט' }), now)
    expect(lastIds()).toEqual(MENU_IDS)
    expect(conversation()).toMatchObject({ status: 'escalated' })
    await handleInboundEvent(event({ kind: 'text', text: 'still there?' }), now + GREETING_COOLDOWN_MS + 1)
    expect(replies()).toHaveLength(1)
  })

  it('sends a link card followed by the Resolved / Talk to Team / Main Menu prompt', async () => {
    pickHebrew()
    await handleInboundEvent(event({ kind: 'button', action: 'btn_perks' }))
    const [card, followUp] = replies()
    expect(card.interactive).toMatchObject({ type: 'cta_url', action: { parameters: { url: 'https://landly.test/categories' } } })
    expect(followUp.interactive.body.text).toBe(translations.he.wa_bot_followup_body)
    expect(choiceIds(followUp)).toEqual(['btn_ticket_resolved', 'btn_escalate_prompt', 'btn_back_to_menu'])
  })

  it('marks the conversation resolved, clears the escalation and timers, and signs off', async () => {
    const now = Date.now()
    mocks.store.seed(`whatsappConversations/${WA_ID}`, {
      ...hebrew(),
      status: 'escalated',
      escalatedAt: Timestamp.fromMillis(now - 1000),
      lastMenuAt: Timestamp.fromMillis(now - 1000),
      lastNudgeAt: Timestamp.fromMillis(now - 500),
    })
    await handleInboundEvent(event({ kind: 'button', action: 'btn_ticket_resolved' }), now)
    const signOff = replies().at(-1)
    expect(signOff.interactive.body.text).toBe(translations.he.wa_bot_resolved)
    expect(signOff.interactive.action.buttons).toEqual([{ type: 'reply', reply: { id: 'btn_back_to_menu', title: 'תפריט ראשי' } }])
    const stored = conversation()!
    expect(stored.status).toBe('resolved')
    expect(stored.resolvedAt).toBeInstanceOf(Timestamp)
    expect(stored).not.toHaveProperty('escalatedAt')
    expect(stored).not.toHaveProperty('lastMenuAt')
    expect(stored).not.toHaveProperty('lastNudgeAt')
    // A greeting right after gets a fresh menu, not a nudge or silence.
    await handleInboundEvent(event({ kind: 'text', text: 'היי' }), now + 1000)
    expect(lastIds()).toEqual(MENU_IDS)
    expect(conversation()?.status).toBe('active')
  })

  it('throttles free-text greetings for 90 seconds with a single nudge, but never buttons or keywords', async () => {
    pickHebrew()
    const now = Date.now()
    await handleInboundEvent(event({ kind: 'text', text: 'היי' }), now)
    await handleInboundEvent(event({ kind: 'text', text: 'שלום' }), now + 10_000)
    await handleInboundEvent(event({ kind: 'text', text: 'hi' }), now + 20_000)
    expect(replies()).toHaveLength(2)
    expect(replies()[1]).toEqual({ type: 'text', text: { body: translations.he.wa_bot_nudge } })

    await handleInboundEvent(event({ kind: 'button', action: 'btn_back_to_menu' }), now + 30_000)
    await handleInboundEvent(event({ kind: 'text', text: 'menu' }), now + 31_000)
    expect(allChoiceIds(replies().slice(2))).toEqual([...MENU_IDS, ...MENU_IDS])

    await handleInboundEvent(event({ kind: 'text', text: 'היי' }), now + 31_000 + GREETING_COOLDOWN_MS)
    expect(lastIds()).toEqual(MENU_IDS)
  })

  it('opens the order submenu, answers an issue at the business, and escalates it tagged as an order', async () => {
    seedMember()
    pick('fr')
    const now = Date.now()
    await handleInboundEvent(event({ kind: 'button', action: 'menu_order' }), now)
    expect(lastIds()).toEqual(['opt_vouchers', 'opt_venue', 'opt_refund'])
    expect(replies().at(-1).interactive.body.text).toBe(bidiSafe('fr', translations.fr.wa_bot_order_body))
    expect(replies().at(-1).interactive.footer).toEqual({ text: translations.fr.wa_bot_submenu_footer })

    await handleInboundEvent(event({ kind: 'button', action: 'opt_venue' }), now + 1000)
    const answer = replies().at(-1)
    expect(answer.interactive.body.text).toBe(translations.fr.wa_bot_venue_body)
    expect(choiceIds(answer)).toEqual(['btn_ticket_resolved', 'btn_escalate_order', 'btn_back_to_menu'])

    await handleInboundEvent(event({ kind: 'button', action: 'btn_escalate_order' }), now + 2000)
    expect(conversation()).toMatchObject({ status: 'awaiting_user_inquiry', inquiryCategory: 'order_issue' })
    await handleInboundEvent(event({ kind: 'text', text: 'The café refused my QR' }), now + 3000)
    expect(mocks.send).toHaveBeenCalledTimes(1)
    expect(mocks.send.mock.calls[0][0].text).toContain('Topic: Existing order')
    expect(conversation()).toMatchObject({ status: 'escalated', inquiryCategory: 'order_issue' })
    // The member's taps show in the transcript with the titles they saw.
    expect(transcript().filter((m) => m.kind === 'button').map((m) => m.text)).toEqual([
      translations.fr.wa_bot_row_order,
      translations.fr.wa_bot_row_venue,
      translations.fr.wa_bot_btn_escalate,
    ])
  })

  it('tags a new-order question as purchase help and Talk to an agent as general', async () => {
    pickHebrew()
    const now = Date.now()
    await handleInboundEvent(event({ kind: 'button', action: 'menu_new_order' }), now)
    const [card, followUp] = replies()
    expect(card.interactive).toMatchObject({ type: 'cta_url', action: { parameters: { url: 'https://landly.test/categories' } } })
    expect(choiceIds(followUp)).toEqual(['btn_ticket_resolved', 'btn_escalate_purchase', 'btn_back_to_menu'])
    await handleInboundEvent(event({ kind: 'button', action: 'btn_escalate_purchase' }), now + 1000)
    expect(conversation()).toMatchObject({ inquiryCategory: 'purchase_help' })
    await handleInboundEvent(event({ kind: 'button', action: 'btn_cancel_inquiry' }), now + 2000)
    await handleInboundEvent(event({ kind: 'button', action: 'menu_agent' }), now + 3000)
    expect(replies().at(-1).interactive.body.text).toBe(translations.he.wa_bot_inquiry_prompt)
    expect(conversation()).toMatchObject({ status: 'awaiting_user_inquiry', inquiryCategory: 'general' })
  })

  it('tells the sender when the team could not be emailed, and does not go silent', async () => {
    mocks.send.mockResolvedValue({ error: { name: 'validation_error', statusCode: 422, message: 'nope' } })
    pickHebrew()
    const now = Date.now()
    await handleInboundEvent(event({ kind: 'button', action: 'btn_talk_to_team', name: 'Guest' }), now)
    await handleInboundEvent(event({ kind: 'text', text: 'Help me with my order', name: 'Guest' }), now + 1000)
    expect(replies().at(-1).text.body).toBe(translations.he.wa_bot_team_failed.replace('{email}', '⁦contact@golandly.com⁩'))
    expect(conversation()?.escalatedAt).toBeUndefined()
    expect(conversation()?.status).toBe('active')
  })

  it('emails a media answer to the prompt with a note to open the chat', async () => {
    pickHebrew()
    const now = Date.now()
    await handleInboundEvent(event({ kind: 'button', action: 'btn_talk_to_team' }), now)
    await handleInboundEvent(event({ kind: 'other' }), now + 1000)
    expect(mocks.send.mock.calls[0][0].text).toContain('open the chat to see it')
    expect(conversation()?.status).toBe('escalated')
  })

  it('ignores a delivery older than the 24-hour reply window', async () => {
    await handleInboundEvent(event({ kind: 'text', at: Date.now() - 25 * 60 * 60 * 1000 }))
    expect(replies()).toHaveLength(0)
  })

  it('sends through the Graph API when live', async () => {
    vi.stubEnv('WHATSAPP_OTP_LIVE', 'true')
    vi.stubEnv('WHATSAPP_ACCESS_TOKEN', 'token')
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    pickHebrew()
    await handleInboundEvent(event({ kind: 'button', action: 'btn_perks' }))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ type: 'interactive', interactive: { type: 'button' } })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`)
    expect(JSON.parse(init.body)).toMatchObject({ messaging_product: 'whatsapp', to: WA_ID, type: 'interactive', interactive: { type: 'cta_url' } })
    expect(lines(info)).toContain(`[whatsapp-bot] sent interactive reply to +97 •••• 4567 from WHATSAPP_PHONE_NUMBER_ID`)
  })

  it('answers from the number the member wrote to, even without WHATSAPP_PHONE_NUMBER_ID', async () => {
    vi.stubEnv('WHATSAPP_OTP_LIVE', 'true')
    vi.stubEnv('WHATSAPP_ACCESS_TOKEN', 'token')
    vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', '')
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    pickHebrew()
    await handleInboundEvent(event({ kind: 'text', text: 'היי', phoneNumberId: '1367683866451764' }))
    expect(fetchMock.mock.calls[0][0]).toBe('https://graph.facebook.com/v21.0/1367683866451764/messages')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ to: WA_ID, type: 'interactive', interactive: { type: 'list' } })
  })

  it('uses a configured Graph version only when it is well formed', () => {
    vi.stubEnv('WHATSAPP_GRAPH_VERSION', 'v25.0')
    expect(graphVersion()).toBe('v25.0')
    for (const bad of ['25.0', 'v25', 'v25.0/../x', ' ']) {
      vi.stubEnv('WHATSAPP_GRAPH_VERSION', bad)
      expect(graphVersion()).toBe('v21.0')
    }
  })
})

describe('Firestore project for the bot', () => {
  // The bot writes through getAdminDb(), whose credentials envGuard checks against where the build runs.
  const admin = (projectId: string) => ({
    projectId,
    clientEmail: `firebase-adminsdk@${projectId}.iam.gserviceaccount.com`,
    privateKey: 'key',
    clientProjectId: projectId,
  })

  it('writes to landly-dev locally and on Vercel Preview, never production', () => {
    const local = firebaseDeployTarget({ vercel: undefined, vercelEnv: undefined, nodeEnv: 'development' })
    const preview = firebaseDeployTarget({ vercel: '1', vercelEnv: 'preview', nodeEnv: 'production' })
    expect([local, preview]).toEqual(['local', 'preview'])
    for (const target of [local, preview]) {
      expect(() => assertAdminCredentials({ ...admin(STAGING_FIREBASE_PROJECT_ID), target })).not.toThrow()
      expect(() => assertAdminCredentials({ ...admin(PRODUCTION_FIREBASE_PROJECT_ID), target })).toThrow()
    }
  })

  it('writes to landly-be752 on Vercel Production with no code change', () => {
    const target = firebaseDeployTarget({ vercel: '1', vercelEnv: 'production', nodeEnv: 'production' })
    expect(target).toBe('production')
    expect(() => assertAdminCredentials({ ...admin(PRODUCTION_FIREBASE_PROJECT_ID), target })).not.toThrow()
    expect(() => assertAdminCredentials({ ...admin(STAGING_FIREBASE_PROJECT_ID), target })).toThrow()
  })

  it('refuses a landly-dev project ID paired with a production service account', () => {
    expect(() =>
      assertAdminCredentials({ ...admin(STAGING_FIREBASE_PROJECT_ID), clientEmail: `x@${PRODUCTION_FIREBASE_PROJECT_ID}.iam.gserviceaccount.com`, target: 'local' })
    ).toThrow(/isn't a landly-dev service account/)
  })
})

describe('escalation email', () => {
  it('names an unknown sender by number and lets Reply reach the team inbox', () => {
    const mail = escalationEmail({ waId: '12025550123', lang: 'en', origin: 'https://landly.test' })
    expect(mail.replyTo).toBe('contact@golandly.com')
    expect(mail.rows.find((r) => r.label === 'WhatsApp')).toEqual({ label: 'WhatsApp', value: '+12025550123', href: 'https://wa.me/12025550123' })
    expect(mail.rows.find((r) => r.label === 'Member UID')?.value).toMatch(/No Landly account/)
    expect(mail.rows.find((r) => r.label === 'Support inbox')?.href).toBe('https://landly.test/admin/support?c=12025550123')
  })

  it('names the topic the member asked from, General when there is none', () => {
    const base = { waId: WA_ID, lang: 'en' as const, origin: 'https://landly.test' }
    const topic = (mail: ReturnType<typeof escalationEmail>) => mail.rows.find((row) => row.label === 'Topic')?.value
    expect(topic(escalationEmail({ ...base, category: 'purchase_help' }))).toBe('New order')
    expect(topic(escalationEmail(base))).toBe('General')
  })

  it('carries the member\'s written inquiry', () => {
    expect(escalationEmail({ waId: '12025550123', lang: 'en', origin: 'https://landly.test', inquiry: 'Where is my voucher?' }).message).toBe('Where is my voucher?')
  })
})
