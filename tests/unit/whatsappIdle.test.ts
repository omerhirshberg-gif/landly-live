import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Timestamp, type DocumentData } from 'firebase-admin/firestore'
import { MemoryFirestore } from '../helpers/memoryFirestore'

const mocks = vi.hoisted(() => ({ store: null as unknown as MemoryFirestore }))
vi.mock('resend', () => ({ Resend: class { emails = { send: vi.fn().mockResolvedValue({ error: null }) } } }))
vi.mock('@/lib/firebase/admin', () => ({ getAdminDb: () => mocks.store.db }))

import { GET } from '@/app/api/cron/whatsapp-idle/route'
import { AUTO_RESOLVED_NOTE, idleAction, nextIdleDue, PURGE_SLACK_MS, sweepIdleConversations } from '@/lib/whatsapp/idleSweep'
import { IDLE_GRACE_MS, idleMs } from '@/lib/whatsapp/supportBot'
import { MESSAGE_TTL_MS } from '@/lib/whatsapp/conversationLog'
import { handleInboundEvent } from '@/lib/whatsapp/supportBotHandler'
import { replyAsTeam, setConversationStatus } from '@/lib/whatsapp/adminInbox'
import { translations } from '@/lib/i18n/translations'

const WA_ID = '972501234567'
const MINUTE = 60 * 1000
const IDLE = 25 * MINUTE
const path = (waId = WA_ID) => `whatsappConversations/${waId}`
const ts = (ms: number) => Timestamp.fromMillis(ms)

let info: ReturnType<typeof vi.spyOn>
const checkIns = () =>
  (info.mock.calls as unknown[][])
    .map(([line]) => String(line))
    .filter((line) => line.startsWith('[whatsapp-idle] simulated check-in'))
    .map((line) => JSON.parse(line.slice(line.indexOf('{'))))
const botReplies = () =>
  (info.mock.calls as unknown[][]).map(([line]) => String(line)).filter((line) => line.startsWith('[whatsapp-bot] simulated reply'))
const transcript = (waId = WA_ID) => Object.values(mocks.store.list(`${path(waId)}/messages`)).sort((a, b) => a.at.toMillis() - b.at.toMillis())

/**
 * A Hebrew conversation where the member wrote `inboundAgo` and the bot
 * answered `outboundAgo` before `now`, its check-in due IDLE after that answer
 * (as supportBotHandler.ts sets it).
 */
function seed(now: number, { inboundAgo = IDLE + 2 * MINUTE, outboundAgo = IDLE + MINUTE, ...rest }: { inboundAgo?: number; outboundAgo?: number } & DocumentData = {}, waId = WA_ID) {
  mocks.store.seed(path(waId), {
    lang: 'he',
    langSelectedAt: ts(now - 2 * 60 * MINUTE),
    status: 'active',
    lastInboundAt: ts(now - inboundAgo),
    lastOutboundAt: ts(now - outboundAgo),
    idleDueAt: ts(now - outboundAgo + IDLE),
    expiresAt: ts(now + MESSAGE_TTL_MS),
    ...rest,
  })
}

beforeEach(() => {
  mocks.store = new MemoryFirestore()
  vi.stubEnv('APP_URL', 'https://landly.test/')
  info = vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('idle timing', () => {
  it('waits WHATSAPP_IDLE_MINUTES, held between 20 and 30, else 25', () => {
    expect(idleMs(undefined)).toBe(25 * MINUTE)
    expect(idleMs('')).toBe(25 * MINUTE)
    expect(idleMs('abc')).toBe(25 * MINUTE)
    expect(idleMs('22')).toBe(22 * MINUTE)
    expect(idleMs('5')).toBe(20 * MINUTE)
    expect(idleMs('90')).toBe(30 * MINUTE)
  })

  it('checks in once the bot has spoken last and the member has been quiet long enough', () => {
    const now = Date.now()
    const data = (over: DocumentData) => ({ status: 'active', lastInboundAt: ts(now - 30 * MINUTE), lastOutboundAt: ts(now - IDLE), ...over })
    expect(idleAction(data({}), now, IDLE)).toBe('checkIn')
    expect(idleAction(data({ lastOutboundAt: ts(now - IDLE + 1000) }), now, IDLE)).toBeNull()
    // The member wrote last: the bot owes nothing, and nothing is owed to it.
    expect(idleAction(data({ lastInboundAt: ts(now - IDLE + 1000) }), now, IDLE)).toBeNull()
    // With the team, or over.
    expect(idleAction(data({ status: 'escalated', escalatedAt: ts(now - 30 * MINUTE) }), now, IDLE)).toBeNull()
    expect(idleAction(data({ status: 'resolved' }), now, IDLE)).toBeNull()
    // Outside Meta's 24-hour window nothing can be sent.
    expect(idleAction(data({ lastInboundAt: ts(now - 25 * 60 * MINUTE), lastOutboundAt: ts(now - 24 * 60 * MINUTE) }), now, IDLE)).toBeNull()
    // A request the member was asked for counts too.
    expect(idleAction(data({ status: 'awaiting_user_inquiry', inquiryPromptedAt: ts(now - IDLE) }), now, IDLE)).toBe('checkIn')
  })

  it('resolves an unanswered check-in after the grace period, and never twice-checks', () => {
    const now = Date.now()
    const checkedIn = (ago: number, over: DocumentData = {}) => ({
      status: 'active',
      lastInboundAt: ts(now - ago - IDLE - MINUTE),
      lastOutboundAt: ts(now - ago),
      idleCheckInAt: ts(now - ago),
      ...over,
    })
    expect(idleAction(checkedIn(IDLE_GRACE_MS - 1000), now, IDLE)).toBeNull()
    expect(idleAction(checkedIn(IDLE_GRACE_MS), now, IDLE)).toBe('resolve')
    expect(idleAction(checkedIn(IDLE_GRACE_MS, { lastInboundAt: ts(now - 1000) }), now, IDLE)).toBeNull()
  })
})

describe('sweepIdleConversations', () => {
  it('sends one check-in in the member\'s language, logs it, and never repeats it', async () => {
    const now = Date.now()
    seed(now)
    expect(await sweepIdleConversations(now)).toEqual({ checkedIn: 1, resolved: 0, purged: 0 })
    const [checkIn] = checkIns()
    expect(checkIn.interactive.type).toBe('button')
    expect(checkIn.interactive.body.text).toBe(translations.he.wa_bot_idle_checkin)
    expect(checkIn.interactive.action.buttons.map((b: { reply: { id: string; title: string } }) => [b.reply.id, b.reply.title])).toEqual([
      ['btn_idle_yes', translations.he.wa_bot_btn_idle_yes],
      ['btn_idle_done', translations.he.wa_bot_btn_resolved],
    ])
    const stored = mocks.store.read(path())!
    expect(stored.idleCheckInAt.toMillis()).toBe(now)
    // Next due: the resolve, once the grace period is over.
    expect(stored.idleDueAt.toMillis()).toBe(now + IDLE_GRACE_MS)
    expect(stored.lastOutboundAt.toMillis()).toBe(now)
    expect(stored.expiresAt.toMillis()).toBe(now + MESSAGE_TTL_MS)
    expect(stored).not.toHaveProperty('idleResume')
    expect(transcript()).toEqual([expect.objectContaining({ direction: 'out', author: 'bot', simulated: true, text: expect.stringContaining(translations.he.wa_bot_idle_checkin) })])

    // Later runs, before and after the idle time passes again, send nothing more.
    expect((await sweepIdleConversations(now + 5 * MINUTE)).checkedIn).toBe(0)
    expect((await sweepIdleConversations(now + IDLE + MINUTE)).checkedIn).toBe(0)
    expect(checkIns()).toHaveLength(1)
  })

  it('leaves alone chats with the team, resolved, still fresh, answered by the member, or outside the window', async () => {
    const now = Date.now()
    seed(now, { status: 'escalated', escalatedAt: ts(now - IDLE - MINUTE) }, '972500000001')
    seed(now, { status: 'resolved' }, '972500000002')
    seed(now, { outboundAgo: 5 * MINUTE }, '972500000003')
    seed(now, { inboundAgo: MINUTE }, '972500000004')
    seed(now, { inboundAgo: 25 * 60 * MINUTE, outboundAgo: 25 * 60 * MINUTE - MINUTE }, '972500000005')
    expect(await sweepIdleConversations(now)).toEqual({ checkedIn: 0, resolved: 0, purged: 0 })
    expect(checkIns()).toHaveLength(0)
  })

  it('resolves without a word to the member once the grace period passes, leaving the team a note', async () => {
    const now = Date.now()
    seed(now, { lastMenuAt: ts(now - IDLE - MINUTE) })
    await sweepIdleConversations(now)
    const later = now + IDLE_GRACE_MS
    expect(await sweepIdleConversations(later)).toEqual({ checkedIn: 0, resolved: 1, purged: 0 })
    const stored = mocks.store.read(path())!
    expect(stored).toMatchObject({ status: 'resolved', resolvedBy: 'idle' })
    expect(stored.resolvedAt.toMillis()).toBe(later)
    for (const field of ['idleCheckInAt', 'idleResume', 'lastMenuAt', 'escalatedAt', 'idleDueAt']) expect(stored).not.toHaveProperty(field)
    // Silent: the check-in is the only message sent; the note is the team's alone.
    expect(checkIns()).toHaveLength(1)
    expect(transcript()).toHaveLength(2)
    const note = transcript()[1]
    expect(note).toMatchObject({ direction: 'out', author: 'system', kind: 'note', text: AUTO_RESOLVED_NOTE })
    expect(note.at.toMillis()).toBe(later)
    expect(note).not.toHaveProperty('simulated')
    // The inbox list still shows the last message sent: the check-in.
    expect(stored.lastSnippet.text).toContain(translations.he.wa_bot_idle_checkin)
    expect(await sweepIdleConversations(later + MINUTE)).toEqual({ checkedIn: 0, resolved: 0, purged: 0 })
  })

  it('does not resolve a member who wrote back after the check-in', async () => {
    const now = Date.now()
    seed(now)
    await sweepIdleConversations(now)
    await handleInboundEvent({ messageId: 'wamid.back', waId: WA_ID, at: now + MINUTE, kind: 'text', text: 'עדיין כאן' }, now + MINUTE)
    expect(mocks.store.read(path())).not.toHaveProperty('idleCheckInAt')
    expect((await sweepIdleConversations(now + IDLE_GRACE_MS)).resolved).toBe(0)
    expect(mocks.store.read(path())!.status).toBe('active')
  })

  it('takes Yes, need help back to the request the member was asked for', async () => {
    const now = Date.now()
    seed(now, { status: 'awaiting_user_inquiry', inquiryPromptedAt: ts(now - IDLE - MINUTE), inquiryCategory: 'order_issue' })
    await sweepIdleConversations(now)
    expect(mocks.store.read(path())).toMatchObject({ idleResume: 'inquiry' })
    // Past the inquiry's own 30 minutes, Yes still asks for it again.
    await handleInboundEvent({ messageId: 'wamid.yes', waId: WA_ID, at: now + 10 * MINUTE, kind: 'button', action: 'btn_idle_yes' }, now + 10 * MINUTE)
    expect(botReplies().at(-1)).toContain(translations.he.wa_bot_inquiry_prompt)
    expect(mocks.store.read(path())).toMatchObject({ status: 'awaiting_user_inquiry', inquiryCategory: 'order_issue' })
    expect(mocks.store.read(path())).not.toHaveProperty('idleResume')
  })

  it('resolves on All set, thanks with the usual sign-off', async () => {
    const now = Date.now()
    seed(now)
    await sweepIdleConversations(now)
    await handleInboundEvent({ messageId: 'wamid.done', waId: WA_ID, at: now + MINUTE, kind: 'button', action: 'btn_idle_done' }, now + MINUTE)
    expect(mocks.store.read(path())).toMatchObject({ status: 'resolved' })
    expect(botReplies().at(-1)).toContain(translations.he.wa_bot_resolved)
  })

  it('purges chats and their messages well past expiresAt, behind the TTL policy', async () => {
    const now = Date.now()
    const old = MESSAGE_TTL_MS + PURGE_SLACK_MS + 1000
    seed(now, { inboundAgo: old + MINUTE, outboundAgo: old, expiresAt: ts(now - PURGE_SLACK_MS - 1000) }, '972500000009')
    mocks.store.seed(`${path('972500000009')}/messages/m1`, { text: 'old', at: ts(now - MESSAGE_TTL_MS - PURGE_SLACK_MS), expiresAt: ts(now - PURGE_SLACK_MS - 1000) })
    // Expired, but recently: the TTL policy still has time to get to it.
    seed(now, { status: 'resolved', expiresAt: ts(now - 1000) }, '972500000010')
    const result = await sweepIdleConversations(now)
    expect(result.purged).toBe(1)
    expect(mocks.store.read(path('972500000009'))).toBeUndefined()
    expect(mocks.store.read(`${path('972500000009')}/messages/m1`)).toBeUndefined()
    expect(mocks.store.read(path('972500000010'))).toBeDefined()
  })
})

describe('GET /api/cron/whatsapp-idle', () => {
  const call = (authorization?: string) => GET(new Request('https://landly.test/api/cron/whatsapp-idle', { headers: authorization ? { authorization } : {} }))

  it('is unavailable until CRON_SECRET is set', async () => {
    vi.stubEnv('CRON_SECRET', '')
    expect((await call('Bearer anything')).status).toBe(503)
  })

  it('refuses a missing or wrong secret without sweeping', async () => {
    vi.stubEnv('CRON_SECRET', 'cron-secret-value')
    seed(Date.now())
    expect((await call()).status).toBe(401)
    expect((await call('Bearer nope')).status).toBe(401)
    expect((await call('cron-secret-value')).status).toBe(401)
    expect(checkIns()).toHaveLength(0)
  })

  it('sweeps with the secret Vercel Cron sends', async () => {
    vi.stubEnv('CRON_SECRET', 'cron-secret-value')
    seed(Date.now())
    const res = await call('Bearer cron-secret-value')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, checkedIn: 1, resolved: 0, purged: 0 })
  })
})

describe('schedule and retention config', () => {
  it('runs the sweep every 5 minutes on Vercel Cron', () => {
    const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'))
    expect(vercel.crons).toEqual([{ path: '/api/cron/whatsapp-idle', schedule: '*/5 * * * *' }])
  })

  it('declares TTL policies on expiresAt for conversations, their messages and seen ids', () => {
    const { fieldOverrides } = JSON.parse(readFileSync('firebase.indexes.json', 'utf8'))
    const ttl = fieldOverrides.filter((o: { ttl?: boolean; fieldPath: string }) => o.ttl && o.fieldPath === 'expiresAt').map((o: { collectionGroup: string }) => o.collectionGroup)
    expect(ttl).toEqual(expect.arrayContaining(['whatsappConversations', 'messages', 'whatsappInbound']))
    // The purge's range query on expiresAt needs the field indexed.
    const conversations = fieldOverrides.find((o: { collectionGroup: string }) => o.collectionGroup === 'whatsappConversations')
    expect(conversations.indexes).toEqual([{ order: 'ASCENDING', queryScope: 'COLLECTION' }])
  })
})

describe('idleDueAt', () => {
  it('is when the check-in, then the resolve, falls due, and never for chats with the team, over, or past the window', () => {
    const now = Date.now()
    const data = (over: DocumentData) => ({ status: 'active', lastInboundAt: ts(now - 10 * MINUTE), lastOutboundAt: ts(now - 5 * MINUTE), ...over })
    expect(nextIdleDue(data({}), now, IDLE)).toBe(now - 5 * MINUTE + IDLE)
    expect(nextIdleDue(data({ idleCheckInAt: ts(now - MINUTE) }), now, IDLE)).toBe(now - MINUTE + IDLE_GRACE_MS)
    expect(nextIdleDue(data({ idleCheckInAt: ts(now - 20 * MINUTE) }), now, IDLE)).toBeUndefined()
    expect(nextIdleDue(data({ lastInboundAt: ts(now - MINUTE) }), now, IDLE)).toBeUndefined()
    expect(nextIdleDue(data({ status: 'escalated', escalatedAt: ts(now - MINUTE) }), now, IDLE)).toBeUndefined()
    expect(nextIdleDue(data({ status: 'resolved' }), now, IDLE)).toBeUndefined()
    // Due after Meta's window closes: no check-in could be sent.
    expect(nextIdleDue(data({ lastInboundAt: ts(now - 24 * 60 * MINUTE + 10 * MINUTE) }), now, IDLE)).toBeUndefined()
  })

  it('is set when the bot answers, and cleared when the team takes over or the member is done', async () => {
    const now = Date.now()
    seed(now, { inboundAgo: 3 * MINUTE, outboundAgo: 2 * MINUTE })
    await handleInboundEvent({ messageId: 'wamid.menu', waId: WA_ID, at: now, kind: 'text', text: 'תפריט' }, now)
    const stored = mocks.store.read(path())!
    expect(stored.idleDueAt.toMillis()).toBe(stored.lastOutboundAt.toMillis() + IDLE)

    await handleInboundEvent({ messageId: 'wamid.done', waId: WA_ID, at: now + MINUTE, kind: 'button', action: 'btn_ticket_resolved' }, now + MINUTE)
    expect(mocks.store.read(path())).toMatchObject({ status: 'resolved' })
    expect(mocks.store.read(path())).not.toHaveProperty('idleDueAt')

    seed(now, { inboundAgo: 3 * MINUTE, outboundAgo: 2 * MINUTE }, '972500000020')
    await replyAsTeam('972500000020', 'Hi, this is Landly', now)
    expect(mocks.store.read(path('972500000020'))).not.toHaveProperty('idleDueAt')

    seed(now, { inboundAgo: 3 * MINUTE, outboundAgo: 2 * MINUTE }, '972500000021')
    await setConversationStatus('972500000021', 'active', false, now)
    expect(mocks.store.read(path('972500000021'))).not.toHaveProperty('idleDueAt')
  })

  it('reaches a waiting chat however many chats with the team or already over came before it', async () => {
    const now = Date.now()
    for (let i = 0; i < 250; i++) {
      const waId = `97250${String(i).padStart(7, '0')}`
      // As the handler leaves them: no idleDueAt.
      seed(now, i % 2 ? { status: 'resolved', outboundAgo: 2 * IDLE } : { status: 'escalated', escalatedAt: ts(now - 2 * IDLE), outboundAgo: 2 * IDLE }, waId)
      const { idleDueAt: _, ...rest } = mocks.store.read(path(waId))!
      mocks.store.seed(path(waId), rest)
    }
    seed(now, {}, '972599999999')
    expect(await sweepIdleConversations(now)).toEqual({ checkedIn: 1, resolved: 0, purged: 0 })
    expect(mocks.store.read(path('972599999999'))).toHaveProperty('idleCheckInAt')
  })

  it('clears a stale idleDueAt with nothing to do, so the chat isn’t read again', async () => {
    const now = Date.now()
    seed(now, { status: 'escalated', escalatedAt: ts(now - MINUTE) }, '972500000030')
    seed(now, { inboundAgo: MINUTE }, '972500000031')
    expect(await sweepIdleConversations(now)).toEqual({ checkedIn: 0, resolved: 0, purged: 0 })
    expect(mocks.store.read(path('972500000030'))).not.toHaveProperty('idleDueAt')
    expect(mocks.store.read(path('972500000031'))).not.toHaveProperty('idleDueAt')
    expect(checkIns()).toHaveLength(0)
  })

  it('moves an idleDueAt that came too early to when the work really falls due', async () => {
    const now = Date.now()
    seed(now, { outboundAgo: 5 * MINUTE, idleDueAt: ts(now - MINUTE) })
    expect((await sweepIdleConversations(now)).checkedIn).toBe(0)
    expect(mocks.store.read(path())!.idleDueAt.toMillis()).toBe(now - 5 * MINUTE + IDLE)
  })

  it('works through due chats in batches, and leaves the rest for the next run when out of time', async () => {
    const now = Date.now()
    for (let i = 0; i < 25; i++) seed(now, {}, `97251${String(i).padStart(7, '0')}`)
    expect((await sweepIdleConversations(now, Date.now() - 1)).checkedIn).toBe(0)
    expect(vi.mocked(console.warn).mock.calls.some(([line]) => String(line).includes('25 due conversation(s) left'))).toBe(true)
    expect((await sweepIdleConversations(now)).checkedIn).toBe(25)
    expect(checkIns()).toHaveLength(25)
  })
})
