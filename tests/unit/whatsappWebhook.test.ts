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
vi.mock('@/lib/firebase/admin', () => ({ getAdminDb: () => mocks.store.db }))

import { GET, POST } from '@/app/api/webhooks/whatsapp/route'
import { verifyMetaSignature, verifyTokenMatches } from '@/lib/whatsapp/signature'
import { parseWebhookPayload, payloadPhoneNumberIds, type InboundEvent } from '@/lib/whatsapp/webhookPayload'
import { graphVersion } from '@/lib/whatsapp/graph'
import {
  alreadyEscalatedMessage,
  botLanguage,
  BUTTON_TITLE_MAX,
  currentStatus,
  decide,
  ESCALATION_SILENCE_MS,
  escalatedMessage,
  followUpMessage,
  FOOTER_MAX,
  GREETING_COOLDOWN_MS,
  INQUIRY_TIMEOUT_MS,
  inquiryPromptMessage,
  isLanguageKeyword,
  isMenuKeyword,
  languagePickerMessage,
  LIST_ROW_TITLE_MAX,
  linkMessage,
  menuMessage,
  resolvedMessage,
  transcriptText,
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

const buttonIds = (message: { interactive: { action: { buttons: { reply: { id: string } }[] } } }) =>
  message.interactive.action.buttons.map((b) => b.reply.id)
const rowIds = (message: { interactive: { action: { sections: { rows: { id: string }[] }[] } } }) =>
  message.interactive.action.sections.flatMap((section) => section.rows.map((row) => row.id))
const LANGUAGE_ROWS = ['lang_en', 'lang_he', 'lang_ru', 'lang_fr', 'lang_es']

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

  it('answers 200 and greets a new number with the English language list in after()', async () => {
    const res = await POST(signedPost(payload([textMsg('wamid.1', 'Hello')])))
    expect(res.status).toBe(200)
    await Promise.all(mocks.tasks)
    const [picker] = replies()
    // Even a +972 number: English until they pick.
    expect(picker.interactive.type).toBe('list')
    expect(picker.interactive.body.text).toMatch(/^Hi! 👋 Welcome to Landly/)
    expect(rowIds(picker)).toEqual(LANGUAGE_ROWS)
  })

  it('answers a picked language with the menu in that language', async () => {
    await POST(signedPost(payload([listMsg('wamid.1', 'lang_es')])))
    await Promise.all(mocks.tasks)
    const [changed, menu] = replies()
    expect(changed.text.body).toBe(translations.es.wa_bot_lang_changed)
    expect(menu.interactive.body.text).toBe(translations.es.wa_bot_menu_body)
    expect(mocks.store.read(`whatsappConversations/${WA_ID}`)).toMatchObject({ lang: 'es' })
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
    expect(replies()).toHaveLength(1)
  })
})

describe('parseWebhookPayload', () => {
  it('flattens text, reply-button and other messages with the profile name', () => {
    const events = parseWebhookPayload(
      payload([textMsg('a', 'hi'), buttonMsg('b', 'pass'), { from: WA_ID, id: 'c', timestamp: nowSeconds(), type: 'image', image: {} }]),
      PHONE_ID
    )
    expect(events.map((e) => e.kind)).toEqual(['text', 'button', 'other'])
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
    const ids = ['btn_ticket_resolved', 'btn_escalate_prompt', 'btn_back_to_menu', 'btn_cancel_inquiry', 'perks', 'team']
    const events = parseWebhookPayload(payload(ids.map((id, i) => buttonMsg(`m${i}`, id))), PHONE_ID)
    expect(events.map((e) => e.kind === 'button' && e.action)).toEqual([
      'btn_ticket_resolved', 'btn_escalate_prompt', 'btn_back_to_menu', 'btn_cancel_inquiry', 'btn_perks', 'btn_talk_to_team',
    ])
  })

  it('reads a picked language row, and keeps the type of other messages', () => {
    const events = parseWebhookPayload(
      payload([listMsg('a', 'lang_ru'), listMsg('b', 'lang_de'), listMsg('c', 'lang_toString'), { from: WA_ID, id: 'd', timestamp: nowSeconds(), type: 'audio', audio: {} }]),
      PHONE_ID
    )
    expect(events[0]).toMatchObject({ kind: 'language', lang: 'ru' })
    expect(events[1]).toMatchObject({ kind: 'other', media: 'interactive' })
    expect(events[2]).toMatchObject({ kind: 'other', media: 'interactive' })
    expect(events[3]).toMatchObject({ kind: 'other', media: 'audio' })
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
    expect(decide(event({ kind: 'button', action: 'btn_perks' }), busy)).toEqual({ kind: 'link', action: 'btn_perks' })
    expect(decide(event({ kind: 'button', action: 'btn_back_to_menu' }), busy)).toEqual({ kind: 'menu' })
    expect(decide(event({ kind: 'button', action: 'btn_cancel_inquiry' }), busy)).toEqual({ kind: 'menu' })
    expect(decide(event({ kind: 'button', action: 'btn_ticket_resolved' }), busy)).toEqual({ kind: 'resolve' })
    expect(decide(event({ kind: 'button', action: 'btn_talk_to_team' }), busy)).toEqual({ kind: 'promptInquiry' })
    expect(decide(event({ kind: 'button', action: 'btn_escalate_prompt' }), busy)).toEqual({ kind: 'promptInquiry' })
  })

  it('shows the menu for a menu keyword during the cooldown and while escalated', () => {
    const now = Date.now()
    for (const word of ['menu', 'MENU', ' Help ', 'תפריט', 'ראשי', 'עזרה', 'תפריט!']) expect(isMenuKeyword(word), word).toBe(true)
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
    expect(decide(event({ kind: 'button', action: 'btn_pass' }), escalated)).toEqual({ kind: 'link', action: 'btn_pass' })
    expect(decide(text('hello?'), ctx({ status: 'escalated', escalatedAt: now - ESCALATION_SILENCE_MS - 1, now }))).toEqual({ kind: 'menu' })
    // A conversation from before statuses, escalated by escalatedAt alone.
    expect(currentStatus(ctx({ escalatedAt: now - 1000, now }))).toBe('escalated')
  })

  it('links Perks to /categories and Pass to /member', () => {
    const perks = linkMessage('btn_perks', ctx())
    const pass = linkMessage('btn_pass', ctx({ isMember: true }))
    expect(perks.type === 'interactive' && perks.interactive.type === 'cta_url' && perks.interactive.action.parameters.url).toBe('https://landly.test/categories')
    expect(pass.type === 'interactive' && pass.interactive.type === 'cta_url' && pass.interactive.action.parameters.url).toBe('https://landly.test/member')
  })

  it('follows a link with Resolved, Talk to Team and Main Menu', () => {
    const followUp = followUpMessage('he')
    if (followUp.type !== 'interactive' || followUp.interactive.type !== 'button') throw new Error('expected a button message')
    expect(followUp.interactive.action.buttons).toEqual([
      { type: 'reply', reply: { id: 'btn_ticket_resolved', title: 'הסתדרתי, תודה 👍' } },
      { type: 'reply', reply: { id: 'btn_escalate_prompt', title: 'דברו עם הצוות 💬' } },
      { type: 'reply', reply: { id: 'btn_back_to_menu', title: 'תפריט ראשי 🔙' } },
    ])
    const en = followUpMessage('en')
    if (en.type !== 'interactive' || en.interactive.type !== 'button') throw new Error('expected a button message')
    expect(en.interactive.action.buttons.map((b) => b.reply.title)).toEqual(['All set, thanks 👍', 'Talk to Team 💬', 'Main Menu 🔙'])
  })

  it('answers in the picked language, else the member language, else English', () => {
    expect(botLanguage('fr', 'ru')).toBe('fr')
    expect(botLanguage(undefined, 'ru')).toBe('ru')
    expect(botLanguage('xx', 'he')).toBe('he')
    expect(botLanguage(undefined, undefined)).toBe('en')
    expect(botLanguage('toString')).toBe('en')
  })

  it('greets a number without a language with the picker, and keeps buttons working', () => {
    const now = Date.now()
    const fresh = ctx({ needsLanguage: true, now })
    expect(decide(text('hi'), fresh)).toEqual({ kind: 'languagePicker' })
    expect(decide(text('menu'), fresh)).toEqual({ kind: 'languagePicker' })
    expect(decide(event({ kind: 'other' }), fresh)).toEqual({ kind: 'languagePicker' })
    // The list obeys the menu's cooldown.
    expect(decide(text('hi'), ctx({ needsLanguage: true, lastMenuAt: now - 1000, now }))).toEqual({ kind: 'nudge' })
    expect(decide(event({ kind: 'button', action: 'btn_perks' }), fresh)).toEqual({ kind: 'link', action: 'btn_perks' })
    expect(decide(event({ kind: 'language', lang: 'fr' }), fresh)).toEqual({ kind: 'languageChosen', lang: 'fr' })
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

  it('lists the five languages within Meta list limits', () => {
    const picker = languagePickerMessage()
    if (picker.type !== 'interactive' || picker.interactive.type !== 'list') throw new Error('expected a list message')
    const { body, footer, action } = picker.interactive
    expect(action.button.length).toBeLessThanOrEqual(BUTTON_TITLE_MAX)
    expect(body.text.length).toBeLessThanOrEqual(1024)
    expect(footer!.text.length).toBeLessThanOrEqual(FOOTER_MAX)
    expect(action.sections).toHaveLength(1)
    const rows = action.sections[0].rows
    expect(rows.map((row) => row.title)).toEqual(['🇺🇸 English', '🇮🇱 עברית', '🇷🇺 Русский', '🇫🇷 Français', '🇪🇸 Español'])
    for (const row of rows) expect(row.title.length).toBeLessThanOrEqual(LIST_ROW_TITLE_MAX)
  })

  it('writes every kind of reply as plain text for the inbox', () => {
    expect(transcriptText({ type: 'text', text: { body: 'Hello' } })).toBe('Hello')
    expect(transcriptText(followUpMessage('en'))).toBe(`${translations.en.wa_bot_followup_body}\n[All set, thanks 👍] [Talk to Team 💬] [Main Menu 🔙]`)
    expect(transcriptText(linkMessage('btn_perks', ctx()))).toBe(`${translations.en.wa_bot_perks_body}\n[${translations.en.wa_bot_perks_cta}] https://landly.test/categories`)
    expect(transcriptText(languagePickerMessage())).toContain('[🇮🇱 עברית]')
  })

  it.each(Object.keys(translations) as Lang[])('keeps every %s button and link label within Meta limits', (lang) => {
    const buttonMessages = [
      menuMessage(ctx({ lang, memberFirstName: 'Dana' })),
      followUpMessage(lang),
      inquiryPromptMessage(lang),
      escalatedMessage(lang),
      alreadyEscalatedMessage(lang),
      resolvedMessage(lang),
    ]
    for (const message of buttonMessages) {
      if (message.type !== 'interactive' || message.interactive.type !== 'button') throw new Error('expected a button message')
      expect(message.interactive.footer?.text.length ?? 0).toBeLessThanOrEqual(FOOTER_MAX)
      expect(message.interactive.action.buttons.length).toBeLessThanOrEqual(3)
      expect(message.interactive.body.text.length).toBeLessThanOrEqual(1024)
      for (const button of message.interactive.action.buttons) expect(button.reply.title.length, button.reply.title).toBeLessThanOrEqual(BUTTON_TITLE_MAX)
    }
    for (const action of ['btn_perks', 'btn_pass'] as const) {
      const link = linkMessage(action, ctx({ lang }))
      if (link.type !== 'interactive' || link.interactive.type !== 'cta_url') throw new Error('expected a link message')
      expect(link.interactive.action.parameters.display_text.length).toBeLessThanOrEqual(BUTTON_TITLE_MAX)
      expect(link.interactive.body.text.length).toBeLessThanOrEqual(1024)
    }
  })

  it('keeps the support hours left-to-right inside the Hebrew confirmation', () => {
    expect(translations.he.wa_bot_team_confirm).toContain('⁦09:00–18:00⁩')
  })
})

describe('support bot handler', () => {
  const seedMember = () =>
    mocks.store.seed('users/member-1', { phone: `+${WA_ID}`, firstName: 'Dana', displayName: 'Dana Levi', email: 'dana@landly.test', preferredLanguage: 'fr' })
  const conversation = () => mocks.store.read(`whatsappConversations/${WA_ID}`)
  const transcript = () => Object.values(mocks.store.list(`whatsappConversations/${WA_ID}/messages`)).sort((a, b) => a.at.toMillis() - b.at.toMillis())
  /** A number that already picked Hebrew in the chat. */
  const hebrew = () => ({ lang: 'he', langSelectedAt: Timestamp.fromMillis(Date.now() - 60 * 60 * 1000) })
  const pickHebrew = () => mocks.store.seed(`whatsappConversations/${WA_ID}`, hebrew())

  it('greets a member by name in their profile language, skipping the language list, and records the conversation', async () => {
    seedMember()
    await handleInboundEvent(event({ kind: 'text', text: 'Bonjour', name: 'Dana WA' }))
    expect(replies()).toHaveLength(1)
    expect(replies()[0].interactive.body.text).toBe(translations.fr.wa_bot_menu_body_named.replace('{name}', 'Dana'))
    expect(replies()[0].interactive.footer).toEqual({ text: translations.fr.wa_bot_lang_footer })
    expect(conversation()).toMatchObject({ uid: 'member-1', memberName: 'Dana Levi', profileName: 'Dana WA', lang: 'fr', lastText: 'Bonjour', status: 'active' })
    expect(conversation()).not.toHaveProperty('langSelectedAt')
  })

  it('greets a new number in English with the language list, then continues in the picked language', async () => {
    const now = Date.now()
    await handleInboundEvent(event({ kind: 'text', text: 'שלום' }), now)
    expect(rowIds(replies()[0])).toEqual(LANGUAGE_ROWS)
    expect(conversation()).toMatchObject({ lang: 'en', status: 'active' })
    expect(conversation()?.lastMenuAt).toBeInstanceOf(Timestamp)

    await handleInboundEvent(event({ kind: 'language', lang: 'ru' }), now + 5000)
    const [changed, menu] = replies().slice(1)
    expect(changed).toEqual({ type: 'text', text: { body: translations.ru.wa_bot_lang_changed } })
    expect(menu.interactive.body.text).toBe(translations.ru.wa_bot_menu_body)
    expect(buttonIds(menu)).toEqual(['btn_perks', 'btn_pass', 'btn_talk_to_team'])
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
    expect(rowIds(replies()[0])).toEqual(LANGUAGE_ROWS)
    await handleInboundEvent(event({ kind: 'language', lang: 'he' }), now + 1000)
    expect(mocks.store.read('users/member-1')).toMatchObject({ preferredLanguage: 'he', firstName: 'Dana' })
    expect(replies().at(-1).interactive.body.text).toBe(translations.he.wa_bot_menu_body_named.replace('{name}', 'Dana'))
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
    expect(rowIds(replies().at(-1))).toEqual(LANGUAGE_ROWS)
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
    expect(entries[1].text).toContain(translations.he.wa_bot_menu_body)
    expect(entries[1]).toMatchObject({ simulated: true })
    expect(entries[2].text).toBe(translations.he.wa_bot_btn_perks)
    expect(entries[3].text).toContain('https://landly.test/categories')
    expect(entries[5].text).toBe('(image)')
    expect(entries[0].expiresAt.toMillis() - entries[0].at.toMillis()).toBe(MESSAGE_TTL_MS)
    expect(mocks.store.list(`whatsappConversations/${WA_ID}/messages`)['wamid.in1']).toBeDefined()
    expect(conversation()?.lastSnippet).toMatchObject({ text: '(image)', direction: 'in' })
    expect(conversation()?.lastOutboundAt).toBeInstanceOf(Timestamp)
  })

  it('stores the id Meta gives each sent reply', async () => {
    vi.stubEnv('WHATSAPP_OTP_LIVE', 'true')
    vi.stubEnv('WHATSAPP_ACCESS_TOKEN', 'token')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ messages: [{ id: 'wamid.out1' }] }), { status: 200 })))
    pickHebrew()
    await handleInboundEvent(event({ messageId: 'wamid.in1', kind: 'text', text: 'היי', phoneNumberId: PHONE_ID }))
    expect(Object.keys(mocks.store.list(`whatsappConversations/${WA_ID}/messages`)).sort()).toEqual(['wamid.in1', 'wamid.out1'])
    expect(conversation()).toMatchObject({ phoneNumberId: PHONE_ID })
  })

  it('escalates in two steps: prompts with Cancel, emails the inquiry, confirms with the hours, then stays silent', async () => {
    seedMember()
    const now = Date.now()
    await handleInboundEvent(event({ kind: 'button', action: 'btn_talk_to_team' }), now)
    expect(mocks.send).not.toHaveBeenCalled()
    const prompt = replies().at(-1)
    expect(prompt.interactive.body.text).toBe(translations.fr.wa_bot_inquiry_prompt)
    expect(buttonIds(prompt)).toEqual(['btn_cancel_inquiry'])
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
    expect(confirm.interactive.body.text).toBe(translations.fr.wa_bot_team_confirm)
    expect(buttonIds(confirm)).toEqual(['btn_back_to_menu'])
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
    expect(buttonIds(replies().at(-1))).toEqual(['btn_perks', 'btn_pass', 'btn_talk_to_team'])
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
    expect(buttonIds(replies().at(-1))).toEqual(['btn_perks', 'btn_pass', 'btn_talk_to_team'])
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
    expect(buttonIds(followUp)).toEqual(['btn_ticket_resolved', 'btn_escalate_prompt', 'btn_back_to_menu'])
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
    expect(signOff.interactive.action.buttons).toEqual([{ type: 'reply', reply: { id: 'btn_back_to_menu', title: '🔙 לתפריט הראשי' } }])
    const stored = conversation()!
    expect(stored.status).toBe('resolved')
    expect(stored.resolvedAt).toBeInstanceOf(Timestamp)
    expect(stored).not.toHaveProperty('escalatedAt')
    expect(stored).not.toHaveProperty('lastMenuAt')
    expect(stored).not.toHaveProperty('lastNudgeAt')
    // A greeting right after gets a fresh menu, not a nudge or silence.
    await handleInboundEvent(event({ kind: 'text', text: 'היי' }), now + 1000)
    expect(buttonIds(replies().at(-1))).toEqual(['btn_perks', 'btn_pass', 'btn_talk_to_team'])
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
    expect(replies().slice(2).map(buttonIds)).toEqual([
      ['btn_perks', 'btn_pass', 'btn_talk_to_team'],
      ['btn_perks', 'btn_pass', 'btn_talk_to_team'],
    ])

    await handleInboundEvent(event({ kind: 'text', text: 'היי' }), now + 31_000 + GREETING_COOLDOWN_MS)
    expect(buttonIds(replies().at(-1))).toEqual(['btn_perks', 'btn_pass', 'btn_talk_to_team'])
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
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ to: WA_ID, type: 'interactive', interactive: { type: 'button' } })
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

  it('carries the member\'s written inquiry', () => {
    expect(escalationEmail({ waId: '12025550123', lang: 'en', origin: 'https://landly.test', inquiry: 'Where is my voucher?' }).message).toBe('Where is my voucher?')
  })
})
