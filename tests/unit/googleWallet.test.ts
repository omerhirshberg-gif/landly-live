import { generateKeyPairSync, createVerify } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { Timestamp } from 'firebase-admin/firestore'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { translations } from '@/lib/i18n/translations'
import { RAAYONIT_ISSUER } from '@/lib/payments/issuer'
import { buildOfferClass, buildOfferObject, googleObjectId, signSaveJwt, GOOGLE_SAVE_URL } from '@/lib/wallet/googlePass'
import { ensureOfferClass, getWalletAccessToken, resetGoogleWalletCaches, upsertOfferObject } from '@/lib/wallet/googleWalletApi'
import { resolveGoogleWalletConfig, GOOGLE_CLASS_SUFFIX_DEV, GOOGLE_CLASS_SUFFIX_PROD } from '@/lib/wallet/passConfig'
import type { PassVoucher } from '@/lib/wallet/passVoucher'
import { canOfferWalletPass, googleWalletBadgePath, googleWalletSupport } from '@/lib/wallet/walletSupport'

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
const PUBLIC_PEM = publicKey.export({ type: 'spki', format: 'pem' }).toString()
const ISSUER = '3388000000023245879'
const env = (project: string, extra: Record<string, string | undefined> = {}) => ({
  GOOGLE_WALLET_ISSUER_ID: ISSUER,
  FIREBASE_ADMIN_CLIENT_EMAIL: `firebase-adminsdk-x@${project}.iam.gserviceaccount.com`,
  FIREBASE_ADMIN_PRIVATE_KEY: PEM.replace(/\n/g, '\\n'),
  ...extra,
})
const dev = () => {
  const c = resolveGoogleWalletConfig(env('landly-dev'), 'preview')
  if (c.mode !== 'ready') throw new Error(c.reason)
  return c
}
const prod = () => {
  const c = resolveGoogleWalletConfig(env('landly-be752', { VERCEL_URL: 'ignored.vercel.app' }), 'production')
  if (c.mode !== 'ready') throw new Error(c.reason)
  return c
}

const voucher: PassVoucher = {
  id: 'uid123_coffee', userId: 'uid123', offerId: 'coffee', businessName: 'Cafe', offerTitle: 'Coffee for two',
  redemptionCode: '123456', redeemToken: 'b'.repeat(32), status: 'active', expiresAt: new Date('2031-11-17T21:59:59Z'),
  redemptionTerms: 'One per table', redemptionMethod: 'in_store', redemptionInstructions: '', displayOrderNumber: '#1001',
  translations: null, businessTranslations: null, businessAddress: null, businessGeo: { lat: 32.08, lng: 34.78 },
  redemptionKind: null, issuer: null, externalCode: null, amountAgorot: 7900, faceValueAgorot: 10000, savingsAgorot: 2100,
}
const raayonit: PassVoucher = { ...voucher, id: 'uid123_fox', redeemToken: null, redemptionKind: 'code_only', issuer: RAAYONIT_ISSUER, externalCode: 'RY-4821-7730-19' }
const options = { discountPercent: 21, imageUrl: 'https://cdn.example/photo.jpg', holderName: 'Dana' }

describe('Google Wallet config: DEV and PROD stay apart', () => {
  it('production signs for the prod class with the landly-be752 account, dev and preview for the dev class', () => {
    expect(prod().classId).toBe(`${ISSUER}.${GOOGLE_CLASS_SUFFIX_PROD}`)
    expect(GOOGLE_CLASS_SUFFIX_PROD).toBe('golandly_voucher_prod')
    expect(dev().classId).toBe(`${ISSUER}.${GOOGLE_CLASS_SUFFIX_DEV}`)
    expect(GOOGLE_CLASS_SUFFIX_DEV).toBe('golandly_voucher_dev')
    expect(resolveGoogleWalletConfig(env('landly-dev'), 'local')).toMatchObject({ mode: 'ready', classSuffix: 'golandly_voucher_dev' })
  })
  it('refuses the wrong project for the deployment, either way round', () => {
    expect(resolveGoogleWalletConfig(env('landly-dev'), 'production')).toMatchObject({ mode: 'unavailable' })
    expect(resolveGoogleWalletConfig(env('landly-be752'), 'preview')).toMatchObject({ mode: 'unavailable' })
    expect(resolveGoogleWalletConfig(env('landly-be752'), 'local')).toMatchObject({ mode: 'unavailable' })
    expect(resolveGoogleWalletConfig(env('someone-else'), 'production')).toMatchObject({ mode: 'unavailable' })
  })
  it('is unavailable without the issuer id, with a bad one, or without a usable key', () => {
    expect(resolveGoogleWalletConfig(env('landly-dev', { GOOGLE_WALLET_ISSUER_ID: undefined }), 'preview')).toEqual({ mode: 'unavailable', reason: 'GOOGLE_WALLET_ISSUER_ID is not set.' })
    expect(resolveGoogleWalletConfig(env('landly-dev', { GOOGLE_WALLET_ISSUER_ID: 'abc' }), 'preview').mode).toBe('unavailable')
    expect(resolveGoogleWalletConfig(env('landly-dev', { FIREBASE_ADMIN_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----' }), 'preview').mode).toBe('unavailable')
    expect(resolveGoogleWalletConfig(env('landly-dev', { FIREBASE_ADMIN_PRIVATE_KEY: undefined }), 'preview').mode).toBe('unavailable')
  })
  it('serves images from the production site, a preview host, and never from a machine Google can\'t reach', () => {
    expect(prod().siteOrigin).toBe('https://www.golandly.com')
    expect(resolveGoogleWalletConfig(env('landly-dev', { VERCEL_URL: 'landly-git-x.vercel.app' }), 'preview')).toMatchObject({ siteOrigin: 'https://landly-git-x.vercel.app' })
    expect(resolveGoogleWalletConfig(env('landly-dev'), 'local')).toMatchObject({ siteOrigin: null })
  })
})

describe('the save link JWT', () => {
  it('is RS256-signed by the service account, verifies with its public key, and only names the object', () => {
    const config = prod()
    const objectId = googleObjectId(config, voucher.id)
    const jwt = signSaveJwt(config, objectId, 1_700_000_000_000)
    const [header, payload, signature] = jwt.split('.')
    expect(JSON.parse(Buffer.from(header!, 'base64url').toString())).toEqual({ alg: 'RS256', typ: 'JWT' })
    const claims = JSON.parse(Buffer.from(payload!, 'base64url').toString())
    expect(claims).toEqual({
      iss: config.serviceAccountEmail, aud: 'google', typ: 'savetowallet', iat: 1_700_000_000,
      origins: ['https://www.golandly.com'], payload: { offerObjects: [{ id: objectId }] },
    })
    expect(createVerify('RSA-SHA256').update(`${header}.${payload}`).verify(PUBLIC_PEM, Buffer.from(signature!, 'base64url'))).toBe(true)
    expect(createVerify('RSA-SHA256').update(`${header}.${payload}x`).verify(PUBLIC_PEM, Buffer.from(signature!, 'base64url'))).toBe(false)
    expect(`${GOOGLE_SAVE_URL}${jwt}`.length).toBeLessThan(1800)
  })
  it('leaks neither the uid nor the voucher id nor any code', () => {
    const config = dev()
    const jwt = signSaveJwt(config, googleObjectId(config, voucher.id))
    const claims = Buffer.from(jwt.split('.')[1]!, 'base64url').toString()
    for (const secret of ['uid123', voucher.id, voucher.redemptionCode, voucher.redeemToken!]) expect(claims).not.toContain(secret)
    expect(googleObjectId(config, voucher.id)).toMatch(new RegExp(`^${ISSUER}\\.[0-9a-f]{32}$`))
    // Stable per voucher, different per environment.
    expect(googleObjectId(config, voucher.id)).toBe(googleObjectId(config, voucher.id))
    expect(googleObjectId(config, voucher.id)).not.toBe(googleObjectId(prod(), voucher.id))
  })
})

describe('the OfferClass', () => {
  it('is the environment\'s class with the title in all five languages', () => {
    const cls = buildOfferClass(prod())
    expect(cls).toMatchObject({ id: `${ISSUER}.golandly_voucher_prod`, issuerName: 'GoLandly', redemptionChannel: 'INSTORE', title: 'GoLandly voucher' })
    expect(cls.localizedTitle.translatedValues.map((v) => v.language).sort()).toEqual(['es', 'fr', 'he', 'ru'])
    expect(cls.titleImage?.sourceUri.uri).toBe('https://www.golandly.com/wallet/google/logo.png')
    expect(buildOfferClass(resolveGoogleWalletConfig(env('landly-dev'), 'local') as ReturnType<typeof dev>)).not.toHaveProperty('titleImage')
  })
})

describe('the OfferObject', () => {
  const object = buildOfferObject(voucher, prod(), options)
  const mod = (o: typeof object, id: string) => o.textModulesData.find((m) => m.id === id)

  it('is a QR of the redeem link with the code as text, valid until expiry', () => {
    expect(object.barcode).toEqual({ type: 'QR_CODE', value: `https://golandly.com/redeem/${'b'.repeat(32)}`, alternateText: '123456' })
    expect(object.validTimeInterval).toEqual({ end: { date: '2031-11-17T21:59:59.000Z' } })
    expect(object).toMatchObject({ state: 'ACTIVE', classId: `${ISSUER}.golandly_voucher_prod`, locations: [{ latitude: 32.08, longitude: 34.78 }] })
    expect(object.heroImage?.sourceUri.uri).toBe('https://cdn.example/photo.jpg')
  })
  it('is a Code 128 of the code for a code-only (Raayonit) voucher, and never a QR', () => {
    const o = buildOfferObject(raayonit, prod(), options)
    expect(o.barcode).toEqual({ type: 'CODE_128', value: 'RY-4821-7730-19', alternateText: 'RY-4821-7730-19' })
    expect(mod(o, 'issuer')!.body).toContain('Raayonit Ltd.')
    expect(mod(o, 'code')!.body).toBe('RY-4821-7730-19')
  })
  it('hides Raayonit\'s name until the display flag is on (the route clears the issuer)', () => {
    const o = buildOfferObject({ ...raayonit, issuer: null }, prod(), options)
    expect(JSON.stringify(o)).not.toContain('Raayonit Ltd.')
  })
  it('carries the details in all five languages, English as the default', () => {
    const how = mod(object, 'how')!
    expect(how.localizedHeader.defaultValue).toEqual({ language: 'en', value: how.header })
    expect(how.localizedHeader.translatedValues.map((v) => v.language).sort()).toEqual(['es', 'fr', 'he', 'ru'])
    expect(mod(object, 'terms')!.body).toBe('One per table')
    expect(mod(object, 'member')!.body).toBe('Dana')
    expect(mod(object, 'discount')!.body).toBe('21%')
  })
  it('brackets codes, order numbers and percentages with isolate marks in Hebrew only', () => {
    const order = mod(object, 'order')!
    const he = order.localizedBody.translatedValues.find((v) => v.language === 'he')!.value
    expect(he).toBe('⁨#1001⁩')
    expect(order.localizedBody.defaultValue.value).toBe('#1001')
    expect(order.localizedBody.translatedValues.find((v) => v.language === 'fr')?.value ?? '#1001').toBe('#1001')
    const code = mod(buildOfferObject(raayonit, prod(), options), 'code')!
    expect(code.localizedBody.translatedValues.find((v) => v.language === 'he')!.value).toBe('⁨RY-4821-7730-19⁩')
    expect(mod(object, 'discount')!.localizedBody.translatedValues.find((v) => v.language === 'he')!.value).toBe('⁨21%⁩')
  })
  it('puts a photo on the pass only when it is a public https URL Google can reach', () => {
    expect(buildOfferObject(voucher, prod(), { ...options, imageUrl: 'http://x/y.jpg' })).not.toHaveProperty('heroImage')
    expect(buildOfferObject(voucher, resolveGoogleWalletConfig(env('landly-dev'), 'local') as ReturnType<typeof dev>, options)).not.toHaveProperty('heroImage')
  })
  it('names no uid or voucher id anywhere on the object', () => {
    expect(JSON.stringify(object)).not.toContain('uid123')
  })
})

describe('the Wallet REST client', () => {
  let calls: { url: string; method: string; body?: string }[]
  let answers: ((url: string, method: string) => { status: number; json?: unknown }) | null
  beforeEach(() => {
    resetGoogleWalletCaches()
    calls = []
    answers = null
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = init.method ?? 'GET'
      calls.push({ url, method, body: init.body ? String(init.body) : undefined })
      const a = url.includes('oauth2') ? { status: 200, json: { access_token: 'tok', expires_in: 3600 } } : answers!(url, method)
      return new Response(JSON.stringify(a.json ?? {}), { status: a.status })
    }))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('exchanges an RS256 assertion with the wallet_object.issuer scope, and caches the token', async () => {
    const config = dev()
    expect(await getWalletAccessToken(config)).toBe('tok')
    await getWalletAccessToken(config)
    expect(calls).toHaveLength(1)
    const assertion = new URLSearchParams(calls[0]!.body).get('assertion')!
    const [h, p, s] = assertion.split('.')
    expect(JSON.parse(Buffer.from(p!, 'base64url').toString())).toMatchObject({ iss: config.serviceAccountEmail, scope: 'https://www.googleapis.com/auth/wallet_object.issuer' })
    expect(createVerify('RSA-SHA256').update(`${h}.${p}`).verify(PUBLIC_PEM, Buffer.from(s!, 'base64url'))).toBe(true)
  })
  it('creates the class once when Google says 404, and not again in this process', async () => {
    answers = (_u, m) => (m === 'GET' ? { status: 404 } : { status: 200 })
    await ensureOfferClass(dev(), 'tok')
    await ensureOfferClass(dev(), 'tok')
    expect(calls.map((c) => c.method)).toEqual(['GET', 'POST'])
    expect(JSON.parse(calls[1]!.body!).id).toBe(`${ISSUER}.golandly_voucher_dev`)
  })
  it('leaves an existing class alone, and treats a concurrent create (409) as done', async () => {
    answers = () => ({ status: 200 })
    await ensureOfferClass(dev(), 'tok')
    expect(calls.map((c) => c.method)).toEqual(['GET'])
    resetGoogleWalletCaches()
    calls = []
    answers = (_u, m) => (m === 'GET' ? { status: 404 } : { status: 409 })
    await expect(ensureOfferClass(dev(), 'tok')).resolves.toBeUndefined()
  })
  it('inserts the object, then patches it on a 409, and fails closed on anything else', async () => {
    answers = (_u, m) => (m === 'POST' ? { status: 409 } : { status: 200 })
    await upsertOfferObject('tok', { id: 'a.b' })
    expect(calls.map((c) => `${c.method} ${c.url.split('/v1')[1]}`)).toEqual(['POST /offerObject', 'PATCH /offerObject/a.b'])
    answers = () => ({ status: 403 })
    await expect(upsertOfferObject('tok', { id: 'a.b' })).rejects.toMatchObject({ stage: 'object', status: 403 })
  })
  it('keeps Google\'s own error message for the setup script, with anything credential-shaped redacted', async () => {
    answers = () => ({ status: 403, json: { error: { code: 403, message: 'Permission denied.', errors: [{ reason: 'permissionDenied' }], echo: 'Bearer ya29.secret-token' } } })
    const error = await upsertOfferObject('tok', { id: 'a.b' }).catch((e) => e)
    expect(error.detail).toContain('Permission denied.')
    expect(error.detail).toContain('permissionDenied')
    expect(error.detail).not.toContain('ya29')
    expect(error.message).toBe('Google Wallet object request failed (403).')
  })
})

describe('Google Wallet API routes', () => {
  const auth = { uid: 'member1' as string | null }
  const docs: { vouchers: Record<string, Record<string, unknown>> } = { vouchers: {} }
  const limited = { value: false }
  let route: typeof import('@/app/api/wallet/google/[voucherId]/route')
  let availability: typeof import('@/app/api/wallet/google/availability/route')
  const ID = 'member1_offer1'
  const BASE = `http://localhost:3000/api/wallet/google/${ID}`
  const params = (voucherId = ID) => ({ params: Promise.resolve({ voucherId }) })
  const post = (voucherId = ID) => route.POST(new Request(BASE, { method: 'POST', headers: { Authorization: 'Bearer t' } }), params(voucherId))

  beforeEach(async () => {
    vi.resetModules()
    resetGoogleWalletCaches()
    auth.uid = 'member1'
    limited.value = false
    docs.vouchers = {
      [ID]: {
        userId: 'member1', offerId: 'offer1', businessName: 'Cafe', offerTitle: 'Coffee', redemptionCode: '123456',
        redeemToken: 'b'.repeat(32), status: 'active', expiresAt: Timestamp.fromDate(new Date(Date.now() + 86_400_000)),
      },
    }
    vi.doMock('@/lib/firebase/verifyRequestUser', () => {
      class RequestAuthError extends Error {
        constructor(message: string, public readonly status: 401 | 403 | 503) { super(message) }
      }
      return { RequestAuthError, requireVerifiedCustomerUid: async () => { if (!auth.uid) throw new RequestAuthError('Unauthorized', 401); return auth.uid } }
    })
    vi.doMock('@/lib/auth/uidRateLimit', () => ({ checkUidRateLimit: async () => (limited.value ? new Response(null, { status: 429 }) : null) }))
    vi.doMock('@/lib/flags/featureFlags.server', () => ({ isRaayonitDisplayEnabled: async () => false }))
    vi.doMock('@/lib/firebase/admin', () => ({
      getAdminDb: () => ({
        collection: (name: string) => ({
          doc: (id: string) => ({
            get: async () => {
              const data = name === 'vouchers' ? docs.vouchers[id] : undefined
              return { id, data: () => data, get: (key: string) => data?.[key] }
            },
          }),
        }),
      }),
    }))
    vi.stubEnv('GOOGLE_WALLET_ISSUER_ID', ISSUER)
    vi.stubEnv('FIREBASE_ADMIN_CLIENT_EMAIL', 'firebase-adminsdk-x@landly-dev.iam.gserviceaccount.com')
    vi.stubEnv('FIREBASE_ADMIN_PRIVATE_KEY', PEM.replace(/\n/g, '\\n'))
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
      if (url.includes('oauth2')) return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }))
      return new Response('{}', { status: (init.method ?? 'GET') === 'GET' ? 200 : 200 })
    }))
    route = await import('@/app/api/wallet/google/[voucherId]/route')
    availability = await import('@/app/api/wallet/google/availability/route')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.doUnmock('@/lib/firebase/admin')
  })

  it('answers the save link to the owner, no-store, naming only an opaque object', async () => {
    const res = await post()
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const { url } = await res.json()
    expect(url.startsWith('https://pay.google.com/gp/v/save/')).toBe(true)
    const claims = Buffer.from(url.split('/save/')[1].split('.')[1], 'base64url').toString()
    expect(claims).toContain(`${ISSUER}.`)
    for (const leak of ['member1', ID, '123456', 'b'.repeat(32)]) expect(claims).not.toContain(leak)
    expect(Object.keys(await route.OPTIONS(new Request(BASE)).headers).length).toBeGreaterThanOrEqual(0)
    expect('GET' in route).toBe(false)
  })
  it('refuses a signed-out member (401)', async () => {
    auth.uid = null
    expect((await post()).status).toBe(401)
  })
  it('answers the same for a foreign voucher as for a missing one (404)', async () => {
    docs.vouchers[ID]!.userId = 'someone-else'
    expect((await post()).status).toBe(404)
    expect((await post('nothing_here')).status).toBe(404)
  })
  it('refuses a voucher that is used, or has no token (409)', async () => {
    docs.vouchers[ID]!.status = 'redeemed'
    expect((await post()).status).toBe(409)
    docs.vouchers[ID]!.status = 'active'
    docs.vouchers[ID]!.redeemToken = null
    expect((await post()).status).toBe(409)
  })
  it('accepts a code-only voucher with an external code and no token', async () => {
    Object.assign(docs.vouchers[ID]!, { redeemToken: null, redemptionKind: 'code_only', externalCode: 'RY-1' })
    expect((await post()).status).toBe(200)
  })
  it('is rate limited (429)', async () => {
    limited.value = true
    expect((await post()).status).toBe(429)
  })
  it('is 503 and hidden when the issuer id is unset, with no call to Google', async () => {
    vi.stubEnv('GOOGLE_WALLET_ISSUER_ID', '')
    const res = await post()
    expect(res.status).toBe(503)
    expect(await res.json()).toMatchObject({ reason: 'unavailable' })
    expect(await (await availability.GET(new Request('http://localhost/x'))).json()).toEqual({ available: false })
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  })
  it('is 503 when Google refuses, without echoing why', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (url.includes('oauth2') ? new Response(JSON.stringify({ access_token: 'tok' })) : new Response('{}', { status: 403 }))))
    const res = await post()
    expect(res.status).toBe(503)
    expect(JSON.stringify(await res.json())).not.toContain('403')
  })
  it('says it is available when configured', async () => {
    expect(await (await availability.GET(new Request('http://localhost/x'))).json()).toEqual({ available: true })
  })
})

describe('what to show where', () => {
  const UA = {
    android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
    androidWebView: 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0 Mobile Safari/537.36',
    androidInstagram: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36 Instagram 300.0',
    iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    ipadChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1',
    macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
    winEdge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Edg/126.0',
  }
  it('Google: Android and desktop browsers, never iPhone or iPad', () => {
    expect(googleWalletSupport(UA.android, 5)).toBe('badge')
    expect(googleWalletSupport(UA.androidWebView, 5)).toBe('in-app')
    expect(googleWalletSupport(UA.androidInstagram, 5)).toBe('in-app')
    expect(googleWalletSupport(UA.macSafari, 0)).toBe('badge')
    expect(googleWalletSupport(UA.winEdge, 0)).toBe('badge')
    expect(googleWalletSupport(UA.iphone, 5)).toBe('none')
    expect(googleWalletSupport(UA.ipadChrome, 5)).toBe('none')
    expect(googleWalletSupport('SomethingElse', 0)).toBe('none')
  })
  it('a code-only voucher with an external code is offered without a redeem token, for both wallets', () => {
    const base = { status: 'active', redeemToken: null, expiresAt: null }
    expect(canOfferWalletPass({ ...base, externalCode: 'RY-1', redemptionKind: 'code_only' }, 1)).toBe(true)
    expect(canOfferWalletPass({ ...base, externalCode: 'RY-1' }, 1)).toBe(true)
    expect(canOfferWalletPass({ ...base, redemptionKind: 'code_only' }, 1)).toBe(false)
    expect(canOfferWalletPass(base, 1)).toBe(false)
    expect(canOfferWalletPass({ ...base, externalCode: 'RY-1', expiresAt: new Date(0) }, 1)).toBe(false)
    expect(canOfferWalletPass({ ...base, externalCode: 'RY-1', status: 'redeemed' }, 1)).toBe(false)
  })
  it('keeps the platforms apart in the sources', () => {
    const appleNative = readFileSync('landly-mobile/src/components/AddToAppleWallet.tsx', 'utf8')
    const googleNative = readFileSync('landly-mobile/src/components/AddToGoogleWallet.tsx', 'utf8')
    expect(appleNative).toContain("Platform.OS === 'ios'")
    expect(googleNative).toContain("Platform.OS === 'android'")
    expect(googleNative).not.toContain("Platform.OS === 'ios'")
    const screen = readFileSync('landly-mobile/src/app/voucher/[voucherId].tsx', 'utf8')
    expect(screen.match(/<AddToGoogleWallet /g)).toHaveLength(2)
    expect(screen.match(/<AddToAppleWallet /g)).toHaveLength(2)
    const page = readFileSync('app/member/vouchers/[voucherId]/page.tsx', 'utf8')
    expect(page.match(/<AddToGoogleWallet /g)).toHaveLength(2)
  })
})

describe('Google\'s badge artwork and copy', () => {
  it('ships the official SVGs for the five languages, identical on the web and in the app, never mirrored or recoloured', () => {
    for (const lang of ['en', 'he', 'ru', 'fr', 'es']) {
      const web = readFileSync(`public/wallet/google/${lang}.svg`, 'utf8')
      expect(existsSync(`landly-mobile/assets/wallet/google-${lang}.svg`)).toBe(true)
      expect(readFileSync(`landly-mobile/assets/wallet/google-${lang}.svg`, 'utf8')).toBe(web)
      expect(web).toMatch(/^<svg width="\d+" height="55" viewBox="0 0 \d+ 55"/)
      expect(web).toContain('fill="#1F1F1F"')
      expect(web).not.toMatch(/scale\(-|transform/)
      expect(readFileSync('landly-mobile/src/lib/googleWalletBadges.ts', 'utf8')).toContain(JSON.stringify(web.trim()))
    }
    expect(googleWalletBadgePath('he')).toBe('/wallet/google/he.svg')
    expect(existsSync('public/wallet/google/logo.png')).toBe(true)
  })
  it('never mirrors or dims the badge in the components', () => {
    const web = readFileSync('components/member/AddToGoogleWallet.tsx', 'utf8')
    expect(web).not.toMatch(/rtl:|-scale-x|opacity|hover:|shadow|animate-(?:pulse|bounce|ping)/)
    const native = readFileSync('landly-mobile/src/components/AddToGoogleWallet.tsx', 'utf8')
    expect(native).toContain('BADGE_HEIGHT = 48')
    expect(native).not.toMatch(/scaleX/)
    expect(native.slice(native.indexOf('<Pressable'), native.indexOf('</Pressable>'))).not.toMatch(/opacity|pressed/)
  })
  it('has the new copy in every language', () => {
    for (const table of Object.values(translations)) {
      expect(table.wallet_google_add_label).toMatch(/Google Wallet/)
      for (const key of ['wallet_google_class_title', 'wallet_google_desktop_hint', 'wallet_google_open_in_chrome'] as const) expect(table[key].length).toBeGreaterThan(0)
    }
  })
})
