import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Timestamp, type DocumentData } from 'firebase-admin/firestore'
import { MemoryFirestore } from '../helpers/memoryFirestore'

const mocks = vi.hoisted(() => ({ store: null as unknown as MemoryFirestore }))
vi.mock('resend', () => ({ Resend: class { emails = { send: vi.fn().mockResolvedValue({ error: null }) } } }))
vi.mock('@/lib/firebase/admin', () => ({ getAdminDb: () => mocks.store.db }))

import { GET } from '@/app/api/cron/whatsapp-idle/route'
import { AUTO_RESOLVED_NOTE, idleAction, idleSchedule, nextIdleDue, PURGE_SLACK_MS, sweepIdleConversations, TEAM_AUTO_RESOLVED_NOTE } from '@/lib/whatsapp/idleSweep'
import { IDLE_GRACE_MS, idleMs, teamNudgeMs, teamResolveMs } from '@/lib/whatsapp/supportBot'
import { MESSAGE_TTL_MS } from '@/lib/whatsapp/conversationLog'
import { handleInboundEvent } from '@/lib/whatsapp/supportBotHandler'
import { getConversation, replyAsTeam, setConversationStatus } from '@/lib/whatsapp/adminInbox'
import { translations } from '@/lib/i18n/translations'

const WA_ID = '972501234567'
const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
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

  it('is set when the bot answers, moved to the team\'s follow-up when the team replies, and cleared when the member is done or the bot takes over', async () => {
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
    // Now the team's follow-up is what falls due.
    expect(mocks.store.read(path('972500000020'))!.idleDueAt.toMillis()).toBe(now + 12 * HOUR)

    seed(now, { inboundAgo: 3 * MINUTE, outboundAgo: 2 * MINUTE }, '972500000021')
    await setConversationStatus('972500000021', 'active', false, now)
    expect(mocks.store.read(path('972500000021'))).not.toHaveProperty('idleDueAt')
  })

  it('is not set while the chat still awaits its language, and is once the language is picked', async () => {
    const now = Date.now()
    await handleInboundEvent({ messageId: 'wamid.hi', waId: WA_ID, at: now, kind: 'text', text: 'hi' }, now)
    expect(mocks.store.read(path())).toHaveProperty('lastOutboundAt')
    expect(mocks.store.read(path())).not.toHaveProperty('idleDueAt')
    expect(await sweepIdleConversations(now + 2 * IDLE)).toEqual({ checkedIn: 0, resolved: 0, purged: 0 })

    await handleInboundEvent({ messageId: 'wamid.lang', waId: WA_ID, at: now + MINUTE, kind: 'language', lang: 'he' }, now + MINUTE)
    const stored = mocks.store.read(path())!
    expect(stored.idleDueAt.toMillis()).toBe(stored.lastOutboundAt.toMillis() + IDLE)
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

const teamFollowUps = () =>
  (info.mock.calls as unknown[][])
    .map(([line]) => String(line))
    .filter((line) => line.startsWith('[whatsapp-idle] simulated team follow-up'))
    .map((line) => JSON.parse(line.slice(line.indexOf('{'))))

/** A Hebrew chat with the team: the member wrote `inboundAgo` before the team's reply `replyAgo` before `now`. */
function seedTeam(now: number, { replyAgo = 0, inboundAgo = HOUR, ...rest }: { replyAgo?: number; inboundAgo?: number } & DocumentData = {}, waId = WA_ID) {
  mocks.store.seed(path(waId), {
    lang: 'he',
    langSelectedAt: ts(now - 48 * HOUR),
    status: 'escalated',
    escalatedAt: ts(now - replyAgo),
    lastInboundAt: ts(now - replyAgo - inboundAgo),
    lastAdminReplyAt: ts(now - replyAgo),
    lastOutboundAt: ts(now - replyAgo),
    expiresAt: ts(now + MESSAGE_TTL_MS),
    ...rest,
  })
}

describe('team follow-up timing', () => {
  it('waits WHATSAPP_TEAM_NUDGE_HOURS and WHATSAPP_TEAM_RESOLVE_HOURS, held between 12 and 24, else 12 and 24', () => {
    expect(teamNudgeMs(undefined)).toBe(12 * HOUR)
    expect(teamNudgeMs('18')).toBe(18 * HOUR)
    expect(teamNudgeMs('2')).toBe(12 * HOUR)
    expect(teamNudgeMs('48')).toBe(24 * HOUR)
    expect(teamResolveMs(undefined)).toBe(24 * HOUR)
    expect(teamResolveMs('abc')).toBe(24 * HOUR)
    expect(teamResolveMs('12')).toBe(12 * HOUR)
  })

  it('follows up 12 hours after the team\'s reply, held an hour inside Meta\'s window', () => {
    const now = Date.now()
    const team = (replyAfterInbound: number, over: DocumentData = {}) => ({
      status: 'escalated',
      escalatedAt: ts(now),
      lastInboundAt: ts(now - replyAfterInbound),
      lastAdminReplyAt: ts(now),
      ...over,
    })
    // Answered an hour after the member wrote: the full 12 hours.
    expect(idleSchedule(team(HOUR), now, IDLE)).toEqual({ action: 'teamNudge', at: now + 12 * HOUR })
    // Answered 15 hours after: by hour 23 of the window, 8 hours after the reply.
    expect(idleSchedule(team(15 * HOUR), now, IDLE)).toEqual({ action: 'teamNudge', at: now + 8 * HOUR })
    // Exactly 2 hours left for the member still counts.
    expect(idleSchedule(team(21 * HOUR), now, IDLE)).toEqual({ action: 'teamNudge', at: now + 2 * HOUR })
    // Less than that: no follow-up, only the silent resolve, as if it had gone out on time.
    expect(idleSchedule(team(22 * HOUR), now, IDLE)).toEqual({ action: 'teamResolve', at: now + 36 * HOUR })
    // After the follow-up: the resolve, 24 hours on.
    expect(idleSchedule(team(HOUR, { teamNudgeAt: ts(now + 12 * HOUR) }), now, IDLE)).toEqual({ action: 'teamResolve', at: now + 36 * HOUR })
  })

  it('never times out while the member wrote last, or once the chat is the bot\'s or over', () => {
    const now = Date.now()
    const base = { status: 'escalated', escalatedAt: ts(now - 13 * HOUR), lastAdminReplyAt: ts(now - 13 * HOUR), lastInboundAt: ts(now - 14 * HOUR) }
    expect(idleAction(base, now, IDLE)).toBe('teamNudge')
    // The member answered: the reply is the team's to give.
    expect(idleSchedule({ ...base, lastInboundAt: ts(now - HOUR) }, now, IDLE)).toBeUndefined()
    expect(idleSchedule({ ...base, status: 'resolved' }, now, IDLE)).toBeUndefined()
    expect(idleSchedule({ ...base, status: 'active' }, now, IDLE)).toBeUndefined()
    // An escalation without a reply from the team (the member asked, nobody answered yet) has nothing due.
    const { lastAdminReplyAt: _, ...unanswered } = base
    expect(idleSchedule(unanswered, now, IDLE)).toBeUndefined()
  })

  it('still resolves once the escalation\'s own 24 hours have lapsed', () => {
    const now = Date.now()
    const data = { status: 'escalated', escalatedAt: ts(now - 25 * HOUR), lastAdminReplyAt: ts(now - 37 * HOUR), lastInboundAt: ts(now - 38 * HOUR), teamNudgeAt: ts(now - 25 * HOUR) }
    expect(idleAction(data, now, IDLE)).toBe('teamResolve')
  })

  it('skips a follow-up that would fall outside the window, even when the sweep runs late', () => {
    const now = Date.now()
    // Due at hour 23 of the window, but the sweep only reaches it after the window closed.
    const data = { status: 'escalated', escalatedAt: ts(now - 10 * HOUR), lastAdminReplyAt: ts(now - 10 * HOUR), lastInboundAt: ts(now - 24 * HOUR - MINUTE) }
    expect(idleSchedule(data, now, IDLE)).toEqual({ action: 'teamResolve', at: now - 10 * HOUR + 36 * HOUR })
    expect(idleAction(data, now, IDLE)).toBeNull()
  })
})

describe('team follow-up sweep', () => {
  it('starts with the team\'s reply, follows up once in the member\'s language, then resolves silently a day later', async () => {
    const now = Date.now()
    seed(now, { inboundAgo: 3 * MINUTE, outboundAgo: 2 * MINUTE, status: 'escalated', escalatedAt: ts(now - 2 * MINUTE) })
    await replyAsTeam(WA_ID, 'הנה התשובה שלנו', now)
    expect(mocks.store.read(path())!.idleDueAt.toMillis()).toBe(now + 12 * HOUR)
    expect((await getConversation(WA_ID, now))!.conversation.followUp).toEqual({ stage: 'nudge', sentAt: null, dueAt: new Date(now + 12 * HOUR).toISOString() })

    // Not yet.
    expect(await sweepIdleConversations(now + 11 * HOUR)).toEqual({ checkedIn: 0, resolved: 0, purged: 0 })

    const nudgeAt = now + 12 * HOUR
    expect(await sweepIdleConversations(nudgeAt)).toEqual({ checkedIn: 1, resolved: 0, purged: 0 })
    const [nudge] = teamFollowUps()
    expect(nudge.interactive.type).toBe('button')
    expect(nudge.interactive.body.text).toBe(translations.he.wa_team_nudge)
    expect(nudge.interactive.action.buttons.map((b: { reply: { id: string; title: string } }) => [b.reply.id, b.reply.title])).toEqual([
      ['btn_idle_done', translations.he.wa_bot_btn_resolved],
      ['btn_team_nudge_yes', translations.he.wa_bot_btn_team_nudge_yes],
    ])
    let stored = mocks.store.read(path())!
    expect(stored.teamNudgeAt.toMillis()).toBe(nudgeAt)
    // The bot stays quiet while the member may answer the team.
    expect(stored.escalatedAt.toMillis()).toBe(nudgeAt)
    expect(stored.idleDueAt.toMillis()).toBe(nudgeAt + 24 * HOUR)
    expect(stored.lastOutboundAt.toMillis()).toBe(nudgeAt)
    expect(checkIns()).toHaveLength(0)
    expect((await getConversation(WA_ID, nudgeAt))!.conversation.followUp).toEqual({
      stage: 'resolve',
      sentAt: new Date(nudgeAt).toISOString(),
      dueAt: new Date(nudgeAt + 24 * HOUR).toISOString(),
    })

    // Never twice.
    expect((await sweepIdleConversations(nudgeAt + 5 * MINUTE)).checkedIn).toBe(0)
    expect(teamFollowUps()).toHaveLength(1)

    expect(await sweepIdleConversations(nudgeAt + 24 * HOUR)).toEqual({ checkedIn: 0, resolved: 1, purged: 0 })
    stored = mocks.store.read(path())!
    expect(stored).toMatchObject({ status: 'resolved', resolvedBy: 'team_idle' })
    for (const field of ['teamNudgeAt', 'escalatedAt', 'idleDueAt', 'idleCheckInAt']) expect(stored).not.toHaveProperty(field)
    // Silent to the member: the follow-up is the only message the sweep sent; the note is the team's.
    expect(teamFollowUps()).toHaveLength(1)
    expect(transcript().at(-1)).toMatchObject({ author: 'system', kind: 'note', text: TEAM_AUTO_RESOLVED_NOTE })
    expect((await getConversation(WA_ID, nudgeAt + 24 * HOUR))!.conversation).toMatchObject({ status: 'resolved', followUp: null })

    // Open door: the member's next message starts over with the menu.
    const back = nudgeAt + 30 * HOUR
    await handleInboundEvent({ messageId: 'wamid.back', waId: WA_ID, at: back, kind: 'text', text: 'היי' }, back)
    expect(transcript().at(-1)!.text).toContain(translations.he.wa_bot_menu_body)
  })

  it('stops the clock when the member writes, and leaves the chat waiting on the team', async () => {
    const now = Date.now()
    seedTeam(now, { replyAgo: 12 * HOUR, idleDueAt: ts(now) })
    await sweepIdleConversations(now)
    await handleInboundEvent({ messageId: 'wamid.reply', waId: WA_ID, at: now + HOUR, kind: 'text', text: 'עוד לא קיבלתי' }, now + HOUR)
    const stored = mocks.store.read(path())!
    expect(stored).not.toHaveProperty('teamNudgeAt')
    expect(stored).not.toHaveProperty('idleDueAt')
    expect(stored.status).toBe('escalated')
    expect((await getConversation(WA_ID, now + HOUR))!.conversation).toMatchObject({ needsReply: true, followUp: null })
    expect(await sweepIdleConversations(now + 48 * HOUR)).toEqual({ checkedIn: 0, resolved: 0, purged: 0 })
  })

  it('answers Still need help: back with the team, awaiting its reply, the bot quiet for another day', async () => {
    const now = Date.now()
    seedTeam(now, { replyAgo: 12 * HOUR, idleDueAt: ts(now) })
    await sweepIdleConversations(now)
    const tap = now + 2 * HOUR
    await handleInboundEvent({ messageId: 'wamid.yes', waId: WA_ID, at: tap, kind: 'button', action: 'btn_team_nudge_yes' }, tap)
    const stored = mocks.store.read(path())!
    expect(stored.status).toBe('escalated')
    expect(stored.escalatedAt.toMillis()).toBe(tap)
    expect(stored).not.toHaveProperty('teamNudgeAt')
    expect(stored).not.toHaveProperty('idleDueAt')
    expect(transcript().at(-2)).toMatchObject({ direction: 'in', kind: 'button', text: translations.he.wa_bot_btn_team_nudge_yes })
    expect(transcript().at(-1)!.text).toContain(translations.he.wa_bot_team_already)
    expect((await getConversation(WA_ID, tap))!.conversation).toMatchObject({ status: 'escalated', needsReply: true })
  })

  it('answers All set from the follow-up: resolved at once', async () => {
    const now = Date.now()
    seedTeam(now, { replyAgo: 12 * HOUR, idleDueAt: ts(now) })
    await sweepIdleConversations(now)
    await handleInboundEvent({ messageId: 'wamid.done', waId: WA_ID, at: now + HOUR, kind: 'button', action: 'btn_idle_done' }, now + HOUR)
    const stored = mocks.store.read(path())!
    expect(stored.status).toBe('resolved')
    expect(stored).not.toHaveProperty('idleDueAt')
    expect(stored).not.toHaveProperty('teamNudgeAt')
    expect(transcript().at(-1)!.text).toContain(translations.he.wa_bot_resolved)
  })

  it('resolves without a follow-up when the window left no room for one', async () => {
    const now = Date.now()
    // The team answered 22 hours after the member wrote.
    seed(now, { inboundAgo: 22 * HOUR, outboundAgo: 22 * HOUR, status: 'escalated', escalatedAt: ts(now - 22 * HOUR) })
    await replyAsTeam(WA_ID, 'Sorry for the wait', now)
    expect(mocks.store.read(path())!.idleDueAt.toMillis()).toBe(now + 36 * HOUR)
    expect(await sweepIdleConversations(now + 12 * HOUR)).toEqual({ checkedIn: 0, resolved: 0, purged: 0 })
    expect(await sweepIdleConversations(now + 36 * HOUR)).toEqual({ checkedIn: 0, resolved: 1, purged: 0 })
    expect(teamFollowUps()).toHaveLength(0)
    expect(mocks.store.read(path())).toMatchObject({ status: 'resolved', resolvedBy: 'team_idle' })
  })

  it('stops the clock on any status change from the inbox, until the team replies again', async () => {
    const now = Date.now()
    for (const [i, status] of (['active', 'escalated', 'resolved'] as const).entries()) {
      const waId = `97250000004${i}`
      seedTeam(now, { replyAgo: 12 * HOUR, idleDueAt: ts(now) }, waId)
      await sweepIdleConversations(now)
      await setConversationStatus(waId, status, false, now + HOUR)
      expect(mocks.store.read(path(waId))).not.toHaveProperty('teamNudgeAt')
      expect(mocks.store.read(path(waId))).not.toHaveProperty('idleDueAt')
    }
    expect(await sweepIdleConversations(now + 48 * HOUR)).toEqual({ checkedIn: 0, resolved: 0, purged: 0 })
  })

  it('leaves the bot\'s own check-in to chats the bot leads', async () => {
    const now = Date.now()
    seedTeam(now, { replyAgo: 30 * MINUTE, idleDueAt: ts(now) })
    expect(await sweepIdleConversations(now)).toEqual({ checkedIn: 0, resolved: 0, purged: 0 })
    expect(checkIns()).toHaveLength(0)
    // Rescheduled to the follow-up instead.
    expect(mocks.store.read(path())!.idleDueAt.toMillis()).toBe(now - 30 * MINUTE + 12 * HOUR)
  })
})

describe('Resolve & thank', () => {
  it('thanks the member in their language while the window is open', async () => {
    const now = Date.now()
    seedTeam(now, { replyAgo: HOUR })
    const result = await setConversationStatus(WA_ID, 'resolved', true, now)
    expect(result).toMatchObject({ ok: true, notified: true })
    expect(transcript().at(-1)).toMatchObject({ author: 'admin', text: expect.stringContaining(translations.he.wa_team_resolved_thanks) })
  })

  it('resolves without a message once the window has closed', async () => {
    const now = Date.now()
    seedTeam(now, { replyAgo: 20 * HOUR, inboundAgo: 5 * HOUR })
    const result = await setConversationStatus(WA_ID, 'resolved', true, now)
    expect(result).toMatchObject({ ok: true, notified: false, conversation: { status: 'resolved', windowOpen: false } })
    expect(transcript()).toHaveLength(0)
  })
})
