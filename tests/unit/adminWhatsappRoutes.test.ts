import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Timestamp } from 'firebase-admin/firestore'
import { MemoryFirestore } from '../helpers/memoryFirestore'

const mocks = vi.hoisted(() => ({ store: null as unknown as MemoryFirestore }))
vi.mock('@/lib/firebase/admin', () => ({ getAdminDb: () => mocks.store.db }))

import { GET as listRoute } from '@/app/api/admin/whatsapp/conversations/route'
import { GET as chatRoute } from '@/app/api/admin/whatsapp/conversations/[waId]/route'
import { POST as replyRoute } from '@/app/api/admin/whatsapp/reply/route'
import { POST as statusRoute } from '@/app/api/admin/whatsapp/status/route'
import { issueAdminSessionToken } from '@/lib/admin/sessionToken'
import { translations } from '@/lib/i18n/translations'
import { handleInboundEvent } from '@/lib/whatsapp/supportBotHandler'
import { ESCALATION_SILENCE_MS, GREETING_COOLDOWN_MS } from '@/lib/whatsapp/supportBot'

const WA_ID = '972501234567'
const OTHER = '12025550123'
const PHONE_ID = '1460975470423545'
const HOUR = 60 * 60 * 1000
const conversationPath = (waId = WA_ID) => `whatsappConversations/${waId}`

let token: string
const auth = () => ({ Authorization: `Bearer ${token}` })
const get = (path: string, headers: Record<string, string> = auth()) => new Request(`https://landly.test${path}`, { headers })
const post = (path: string, body: unknown, headers: Record<string, string> = auth()) =>
  new Request(`https://landly.test${path}`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const params = (waId: string) => ({ params: Promise.resolve({ waId }) })
const transcript = (waId = WA_ID) => Object.values(mocks.store.list(`${conversationPath(waId)}/messages`)).sort((a, b) => a.at.toMillis() - b.at.toMillis())

function seedConversation(waId: string, fields: Record<string, unknown> = {}) {
  mocks.store.seed(conversationPath(waId), {
    lang: 'he',
    langSelectedAt: Timestamp.fromMillis(Date.now() - 2 * HOUR),
    lastInboundAt: Timestamp.fromMillis(Date.now() - 60_000),
    status: 'escalated',
    escalatedAt: Timestamp.fromMillis(Date.now() - 50_000),
    phoneNumberId: PHONE_ID,
    memberName: 'Dana Levi',
    uid: 'member-1',
    lastSnippet: { text: 'My voucher does not work', direction: 'in', at: Timestamp.fromMillis(Date.now() - 60_000) },
    ...fields,
  })
}

let info: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  mocks.store = new MemoryFirestore()
  vi.stubEnv('ADMIN_SESSION_SECRET', 'test-session-secret')
  vi.stubEnv('APP_URL', 'https://landly.test/')
  vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', PHONE_ID)
  token = issueAdminSessionToken()
  info = vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('admin WhatsApp routes: auth and validation', () => {
  it('refuses every route without a valid admin session', async () => {
    seedConversation(WA_ID)
    const bad = { Authorization: 'Bearer forged.token' }
    expect((await listRoute(get('/api/admin/whatsapp/conversations', bad))).status).toBe(401)
    expect((await chatRoute(get(`/api/admin/whatsapp/conversations/${WA_ID}`, {}), params(WA_ID))).status).toBe(401)
    expect((await replyRoute(post('/api/admin/whatsapp/reply', { waId: WA_ID, message: 'hi' }, bad))).status).toBe(401)
    expect((await statusRoute(post('/api/admin/whatsapp/status', { waId: WA_ID, status: 'resolved' }, bad))).status).toBe(401)
    expect(transcript()).toEqual([])
  })

  it('refuses a malformed WhatsApp ID, message or status', async () => {
    seedConversation(WA_ID)
    expect((await chatRoute(get('/api/admin/whatsapp/conversations/..%2Fusers'), params('../users'))).status).toBe(400)
    expect((await replyRoute(post('/api/admin/whatsapp/reply', { waId: '+972', message: 'hi' }))).status).toBe(400)
    expect((await replyRoute(post('/api/admin/whatsapp/reply', { waId: WA_ID, message: '   ' }))).status).toBe(400)
    expect((await replyRoute(post('/api/admin/whatsapp/reply', { waId: WA_ID, message: 'x'.repeat(4097) }))).status).toBe(400)
    expect((await statusRoute(post('/api/admin/whatsapp/status', { waId: WA_ID, status: 'awaiting_user_inquiry' }))).status).toBe(400)
    expect((await replyRoute(new Request('https://landly.test/api/admin/whatsapp/reply', { method: 'POST', headers: auth(), body: 'not json' }))).status).toBe(400)
  })

  it('answers 404 for a number that never wrote', async () => {
    expect((await chatRoute(get(`/api/admin/whatsapp/conversations/${OTHER}`), params(OTHER))).status).toBe(404)
    expect((await replyRoute(post('/api/admin/whatsapp/reply', { waId: OTHER, message: 'hi' }))).status).toBe(404)
    expect((await statusRoute(post('/api/admin/whatsapp/status', { waId: OTHER, status: 'resolved' }))).status).toBe(404)
  })
})

describe('GET /api/admin/whatsapp/conversations', () => {
  it('lists conversations newest first with language, status, reply state and snippet', async () => {
    seedConversation(WA_ID)
    seedConversation(OTHER, {
      lang: 'en',
      langSelectedAt: undefined,
      memberName: undefined,
      uid: undefined,
      profileName: 'Sam',
      status: 'active',
      escalatedAt: undefined,
      lastInboundAt: Timestamp.fromMillis(Date.now() - 30 * HOUR),
    })
    const res = await listRoute(get('/api/admin/whatsapp/conversations'))
    expect(res.status).toBe(200)
    const { conversations } = await res.json()
    expect(conversations.map((c: { waId: string }) => c.waId)).toEqual([WA_ID, OTHER])
    expect(conversations[0]).toMatchObject({
      name: 'Dana Levi',
      uid: 'member-1',
      lang: 'he',
      langSelected: true,
      status: 'escalated',
      needsReply: true,
      windowOpen: true,
      lastSnippet: { text: 'My voucher does not work', direction: 'in' },
    })
    expect(conversations[1]).toMatchObject({ name: 'Sam', uid: null, lang: 'en', langSelected: false, status: 'active', needsReply: false, windowOpen: false })
  })

  it('answers ?summary=1 with just the count waiting for a reply', async () => {
    seedConversation(WA_ID)
    seedConversation(OTHER, { status: 'active', escalatedAt: undefined })
    const res = await listRoute(get('/api/admin/whatsapp/conversations?summary=1'))
    expect(await res.json()).toEqual({ needsReplyCount: 1 })
    expect((await listRoute(get('/api/admin/whatsapp/conversations?summary=1', {}))).status).toBe(401)
  })

    it('shows a lapsed escalation as back with the bot', async () => {
    seedConversation(WA_ID, { escalatedAt: Timestamp.fromMillis(Date.now() - ESCALATION_SILENCE_MS - 1000) })
    const { conversations } = await (await listRoute(get('/api/admin/whatsapp/conversations'))).json()
    expect(conversations[0]).toMatchObject({ status: 'active', needsReply: false })
  })
})

describe('GET /api/admin/whatsapp/conversations/[waId]', () => {
  it('returns the transcript the bot logged, oldest first', async () => {
    mocks.store.seed(conversationPath(), { lang: 'fr', langSelectedAt: Timestamp.now() })
    const now = Date.now()
    await handleInboundEvent({ messageId: 'wamid.a', waId: WA_ID, at: now - 1000, kind: 'text', text: 'Bonjour', phoneNumberId: PHONE_ID }, now)
    const res = await chatRoute(get(`/api/admin/whatsapp/conversations/${WA_ID}`), params(WA_ID))
    expect(res.status).toBe(200)
    const { conversation, messages } = await res.json()
    expect(conversation).toMatchObject({ waId: WA_ID, lang: 'fr', status: 'active' })
    // The menu is one list.
    expect(messages.map((m: { author: string }) => m.author)).toEqual(['member', 'bot'])
    expect(messages[0]).toMatchObject({ id: 'wamid.a', direction: 'in', text: 'Bonjour' })
    expect(messages[1].text).toContain(translations.fr.wa_bot_menu_body)
    expect(messages[1]).toMatchObject({ direction: 'out', simulated: true })
  })
})

describe('POST /api/admin/whatsapp/reply', () => {
  it('logs a simulated reply outside production and keeps the bot quiet', async () => {
    seedConversation(WA_ID)
    const res = await replyRoute(post('/api/admin/whatsapp/reply', { waId: WA_ID, message: '  שלום דנה, בודקים את זה עכשיו  ' }))
    expect(res.status).toBe(200)
    const { message } = await res.json()
    expect(message).toMatchObject({ direction: 'out', author: 'admin', kind: 'text', text: 'שלום דנה, בודקים את זה עכשיו', simulated: true })
    expect((info.mock.calls as unknown[][]).map(([line]) => String(line))).toContain(
      `[whatsapp-inbox] simulated team reply to +97 •••• 4567: ${JSON.stringify({ type: 'text', text: { body: 'שלום דנה, בודקים את זה עכשיו' } })}`
    )
    const stored = mocks.store.read(conversationPath())!
    expect(stored.status).toBe('escalated')
    expect(stored.escalatedAt.toMillis()).toBe(stored.lastAdminReplyAt.toMillis())
    expect(stored.lastSnippet).toMatchObject({ text: 'שלום דנה, בודקים את זה עכשיו', direction: 'out' })
    expect(transcript()).toHaveLength(1)

    const { conversations } = await (await listRoute(get('/api/admin/whatsapp/conversations'))).json()
    expect(conversations[0].needsReply).toBe(false)

    // The member answers: the bot stays out of it, and the chat needs a reply again.
    await handleInboundEvent({ messageId: 'wamid.b', waId: WA_ID, at: Date.now() + 1000, kind: 'text', text: 'תודה!' }, Date.now() + GREETING_COOLDOWN_MS + 1000)
    expect(transcript().map((m) => m.author)).toEqual(['admin', 'member'])
    const after = await (await listRoute(get('/api/admin/whatsapp/conversations'))).json()
    expect(after.conversations[0]).toMatchObject({ status: 'escalated', needsReply: true })
  })

  it('sends through the Graph API from the number the member wrote to, and stores Meta\'s id', async () => {
    vi.stubEnv('WHATSAPP_OTP_LIVE', 'true')
    vi.stubEnv('WHATSAPP_ACCESS_TOKEN', 'token')
    seedConversation(WA_ID, { phoneNumberId: '1367683866451764' })
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ messages: [{ id: 'wamid.team1' }] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const res = await replyRoute(post('/api/admin/whatsapp/reply', { waId: WA_ID, message: 'On it!' }))
    expect(res.status).toBe(200)
    expect((await res.json()).message.id).toBe('wamid.team1')
    expect(fetchMock.mock.calls[0][0]).toBe('https://graph.facebook.com/v21.0/1367683866451764/messages')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ to: WA_ID, type: 'text', text: { body: 'On it!' } })
    expect(Object.keys(mocks.store.list(`${conversationPath()}/messages`))).toEqual(['wamid.team1'])
  })

  it('refuses a reply once the 24-hour window has closed, sending nothing', async () => {
    seedConversation(WA_ID, { lastInboundAt: Timestamp.fromMillis(Date.now() - 25 * HOUR) })
    const res = await replyRoute(post('/api/admin/whatsapp/reply', { waId: WA_ID, message: 'Hello?' }))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('window_closed')
    expect(transcript()).toEqual([])
  })

  it('keeps a reply Meta refused in the transcript as failed, without changing the status', async () => {
    vi.stubEnv('WHATSAPP_OTP_LIVE', 'true')
    vi.stubEnv('WHATSAPP_ACCESS_TOKEN', 'token')
    seedConversation(WA_ID)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 131047, message: 'Re-engagement message' } }), { status: 400 })))
    const before = mocks.store.read(conversationPath())!
    const res = await replyRoute(post('/api/admin/whatsapp/reply', { waId: WA_ID, message: 'Hi' }))
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body).toMatchObject({ code: '131047', message: { error: 'Re-engagement message', author: 'admin' } })
    expect(transcript()[0]).toMatchObject({ error: 'Re-engagement message', text: 'Hi' })
    expect(mocks.store.read(conversationPath())).not.toHaveProperty('lastAdminReplyAt')
    expect(mocks.store.read(conversationPath())!.escalatedAt.toMillis()).toBe(before.escalatedAt.toMillis())
  })
})

describe('POST /api/admin/whatsapp/status', () => {
  it('resolves with the team\'s thanks in the member\'s language and clears the timers', async () => {
    seedConversation(WA_ID, { lastMenuAt: Timestamp.now(), inquiryPromptedAt: Timestamp.now() })
    const res = await statusRoute(post('/api/admin/whatsapp/status', { waId: WA_ID, status: 'resolved' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ ok: true, notified: true, conversation: { status: 'resolved', needsReply: false } })
    const stored = mocks.store.read(conversationPath())!
    expect(stored.resolvedAt).toBeInstanceOf(Timestamp)
    for (const field of ['escalatedAt', 'lastMenuAt', 'inquiryPromptedAt']) expect(stored).not.toHaveProperty(field)
    expect(transcript()[0].text).toContain(translations.he.wa_team_resolved_thanks)

    // The member's next message gets a fresh Hebrew menu from the bot.
    await handleInboundEvent({ messageId: 'wamid.c', waId: WA_ID, at: Date.now() + 1000, kind: 'text', text: 'היי' }, Date.now() + 1000)
    expect(transcript().at(-1)!.text).toContain(translations.he.wa_bot_menu_body)
  })

  it('resolves quietly with notify: false, or once the window has closed', async () => {
    seedConversation(WA_ID)
    expect(await (await statusRoute(post('/api/admin/whatsapp/status', { waId: WA_ID, status: 'resolved', notify: false }))).json()).toMatchObject({ notified: false })
    seedConversation(OTHER, { lastInboundAt: Timestamp.fromMillis(Date.now() - 30 * HOUR) })
    expect(await (await statusRoute(post('/api/admin/whatsapp/status', { waId: OTHER, status: 'resolved' }))).json()).toMatchObject({ notified: false })
    expect(transcript()).toEqual([])
    expect(transcript(OTHER)).toEqual([])
  })

  it('escalates to silence the bot, and hands back to it with active', async () => {
    seedConversation(WA_ID, { status: 'active', escalatedAt: undefined })
    const escalated = await (await statusRoute(post('/api/admin/whatsapp/status', { waId: WA_ID, status: 'escalated' }))).json()
    expect(escalated.conversation.status).toBe('escalated')
    expect(mocks.store.read(conversationPath())!.escalatedAt).toBeInstanceOf(Timestamp)

    const active = await (await statusRoute(post('/api/admin/whatsapp/status', { waId: WA_ID, status: 'active' }))).json()
    expect(active.conversation.status).toBe('active')
    expect(mocks.store.read(conversationPath())).not.toHaveProperty('escalatedAt')
  })
})
