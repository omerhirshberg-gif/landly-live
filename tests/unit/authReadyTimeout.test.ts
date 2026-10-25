import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { watchAuthState } from '@/lib/firebase/authReady'

// AuthProvider's wait for Firebase Auth (lib/firebase/authReady.ts).
type Next = (user: { uid: string } | null) => void

function setup(timeoutMs?: number) {
  let emit: Next = () => {}
  const unsubscribe = vi.fn()
  const onUser = vi.fn()
  const onReady = vi.fn()
  const stop = watchAuthState<{ uid: string }>((next) => {
    emit = next
    return unsubscribe
  }, { onUser, onReady }, timeoutMs)
  return { emit: (user: { uid: string } | null) => emit(user), unsubscribe, onUser, onReady, stop }
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('watchAuthState', () => {
  it('is ready at the first answer, before the timeout', () => {
    const w = setup(5000)
    w.emit(null)
    expect(w.onUser).toHaveBeenCalledWith(null)
    expect(w.onReady).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(10_000)
    expect(w.onReady).toHaveBeenCalledTimes(1)
  })

  it('carries on as a guest when Auth never answers in time', () => {
    const w = setup(5000)
    vi.advanceTimersByTime(4999)
    expect(w.onReady).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(w.onReady).toHaveBeenCalledTimes(1)
    expect(w.onUser).not.toHaveBeenCalled()
  })

  it('still signs the member in when the answer comes after the timeout', () => {
    const w = setup(5000)
    vi.advanceTimersByTime(6000)
    w.emit({ uid: 'u1' })
    expect(w.onUser).toHaveBeenCalledWith({ uid: 'u1' })
    expect(w.onReady).toHaveBeenCalledTimes(1)
  })

  it('without a timeout waits for Auth however long it takes (the app, unchanged)', () => {
    const w = setup()
    vi.advanceTimersByTime(60_000)
    expect(w.onReady).not.toHaveBeenCalled()
    w.emit({ uid: 'u1' })
    expect(w.onReady).toHaveBeenCalledTimes(1)
  })

  it('unsubscribes and drops the timer on cleanup', () => {
    const w = setup(5000)
    w.stop()
    expect(w.unsubscribe).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(6000)
    expect(w.onReady).not.toHaveBeenCalled()
  })
})

describe('AuthProvider wiring', () => {
  const provider = readFileSync('lib/firebase/AuthProvider.tsx', 'utf8')
  const layout = readFileSync('app/layout.tsx', 'utf8')
  const appLayout = readFileSync('landly-mobile/src/app/_layout.tsx', 'utf8')

  it('keeps the timeout and the member hint opt-in', () => {
    expect(provider).toContain('readyTimeoutMs?: number')
    expect(provider).toContain('memberHint = false')
    expect(provider).toContain('if (memberHint) rememberMemberHint(!!nextUser)')
  })

  it('turns both on for the website only', () => {
    expect(layout).toContain('const AUTH_READY_TIMEOUT_MS = 5000')
    expect(layout).toContain('<AuthProvider readyTimeoutMs={AUTH_READY_TIMEOUT_MS} memberHint>')
    expect(appLayout).toMatch(/<AuthProvider>/)
    expect(appLayout).not.toMatch(/readyTimeoutMs|memberHint/)
  })
})
