import { describe, expect, it, vi } from 'vitest'
import { createWishlistController } from '@/lib/firebase/wishlistController'

// The optimistic wishlist behind WishlistProvider (lib/firebase/wishlistController.ts):
// a tap shows at once, the listener confirms it, a failed write rolls it back.

function deferred() {
  let resolve!: () => void
  let reject!: (error: unknown) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('wishlist controller', () => {
  it('flips the heart synchronously, on the tap, before the write answers', () => {
    const write = deferred()
    const c = createWishlistController()
    c.setWriter(() => write.promise)
    const notified = vi.fn()
    c.subscribe(notified)
    c.toggle('a')
    expect(c.has('a')).toBe(true)
    expect(c.getIds()).toEqual(['a'])
    expect(notified).toHaveBeenCalledTimes(1)
  })

  it('drops the override once the listener confirms it, and keeps the list order from the server', () => {
    const c = createWishlistController()
    c.setWriter(() => new Promise(() => {}))
    c.setServerIds(['x'])
    c.toggle('a')
    expect(c.getIds()).toEqual(['x', 'a'])
    c.setServerIds(['x', 'a'])
    expect(c.getIds()).toEqual(['x', 'a'])
    // Confirmed: a later server list without it is the truth (removed elsewhere).
    c.setServerIds(['x'])
    expect(c.has('a')).toBe(false)
  })

  it('keeps an un-save applied while a stale snapshot still lists the offer', () => {
    const c = createWishlistController()
    c.setWriter(() => new Promise(() => {}))
    c.setServerIds(['a', 'b'])
    c.toggle('a')
    expect(c.has('a')).toBe(false)
    c.setServerIds(['a', 'b'])
    expect(c.has('a')).toBe(false)
    expect(c.getIds()).toEqual(['b'])
  })

  it('rolls back a failed write and tells the error listeners', async () => {
    const write = deferred()
    const c = createWishlistController()
    c.setWriter(() => write.promise)
    const onError = vi.fn()
    c.onError(onError)
    c.toggle('a')
    expect(c.has('a')).toBe(true)
    write.reject(new Error('permission-denied'))
    await settle()
    expect(c.has('a')).toBe(false)
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'permission-denied' }))
  })

  it('a failed earlier tap never undoes a newer one on the same offer', async () => {
    const first = deferred()
    const second = deferred()
    const writes = [first.promise, second.promise]
    const c = createWishlistController()
    c.setWriter(() => writes.shift()!)
    c.toggle('a') // save
    c.toggle('a') // un-save
    expect(c.has('a')).toBe(false)
    first.reject(new Error('offline'))
    await settle()
    expect(c.has('a')).toBe(false)
  })

  it('a writer that throws at once is rolled back too, never an unhandled error', async () => {
    const c = createWishlistController()
    c.setWriter(() => {
      throw new Error('sync')
    })
    const onError = vi.fn()
    c.onError(onError)
    c.toggle('a')
    await settle()
    expect(c.has('a')).toBe(false)
    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('does nothing signed out, and signing out clears saved ids and pending taps', () => {
    const c = createWishlistController()
    c.toggle('a')
    expect(c.has('a')).toBe(false)
    c.setWriter(() => new Promise(() => {}))
    c.setServerIds(['x'])
    c.toggle('a')
    c.setWriter(null)
    expect(c.getIds()).toEqual([])
  })

  it('returns the same ids array until something changes (useSyncExternalStore)', () => {
    const c = createWishlistController()
    c.setWriter(() => new Promise(() => {}))
    c.setServerIds(['a'])
    const ids = c.getIds()
    expect(c.getIds()).toBe(ids)
  })
})
