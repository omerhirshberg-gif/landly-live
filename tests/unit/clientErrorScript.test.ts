import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { CLIENT_ERROR_SCRIPT, CLIENT_ERRORS_KEY, DEBUG_BAR_ID, HYDRATED_ATTRIBUTE, MAX_CLIENT_ERRORS } from '@/lib/debug/clientErrorScript'

const read = (path: string) => readFileSync(path, 'utf8')

type Listener = (event: Record<string, unknown>) => void

// The <head> script runs before React, with nothing but the browser's
// globals; here it runs against stand-ins for them.
function runScript({ search = '', storage, hydrated = false }: { search?: string; storage?: { setItem: (k: string, v: string) => void }; hydrated?: boolean } = {}) {
  const listeners: Record<string, Listener> = {}
  const saved: Record<string, string> = {}
  const attributes: Record<string, string> = hydrated ? { [HYDRATED_ATTRIBUTE]: 'true' } : {}
  const appended: { id?: string; textContent?: string; style: { cssText?: string; background?: string }; setAttribute: () => void }[] = []
  const win = {
    location: { search, pathname: '/' },
    sessionStorage: storage ?? { setItem: (k: string, v: string) => { saved[k] = v } },
    addEventListener: (type: string, fn: Listener) => { listeners[type] = fn },
    setTimeout: () => 0,
  } as Record<string, unknown>
  const doc = {
    readyState: 'complete',
    documentElement: { getAttribute: (name: string) => attributes[name] ?? null },
    body: { appendChild: (el: (typeof appended)[number]) => appended.push(el) },
    createElement: () => ({ style: {}, setAttribute: () => {} }),
  }
  new Function('window', 'document', CLIENT_ERROR_SCRIPT)(win, doc)
  return { win, listeners, saved, appended, attributes }
}

describe('client error <head> script', () => {
  it('records uncaught errors with where they happened, in window.__landlyErrors and sessionStorage', () => {
    const { win, listeners, saved } = runScript()
    listeners.error({ target: win, message: 'SyntaxError: Unexpected token', filename: '/_next/static/chunks/a.js', lineno: 1, colno: 42 })
    const errors = win.__landlyErrors as { type: string; message: string; source: string }[]
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({ type: 'error', message: 'SyntaxError: Unexpected token', source: '/_next/static/chunks/a.js:1:42' })
    expect(JSON.parse(saved[CLIENT_ERRORS_KEY])).toHaveLength(1)
  })

  it('records scripts that fail to load and unhandled rejections', () => {
    const { win, listeners } = runScript()
    listeners.error({ target: { tagName: 'SCRIPT', src: '/_next/static/chunks/b.js' } })
    listeners.unhandledrejection({ reason: new Error('auth/network-request-failed') })
    const errors = win.__landlyErrors as { type: string; message: string; source: string }[]
    expect(errors.map((e) => e.type)).toEqual(['resource', 'unhandledrejection'])
    expect(errors[0]).toMatchObject({ message: 'Failed to load script', source: '/_next/static/chunks/b.js' })
    expect(errors[1].message).toContain('auth/network-request-failed')
  })

  it('keeps only the latest errors', () => {
    const { win, listeners } = runScript()
    for (let i = 0; i < MAX_CLIENT_ERRORS + 5; i++) listeners.error({ target: win, message: `e${i}` })
    const errors = win.__landlyErrors as { message: string }[]
    expect(errors).toHaveLength(MAX_CLIENT_ERRORS)
    expect(errors.at(-1)?.message).toBe(`e${MAX_CLIENT_ERRORS + 4}`)
  })

  it('never throws, even when storage is blocked', () => {
    const blocked = { setItem: () => { throw new Error('QuotaExceededError') } }
    expect(() => {
      const { win, listeners } = runScript({ storage: blocked })
      listeners.error({ target: win, message: 'boom' })
      listeners.unhandledrejection({ reason: undefined })
    }).not.toThrow()
    expect(() => new Function('window', 'document', CLIENT_ERROR_SCRIPT)(undefined, undefined)).not.toThrow()
  })

  it('shows the status bar only with ?debug=1, and it never takes taps', () => {
    expect(runScript().appended).toHaveLength(0)
    const { appended, listeners, win } = runScript({ search: '?debug=1' })
    expect(appended).toHaveLength(1)
    expect(appended[0].id).toBe(DEBUG_BAR_ID)
    expect(appended[0].style.cssText).toContain('pointer-events:none')
    expect(appended[0].textContent).toContain('hydrated: no')
    listeners.error({ target: win, message: 'boom' })
    expect(appended[0].textContent).toContain('errors: 1')
    expect(runScript({ search: '?debug=1', hydrated: true }).appended[0].textContent).toContain('hydrated: yes')
  })

  it('is plain ES5, so it runs on any WebKit even when the bundle cannot', () => {
    expect(CLIENT_ERROR_SCRIPT).not.toMatch(/=>|\bimport\b|\bconst\b|\blet\b|\?\.|\?\?|`|\bclass\b/)
    expect(CLIENT_ERROR_SCRIPT).not.toContain('</script')
  })
})

describe('the root layout', () => {
  const layout = read('app/layout.tsx')

  it('runs the error script first in <head>, before any other script', () => {
    const head = layout.slice(layout.indexOf('<head>'), layout.indexOf('</head>'))
    const scripts = [...head.matchAll(/__html: (\w+)/g)].map((m) => m[1])
    expect(scripts[0]).toBe('CLIENT_ERROR_SCRIPT')
    expect(scripts).toContain('MEMBER_HINT_SCRIPT')
  })

  it('marks <html> once React runs', () => {
    expect(layout).toContain('<HydrationMarker />')
    expect(read('components/layout/HydrationMarker.tsx')).toContain('document.documentElement.setAttribute(HYDRATED_ATTRIBUTE, \'true\')')
  })
})

describe('build targets', () => {
  it('compiles for iOS/Safari 15, below Next.js 16’s default of Safari 16.4', () => {
    const pkg = JSON.parse(read('package.json')) as { browserslist?: string[] }
    expect(pkg.browserslist).toEqual(expect.arrayContaining(['ios_saf >= 15', 'safari >= 15']))
  })
})
