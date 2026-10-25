import { describe, expect, it, vi } from 'vitest'
import { MEMBER_HINT_CLASS, MEMBER_HINT_KEY, MEMBER_HINT_SCRIPT, rememberMemberHint } from '@/lib/auth/memberHint'

// The <head> script runs before React, with nothing but the browser's
// globals; here it runs against stand-ins for them.
function runHeadScript(storage: { getItem: (key: string) => string | null }) {
  const classes = new Set<string>()
  const document = { documentElement: { classList: { add: (name: string) => classes.add(name) } } }
  new Function('localStorage', 'document', MEMBER_HINT_SCRIPT)(storage, document)
  return classes
}

describe('member hint <head> script', () => {
  it('marks <html> for a browser that had a member last time', () => {
    expect(runHeadScript({ getItem: (key) => (key === MEMBER_HINT_KEY ? '1' : null) })).toEqual(new Set([MEMBER_HINT_CLASS]))
  })

  it('leaves a guest (no flag, or any other value) on the landing', () => {
    expect(runHeadScript({ getItem: () => null }).size).toBe(0)
    expect(runHeadScript({ getItem: () => 'true' }).size).toBe(0)
  })

  it('never throws when storage is blocked (Safari private mode, disabled site data)', () => {
    expect(() => runHeadScript({ getItem: () => { throw new Error('SecurityError') } })).not.toThrow()
  })

  it('is a small, self-contained statement with no imports or modern syntax', () => {
    expect(MEMBER_HINT_SCRIPT.length).toBeLessThan(200)
    expect(MEMBER_HINT_SCRIPT).not.toMatch(/=>|\bimport\b|\bconst\b|\blet\b|\?\./)
  })
})

describe('rememberMemberHint', () => {
  const store = () => ({ setItem: vi.fn(), removeItem: vi.fn() })

  it('sets the flag for a signed-in member and clears it for a guest', () => {
    const s = store()
    rememberMemberHint(true, () => s)
    expect(s.setItem).toHaveBeenCalledWith(MEMBER_HINT_KEY, '1')
    rememberMemberHint(false, () => s)
    expect(s.removeItem).toHaveBeenCalledWith(MEMBER_HINT_KEY)
  })

  it('does nothing without storage, and swallows storage errors', () => {
    expect(() => rememberMemberHint(true, () => null)).not.toThrow()
    expect(() => rememberMemberHint(true, () => { throw new Error('denied') })).not.toThrow()
    const failing = { setItem: () => { throw new Error('QuotaExceededError') }, removeItem: vi.fn() }
    expect(() => rememberMemberHint(true, () => failing)).not.toThrow()
  })

  it('is a no-op on the server, where there is no window', () => {
    expect(() => rememberMemberHint(true)).not.toThrow()
  })
})
