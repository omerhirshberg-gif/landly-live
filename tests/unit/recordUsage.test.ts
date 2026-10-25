import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FieldValue } from 'firebase-admin/firestore'

// lib/usage/recordUsage.ts: the merge write it builds, how it's scheduled,
// and that nothing it does can fail the caller.

const mocks = vi.hoisted(() => ({
  set: vi.fn(),
  doc: vi.fn(),
  getAdminDb: vi.fn(),
  after: vi.fn(),
}))
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: mocks.after,
}))
vi.mock('@/lib/firebase/admin', () => ({
  getAdminDb: mocks.getAdminDb,
  getAdminProjectId: () => 'landly-dev',
}))

import { recordUsage, recordUsageBatch, usageWrite } from '@/lib/usage/recordUsage'

const NOW = new Date('2026-10-25T09:00:00Z')
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))
const isIncrement = (value: unknown, n: number) => value instanceof FieldValue && value.isEqual(FieldValue.increment(n))

let warn: ReturnType<typeof vi.spyOn>
let tasks: (() => Promise<void>)[]

beforeEach(() => {
  tasks = []
  mocks.after.mockImplementation((task: () => Promise<void>) => void tasks.push(task))
  mocks.set.mockResolvedValue(undefined)
  mocks.doc.mockReturnValue({ set: mocks.set })
  mocks.getAdminDb.mockReturnValue({ collection: (name: string) => ({ doc: (id: string) => mocks.doc(name, id) }) })
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('usageWrite', () => {
  it('nests each counter as an increment, for the month and for the day', () => {
    const write = usageWrite({ 'google.translation.chars': 120, 'google.translation.requests': 1, 'whatsapp.authSent': 1 }, NOW, 'landly-dev') as any
    expect(write.month).toBe('2026-10')
    expect(write.projectId).toBe('landly-dev')
    expect(write.updatedAt).toBeInstanceOf(FieldValue)
    expect(isIncrement(write.google.translation.chars, 120)).toBe(true)
    expect(isIncrement(write.google.translation.requests, 1)).toBe(true)
    expect(isIncrement(write.whatsapp.authSent, 1)).toBe(true)
    expect(isIncrement(write.daily['25'].google.translation.chars, 120)).toBe(true)
    expect(isIncrement(write.daily['25'].whatsapp.authSent, 1)).toBe(true)
    // No dotted keys: set() would store them as single field names.
    const keys = (value: unknown): string[] =>
      value && typeof value === 'object' && !(value instanceof FieldValue) ? Object.entries(value).flatMap(([k, v]) => [k, ...keys(v)]) : []
    expect(keys(write).filter((key) => key.includes('.'))).toEqual([])
  })
})

describe('recordUsage', () => {
  it('writes after the response, merging into apiUsageStats/{YYYY-MM}', async () => {
    recordUsage('google.places.autocompleteRequests', 1, NOW)
    expect(mocks.set).not.toHaveBeenCalled()
    expect(tasks).toHaveLength(1)
    await tasks[0]!()
    expect(mocks.doc).toHaveBeenCalledWith('apiUsageStats', '2026-10')
    const [write, options] = mocks.set.mock.calls[0]!
    expect(options).toEqual({ merge: true })
    expect(isIncrement(write.google.places.autocompleteRequests, 1)).toBe(true)
  })

  it('writes detached when there is no request scope for after()', async () => {
    mocks.after.mockImplementation(() => {
      throw new Error('`after` was called outside a request scope.')
    })
    expect(() => recordUsage('whatsapp.simulated', 1, NOW)).not.toThrow()
    await flush()
    expect(mocks.set).toHaveBeenCalledTimes(1)
  })

  it('records nothing for zero, negative or non-numeric amounts', () => {
    recordUsageBatch({ 'whatsapp.inboundMessages': 0, 'whatsapp.serviceSent': -1, 'whatsapp.authSent': Number.NaN, 'whatsapp.simulated': Infinity })
    recordUsage('whatsapp.inboundMessages', 0)
    expect(mocks.after).not.toHaveBeenCalled()
  })

  it('drops the empty counters of a batch and keeps the rest', async () => {
    recordUsageBatch({ 'google.places.detailsRequests': 1, 'google.places.sessionsCompleted': 0 }, NOW)
    await tasks[0]!()
    const [write] = mocks.set.mock.calls[0]!
    expect(Object.keys(write.google.places)).toEqual(['detailsRequests'])
  })

  it('only logs when Firestore rejects the write', async () => {
    mocks.set.mockRejectedValue(new Error('PERMISSION_DENIED'))
    recordUsage('whatsapp.authSent', 1, NOW)
    await expect(tasks[0]!()).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[usage] counters not recorded (whatsapp.authSent): PERMISSION_DENIED'))
  })

  it('only logs when the Admin SDK has no credentials', async () => {
    mocks.getAdminDb.mockImplementation(() => {
      throw new Error('FIREBASE_ADMIN_PROJECT_ID is not set')
    })
    recordUsage('google.geocoding.requests', 1, NOW)
    await expect(tasks[0]!()).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('gives up on a write that hangs, after 3 seconds', async () => {
    vi.useFakeTimers()
    mocks.set.mockReturnValue(new Promise(() => {}))
    recordUsage('google.translation.chars', 10, NOW)
    const done = tasks[0]!()
    await vi.advanceTimersByTimeAsync(3000)
    await expect(done).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('timed out after 3000ms'))
  })
})
