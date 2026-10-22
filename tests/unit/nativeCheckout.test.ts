import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { translations } from '@/lib/i18n/translations'

const mocks = vi.hoisted(() => {
  class MockRequestAuthError extends Error { status: 401 | 403 | 503; constructor(message: string, status: 401 | 403 | 503) { super(message); this.status = status } }
  return { getDb: vi.fn(), verifiedUid: vi.fn(), MockRequestAuthError }
})
vi.mock('@/lib/firebase/admin', () => ({ getAdminDb: mocks.getDb }))
vi.mock('@/lib/firebase/verifyRequestUser', () => ({ requireVerifiedCustomerUid: mocks.verifiedUid, RequestAuthError: mocks.MockRequestAuthError }))
import { OPTIONS as initiatePreflight, POST as initiate } from '@/app/api/payments/initiate/route'
import { OPTIONS as sandboxPreflight } from '@/app/api/payments/dev-sandbox/route'
import { CHECKOUT_TIMEOUT_MS, initiateCheckout, settleSandboxOrder } from '@/lib/payments/checkoutClient'

const LANGS = ['en', 'he', 'ru', 'es', 'fr'] as const
const read = (path: string) => readFileSync(`landly-mobile/src/${path}`, 'utf8')
const BASE = 'http://192.168.1.5:3000'

const fetchMock = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

const respond = (status: number, body: unknown, url = `${BASE}/api/payments/initiate`) => {
  const res = new Response(JSON.stringify(body), { status })
  Object.defineProperty(res, 'url', { value: url })
  fetchMock.mockResolvedValueOnce(res)
}

describe('checkout client', () => {
  it('posts the offer with the bearer token, and acceptTerms only from Pay', async () => {
    respond(200, { orderId: 'u_o', sandbox: true })
    const result = await initiateCheckout('tok', 'o', { acceptTerms: true }, `${BASE}/`)
    expect(result).toEqual({ ok: true, data: { orderId: 'u_o', sandbox: true } })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${BASE}/api/payments/initiate`)
    expect(init.headers.Authorization).toBe('Bearer tok')
    expect(init.redirect).toBe('manual')
    expect(JSON.parse(init.body)).toEqual({ offerId: 'o', acceptTerms: true })

    respond(200, { orderId: 'u_o' })
    await initiateCheckout('tok', 'o', {}, BASE)
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ offerId: 'o' })
  })

  it('settles a sandbox order with the chosen outcome', async () => {
    respond(200, { orderId: 'u_o' }, `${BASE}/api/payments/dev-sandbox`)
    expect(await settleSandboxOrder('tok', 'u_o', 'approve', BASE)).toEqual({ ok: true, data: { orderId: 'u_o' } })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${BASE}/api/payments/dev-sandbox`)
    expect(JSON.parse(init.body)).toEqual({ orderId: 'u_o', outcome: 'approve' })
  })

  it.each([
    [401, 'unauthorized'],
    [403, 'unauthorized'],
    [409, 'conflict'],
    [429, 'rateLimited'],
    [503, 'failed'],
  ])('maps HTTP %i to %s, keeping the server message', async (status, reason) => {
    respond(status, { error: 'nope' })
    expect(await initiateCheckout('tok', 'o', {}, BASE)).toEqual({ ok: false, reason, message: 'nope' })
  })

  it('reports a redirect as failed and a network error as offline', async () => {
    respond(200, { orderId: 'x' }, 'https://elsewhere.test/api/payments/initiate')
    expect(await initiateCheckout('tok', 'o', {}, BASE)).toMatchObject({ ok: false, reason: 'failed' })
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'))
    expect(await initiateCheckout('tok', 'o', {}, BASE)).toMatchObject({ ok: false, reason: 'offline' })
  })

  it('aborts after the timeout and reports offline', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementationOnce((_url: string, init: RequestInit) => new Promise((_, reject) => {
      init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    }))
    const pending = initiateCheckout('tok', 'o', {}, BASE)
    await vi.advanceTimersByTimeAsync(CHECKOUT_TIMEOUT_MS)
    expect(await pending).toMatchObject({ ok: false, reason: 'offline' })
  })
})

describe('payment routes: CORS for the Expo web build', () => {
  const origin = 'http://localhost:8081'

  it('answers the initiate preflight and stamps its responses for an allowed origin', async () => {
    const pre = initiatePreflight(new Request('https://landly.test/api/payments/initiate', { method: 'OPTIONS', headers: { Origin: origin } }))
    expect(pre.status).toBe(204)
    expect(pre.headers.get('Access-Control-Allow-Origin')).toBe(origin)
    expect(pre.headers.get('Access-Control-Allow-Headers')).toContain('Authorization')

    mocks.verifiedUid.mockRejectedValueOnce(new mocks.MockRequestAuthError('Unauthorized', 401))
    const res = await initiate(new Request('https://landly.test/api/payments/initiate', { method: 'POST', headers: { Origin: origin }, body: '{}' }))
    expect(res.status).toBe(401)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(origin)
  })

  it('grants nothing to an unknown origin', () => {
    const pre = initiatePreflight(new Request('https://landly.test/api/payments/initiate', { method: 'OPTIONS', headers: { Origin: 'https://evil.test' } }))
    expect(pre.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  it('keeps the sandbox route nonexistent outside local development, preflight included', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const pre = sandboxPreflight(new Request('https://landly.test/api/payments/dev-sandbox', { method: 'OPTIONS', headers: { Origin: origin } }))
    expect(pre.status).toBe(404)
    expect(pre.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })
})

describe('native checkout screen', () => {
  it('opens checkout from the offer screen inside the app, never a browser', () => {
    const offer = read('app/offer/[offerId].tsx')
    expect(offer).not.toMatch(/WebBrowser|openBrowserAsync|Linking/)
    expect(offer).toContain("router.push({ pathname: '/checkout/[offerId]', params: { offerId: offer.id } })")
    expect(read('app/_layout.tsx')).toContain('<Stack.Screen name="checkout/[offerId]" options={pageFlipOptions(isRtl)} />')
  })

  it('holds the screen while paying and replaces it with the order confirmation on success', () => {
    const screen = read('app/checkout/[offerId].tsx')
    expect(screen).not.toMatch(/WebBrowser|openBrowserAsync|Linking/)
    expect(screen).toContain('<Stack.Screen options={{ gestureEnabled: !paying }} />')
    expect(screen).toContain("BackHandler.addEventListener('hardwareBackPress'")
    expect(screen).toContain("router.replace({ pathname: '/order-success/[orderId]', params: { orderId } })")
    expect(screen).toContain('useSafeAreaInsets()')
    expect(screen).toContain("t('checkout_agree')")
  })

  it('has the new strings in all five languages', () => {
    for (const lang of LANGS) for (const key of ['checkout_processing', 'checkout_error_unavailable'] as const) expect(translations[lang][key], `${lang}.${key}`).toBeTruthy()
  })
})

describe('category badge in filtered views', () => {
  it('is hidden on cards in a single-category list, on the app and the website', () => {
    expect(read('app/category/[category].tsx')).toContain('showCategoryBadge={false}')
    expect(read('app/(tabs)/perks.tsx')).toContain("showCategoryBadge={category === 'all'}")
    expect(readFileSync('app/categories/page.tsx', 'utf8')).toContain("showCategoryBadge={category === 'all'}")
  })
})

describe('swipe back from the Perks tab', () => {
  it('pushes a tile as the category screen, like Home, instead of filtering in place', () => {
    const perks = read('app/(tabs)/perks.tsx')
    expect(perks).toContain("router.push({ pathname: '/category/[category]', params: { category: next } })")
    expect(perks.match(/onSelect={openCategory}/g)).toHaveLength(2)
    expect(perks).not.toContain('onSelect={(next) => setCategory(')
    expect(read('app/(tabs)/index.tsx')).toContain("router.push({ pathname: '/category/[category]', params: { category } })")
  })

  it('gives every screen Perks opens the full-screen page-flip swipe', () => {
    const layout = read('app/_layout.tsx')
    // The wishlist is a tab of its own now, so it has no page flip.
    expect(layout).not.toContain('<Stack.Screen name="wishlist"')
    for (const screen of ['category/[category]', 'offer/[offerId]', 'checkout/[offerId]', 'order-success/[orderId]']) {
      expect(layout).toContain(`<Stack.Screen name="${screen}" options={pageFlipOptions(isRtl)} />`)
    }
    const pageFlip = read('lib/pageFlip.ts')
    expect(pageFlip).toContain('gestureEnabled: true')
    expect(pageFlip).toContain('fullScreenGestureEnabled: true')
    // Checkout holds the swipe only while a payment is in flight.
    expect(read('app/checkout/[offerId].tsx')).toContain('<Stack.Screen options={{ gestureEnabled: !paying }} />')
  })
})
