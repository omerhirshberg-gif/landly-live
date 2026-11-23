import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ comingSoon: true, offer: { fulfillmentType: 'raayonit_pool' } as Record<string, unknown> }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/flags/featureFlags.server', () => ({ isRaayonitComingSoonEnabled: async () => mocks.comingSoon }))

// A database that only answers the first offer read: launch-pending mode must refuse before anything else is touched.
const db = {
  collection: () => ({ doc: () => ({ id: 'o', get: async () => ({ data: () => mocks.offer }) }) }),
  runTransaction: () => { throw new Error('the order must be refused before any transaction') },
} as never

beforeEach(() => { mocks.comingSoon = true; mocks.offer = { fulfillmentType: 'raayonit_pool' } })

describe('initiateOrder in Raayonit launch-pending mode', () => {
  it('refuses a Raayonit order with a 503 before reserving a code or opening a transaction', async () => {
    const { initiateOrder } = await import('@/lib/payments/initiateOrder')
    await expect(initiateOrder(db, 'user1', 'offer1', 'term')).rejects.toMatchObject({ status: 503 })
  })

  it('does not stop it when the mode is off (it goes on to the transaction)', async () => {
    mocks.comingSoon = false
    const { initiateOrder } = await import('@/lib/payments/initiateOrder')
    await expect(initiateOrder(db, 'user1', 'offer1', 'term')).rejects.toThrow(/before any transaction|ledger|Cannot|undefined/i)
  })

  it('never stops a non-Raayonit offer', async () => {
    mocks.offer = { fulfillmentType: 'direct_merchant' }
    const { initiateOrder } = await import('@/lib/payments/initiateOrder')
    await expect(initiateOrder(db, 'user1', 'offer1', 'term')).rejects.not.toMatchObject({ status: 503 })
  })
})
