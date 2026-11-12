import { describe, expect, it, vi } from 'vitest'
import { chunked, getAllById, IN_QUERY_LIMIT } from '@/lib/firebase/batching'
import { adminListParams, adminNextCursor, ADMIN_LIST_CAP } from '@/lib/admin/adminList'

vi.mock('server-only', () => ({}))

const ref = (path: string) => ({ path }) as never

describe('chunked', () => {
  it('splits into groups of at most the size, keeping order', () => {
    expect(chunked([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunked([], 30)).toEqual([])
    expect(IN_QUERY_LIMIT).toBe(30)
  })
})

describe('getAllById', () => {
  it('reads every distinct ref in one getAll, however many are asked for', async () => {
    const getAll = vi.fn(async (...refs: { path: string }[]) => refs.map((r) => ({ id: r.path, exists: true })))
    const result = await getAllById({ getAll } as never, [ref('businesses/a'), ref('businesses/b'), ref('businesses/a')])
    expect(getAll).toHaveBeenCalledTimes(1)
    expect(getAll.mock.calls[0]).toHaveLength(2)
    expect([...result.keys()]).toEqual(['businesses/a', 'businesses/b'])
  })

  it('makes no call for an empty list', async () => {
    const getAll = vi.fn()
    expect((await getAllById({ getAll } as never, [])).size).toBe(0)
    expect(getAll).not.toHaveBeenCalled()
  })
})

describe('admin list paging', () => {
  const req = (query = '') => new Request(`https://x.test/api/admin/offers${query}`)

  it('defaults to the cap, with no cursor, when called as the admin screens call it', () => {
    expect(adminListParams(req(), 's')).toEqual({ limit: ADMIN_LIST_CAP, cursor: null })
    expect(ADMIN_LIST_CAP).toBe(500)
  })

  it('walks pages with a cursor tied to its list, and rejects another list\'s or a forged one', () => {
    const next = adminNextCursor(true, 'doc9', 's')!
    expect(adminNextCursor(false, 'doc9', 's')).toBeNull()
    expect(adminListParams(req(`?limit=50&cursor=${next}`), 's')).toMatchObject({ limit: 50, cursor: { id: 'doc9', scope: 's' } })
    expect(() => adminListParams(req(`?limit=50&cursor=${next}`), 'other')).toThrow('cursor is invalid')
    expect(() => adminListParams(req('?limit=50&cursor=garbage'), 's')).toThrow('cursor is invalid')
    expect(() => adminListParams(req('?limit=101'), 's')).toThrow('limit must be')
    expect(() => adminListParams(req('?limit=0'), 's')).toThrow('limit must be')
  })
})
