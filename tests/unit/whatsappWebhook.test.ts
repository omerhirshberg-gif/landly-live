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
import { parseWebhookPayload, type InboundEvent } from '@/lib/whatsapp/webhookPayload'
import { botLanguage, BUTTON_TITLE_MAX, decide, ESCALATION_SILENCE_MS, linkMessage, MENU_THROTTLE_MS, menuMessage, type BotContext } from '@/lib/whatsapp/supportBot'
import { handleInboundEvent } from '@/lib/whatsapp/supportBotHandler'
import { escalationEmail } from '@/lib/whatsapp/escalation'
import { translations, type Lang } from '@/lib/i18n/translations'

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
const replies = () =>
  (info.mock.calls as unknown[][])
    .map(([line]) => String(line))
    .filter((line) => line.startsWith('[whatsapp-bot] simulated reply'))
    .map((line) => JSON.parse(line.slice(line.indexOf('{'))))

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
  vi.spyOn(console, 'error').mockImplementation(() => {})
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
  })

  it('answers 200 and replies with the menu in after()', async () => {
    const res = await POST(signedPost(payload([textMsg('wamid.1', 'Hello')])))
    expect(res.status).toBe(200)
    await Promise.all(mocks.tasks)
    const [menu] = replies()
    expect(menu.interactive.type).toBe('button')
    expect(menu.interactive.action.buttons.map((b: { reply: { id: string } }) => b.reply.id)).toEqual(['perks', 'pass', 'team'])
    // Unknown +972 number: Hebrew.
    expect(menu.interactive.body.text).toBe(translations.he.wa_bot_menu_body)
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
    expect(events[1]).toMatchObject({ action: 'pass' })
  })

  it('skips other numbers, other objects, reactions and malformed senders', () => {
    expect(parseWebhookPayload(payload([textMsg('a', 'hi')], { phoneNumberId: '999' }), PHONE_ID)).toEqual([])
    expect(parseWebhookPayload({ object: 'page', entry: [] }, PHONE_ID)).toEqual([])
    expect(parseWebhookPayload(payload([{ from: WA_ID, id: 'r', type: 'reaction' }]), PHONE_ID)).toEqual([])
    expect(parseWebhookPayload(payload([{ from: '+97250', id: 'x', type: 'text', text: { body: 'hi' } }]), PHONE_ID)).toEqual([])
    expect(parseWebhookPayload(null)).toEqual([])
  })

  it('treats an unknown button id as a plain message', () => {
    expect(parseWebhookPayload(payload([buttonMsg('b', 'evil')]), PHONE_ID)[0].kind).toBe('other')
  })
})

describe('support bot decisions', () => {
  const ctx = (over: Partial<BotContext> = {}): BotContext => ({ lang: 'en', origin: 'https://landly.test', isMember: false, now: Date.now(), ...over })

  it('throttles the menu but always answers a button', () => {
    const now = Date.now()
    expect(decide(event({ kind: 'text' }), ctx({ lastMenuAt: now - 1000, now }))).toEqual({ kind: 'silent' })
    expect(decide(event({ kind: 'text' }), ctx({ lastMenuAt: now - MENU_THROTTLE_MS - 1, now }))).toEqual({ kind: 'menu' })
    expect(decide(event({ kind: 'button', action: 'perks' }), ctx({ lastMenuAt: now - 1000, now }))).toEqual({ kind: 'link', action: 'perks' })
  })

  it('stays silent for 24 hours after an escalation', () => {
    const now = Date.now()
    expect(decide(event({ kind: 'text' }), ctx({ escalatedAt: now - 1000, now }))).toEqual({ kind: 'silent' })
    expect(decide(event({ kind: 'button', action: 'team' }), ctx({ escalatedAt: now - 1000, now }))).toEqual({ kind: 'alreadyEscalated' })
    expect(decide(event({ kind: 'text' }), ctx({ escalatedAt: now - ESCALATION_SILENCE_MS - 1, now }))).toEqual({ kind: 'menu' })
  })

  it('links Perks to /categories and Pass to /member', () => {
    const perks = linkMessage('perks', ctx())
    const pass = linkMessage('pass', ctx({ isMember: true }))
    expect(perks.type === 'interactive' && perks.interactive.type === 'cta_url' && perks.interactive.action.parameters.url).toBe('https://landly.test/categories')
    expect(pass.type === 'interactive' && pass.interactive.type === 'cta_url' && pass.interactive.action.parameters.url).toBe('https://landly.test/member')
  })

  it('answers in the member language, else Hebrew for +972 and English otherwise', () => {
    expect(botLanguage('972501234567', 'ru')).toBe('ru')
    expect(botLanguage('972501234567')).toBe('he')
    expect(botLanguage('12025550123')).toBe('en')
    expect(botLanguage('12025550123', 'xx')).toBe('en')
  })

  it.each(Object.keys(translations) as Lang[])('keeps every %s button and link label within Meta limits', (lang) => {
    const menu = menuMessage(ctx({ lang, memberFirstName: 'Dana' }))
    if (menu.type !== 'interactive' || menu.interactive.type !== 'button') throw new Error('expected a button message')
    expect(menu.interactive.action.buttons).toHaveLength(3)
    for (const button of menu.interactive.action.buttons) expect(button.reply.title.length).toBeLessThanOrEqual(BUTTON_TITLE_MAX)
    for (const action of ['perks', 'pass'] as const) {
      const link = linkMessage(action, ctx({ lang }))
      if (link.type !== 'interactive' || link.interactive.type !== 'cta_url') throw new Error('expected a link message')
      expect(link.interactive.action.parameters.display_text.length).toBeLessThanOrEqual(BUTTON_TITLE_MAX)
      expect(link.interactive.body.text.length).toBeLessThanOrEqual(1024)
    }
  })
})

describe('support bot handler', () => {
  const seedMember = () =>
    mocks.store.seed('users/member-1', { phone: `+${WA_ID}`, firstName: 'Dana', displayName: 'Dana Levi', email: 'dana@landly.test', preferredLanguage: 'fr' })

  it('greets a member by name in their profile language and records the conversation', async () => {
    seedMember()
    await handleInboundEvent(event({ kind: 'text', text: 'Bonjour' }))
    expect(replies()[0].interactive.body.text).toBe(translations.fr.wa_bot_menu_body_named.replace('{name}', 'Dana'))
    expect(mocks.store.read(`whatsappConversations/${WA_ID}`)).toMatchObject({ uid: 'member-1', lang: 'fr', lastText: 'Bonjour' })
  })

  it('escalates: emails the team with a wa.me link, confirms, then stays silent', async () => {
    seedMember()
    await handleInboundEvent(event({ kind: 'text', text: 'My voucher does not work' }))
    await handleInboundEvent(event({ kind: 'button', action: 'team' }))

    expect(mocks.send).toHaveBeenCalledTimes(1)
    const mail = mocks.send.mock.calls[0][0]
    expect(mail.to).toBe('contact@golandly.com')
    expect(mail.replyTo).toBe('dana@landly.test')
    expect(mail.html).toContain(`https://wa.me/${WA_ID}`)
    expect(mail.text).toContain('member-1')
    expect(mail.text).toContain('Dana Levi')
    expect(mail.text).toContain('Language: fr')
    expect(mail.text).toContain('My voucher does not work')
    expect(replies().at(-1).text.body).toBe(translations.fr.wa_bot_team_confirm)
    expect(mocks.store.read(`whatsappConversations/${WA_ID}`)?.escalatedAt).toBeInstanceOf(Timestamp)

    const before = replies().length
    await handleInboundEvent(event({ kind: 'text', text: 'hello?' }), Date.now() + MENU_THROTTLE_MS + 1)
    expect(replies()).toHaveLength(before)
    await handleInboundEvent(event({ kind: 'button', action: 'team' }))
    expect(mocks.send).toHaveBeenCalledTimes(1)
    expect(replies().at(-1).text.body).toBe(translations.fr.wa_bot_team_already)
  })

  it('tells the sender when the team could not be emailed, and does not go silent', async () => {
    mocks.send.mockResolvedValue({ error: { name: 'validation_error', statusCode: 422, message: 'nope' } })
    await handleInboundEvent(event({ kind: 'button', action: 'team', name: 'Guest' }))
    expect(replies().at(-1).text.body).toBe(translations.he.wa_bot_team_failed.replace('{email}', '⁦contact@golandly.com⁩'))
    expect(mocks.store.read(`whatsappConversations/${WA_ID}`)?.escalatedAt).toBeUndefined()
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
    await handleInboundEvent(event({ kind: 'button', action: 'perks' }))
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`)
    expect(JSON.parse(init.body)).toMatchObject({ messaging_product: 'whatsapp', to: WA_ID, type: 'interactive', interactive: { type: 'cta_url' } })
  })
})

describe('escalation email', () => {
  it('names an unknown sender by number and lets Reply reach the team inbox', () => {
    const mail = escalationEmail({ waId: '12025550123', lang: 'en' })
    expect(mail.replyTo).toBe('contact@golandly.com')
    expect(mail.rows.find((r) => r.label === 'WhatsApp')).toEqual({ label: 'WhatsApp', value: '+12025550123', href: 'https://wa.me/12025550123' })
    expect(mail.rows.find((r) => r.label === 'Member UID')?.value).toMatch(/No Landly account/)
  })
})
