import { generateKeyPairSync, verify } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  appleClientSecret,
  appleKeyCheckAuthorizeUrl,
  appleKeyProblems,
  classifyAppleTokenAnswer,
  classifyNativeAudience,
  classifyTokenExchange,
  EXPECTED_APPLE_TEAM_ID,
  NATIVE_APPLE_AUDIENCE,
  parseKeyCheckReturn,
} from '../../scripts/lib/appleOAuth.mjs'

// Recorded accounts:signInWithIdp answers to an unsigned Apple identity token
// addressed to the app's bundle ID (scripts/check-apple-oauth.mjs).
describe('native Apple token audience', () => {
  it('is the app bundle ID', () => {
    expect(NATIVE_APPLE_AUDIENCE).toBe('com.amitbd.landlyapp')
  })

  it('passes once Firebase gets as far as the nonce', () => {
    expect(classifyNativeAudience('MISSING_OR_INVALID_NONCE : Duplicate credential received. Please try again with a new credential.')).toEqual({
      status: 'native-ok',
      audience: null,
      expectedAudience: null,
    })
  })

  it('names the audience each project expected instead', () => {
    for (const expected of ['com.amitbd.landlyapp.web.dev', 'com.amitbd.landlyapp.web']) {
      expect(
        classifyNativeAudience(
          `INVALID_IDP_RESPONSE : The audience in ID Token [com.amitbd.landlyapp] does not match the expected audience ${expected}.`,
        ),
      ).toEqual({ status: 'aud-mismatch', audience: 'com.amitbd.landlyapp', expectedAudience: expected })
    }
  })

  it('reports anything else as unknown', () => {
    for (const message of ['INVALID_IDP_RESPONSE : Signature verification failed', 'HTTP 500', '', null, undefined]) {
      expect(classifyNativeAudience(message).status).toBe('unknown')
    }
  })
})

// npm run check:apple-key: the client secret Firebase signs for Apple, signed
// here from a local copy of the key (a throwaway one in these tests).
describe('Sign in with Apple key check', () => {
  const ec = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const pem = ec.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
  const KEY_ID = 'ABCDE12345'

  it('signs the ES256 client secret Apple expects', () => {
    const secret = appleClientSecret({ teamId: EXPECTED_APPLE_TEAM_ID, keyId: KEY_ID, clientId: 'com.amitbd.landlyapp.web', privateKeyPem: pem, now: 1_800_000_000 })
    const [header, payload, signature] = secret.split('.')
    expect(JSON.parse(Buffer.from(header, 'base64url').toString())).toEqual({ alg: 'ES256', kid: KEY_ID })
    expect(JSON.parse(Buffer.from(payload, 'base64url').toString())).toEqual({
      iss: 'Q9PZPLU6GY',
      iat: 1_800_000_000,
      exp: 1_800_000_300,
      aud: 'https://appleid.apple.com',
      sub: 'com.amitbd.landlyapp.web',
    })
    // Raw r||s (64 bytes), as JWS requires, and valid for the key's public half.
    const sig = Buffer.from(signature, 'base64url')
    expect(sig).toHaveLength(64)
    expect(verify('sha256', Buffer.from(`${header}.${payload}`), { key: ec.publicKey, dsaEncoding: 'ieee-p1363' }, sig)).toBe(true)
  })

  it('names a key problem before asking Apple', () => {
    const ok = { teamId: EXPECTED_APPLE_TEAM_ID, keyId: KEY_ID, privateKeyPem: pem, fileName: `AuthKey_${KEY_ID}.p8` }
    expect(appleKeyProblems(ok)).toEqual([])
    expect(appleKeyProblems({ ...ok, fileName: 'AuthKey_ZZZZZ99999.p8' })[0]).toMatch(/AuthKey_ZZZZZ99999\.p8 but the Key ID is ABCDE12345/)
    expect(appleKeyProblems({ ...ok, teamId: 'ABCDEFGHIJ' })[0]).toMatch(/not Landly's \(Q9PZPLU6GY\)/)
    expect(appleKeyProblems({ ...ok, keyId: 'short' })[0]).toMatch(/Key ID "short"/)
    expect(appleKeyProblems({ ...ok, privateKeyPem: 'not a key' })).toEqual(['the .p8 is not a readable private key'])
    const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    expect(appleKeyProblems({ ...ok, privateKeyPem: rsa })).toEqual(['the .p8 is not an EC P-256 key'])
  })

  it('sends the browser to a Return URL each Services ID already lists, with the code in the address', () => {
    const prod = new URL(appleKeyCheckAuthorizeUrl('landly-be752'))
    expect(prod.origin + prod.pathname).toBe('https://appleid.apple.com/auth/authorize')
    expect(Object.fromEntries(prod.searchParams)).toEqual({
      response_type: 'code',
      // Query mode, so no scopes: Apple refuses it with name or email.
      response_mode: 'query',
      client_id: 'com.amitbd.landlyapp.web',
      redirect_uri: 'https://www.golandly.com/__/auth/handler',
      state: 'landly-key-check',
    })
    expect(new URL(appleKeyCheckAuthorizeUrl('landly-dev')).searchParams.get('client_id')).toBe('com.amitbd.landlyapp.web.dev')
  })

  it('reads the code back from the address Apple sent the browser to', () => {
    expect(parseKeyCheckReturn(' https://www.golandly.com/__/auth/handler?state=landly-key-check&code=c0ffee.0.abcd.XYZ \n')).toEqual({
      projectId: 'landly-be752',
      clientId: 'com.amitbd.landlyapp.web',
      redirectUri: 'https://www.golandly.com/__/auth/handler',
      code: 'c0ffee.0.abcd.XYZ',
    })
    expect(parseKeyCheckReturn('https://landly-dev.firebaseapp.com/__/auth/handler?code=c1&state=landly-key-check')?.clientId).toBe('com.amitbd.landlyapp.web.dev')
    for (const address of [
      'https://www.golandly.com/__/auth/handler?code=c1',
      'https://www.golandly.com/__/auth/handler?code=c1&state=other',
      'https://evil.example/__/auth/handler?code=c1&state=landly-key-check',
      'https://www.golandly.com/__/auth/handler?state=landly-key-check',
      'not a url',
      undefined,
    ]) expect(parseKeyCheckReturn(address), String(address)).toBeNull()
  })

  it("reads Apple's answer to the real code", () => {
    expect(classifyAppleTokenAnswer(200, { id_token: 'x', refresh_token: 'y' })).toBe('key-ok')
    expect(classifyAppleTokenAnswer(400, { error: 'invalid_client' })).toBe('bad-key')
    expect(classifyAppleTokenAnswer(400, { error: 'invalid_grant', error_description: 'The code has expired or has been revoked.' })).toBe('code-spent')
    for (const [status, json] of [[400, { error: 'invalid_request' }], [200, {}], [500, null]] as const) expect(classifyAppleTokenAnswer(status, json)).toBe('unknown')
  })

  // Recorded 2026-10-29: with a made-up code Apple answers invalid_grant even
  // to a client secret signed by a throwaway key, so check:apple's probe can
  // only show that Firebase sends a secret.
  it("never reads check:apple's made-up-code probe as proof of the key", () => {
    const firebaseSaid = (error: string) => `INVALID_IDP_RESPONSE : ... OAuth2TokenResponse{params: error=${error}&error_description=x}`
    expect(classifyTokenExchange(firebaseSaid('invalid_grant'))).toBe('sent')
    expect(classifyTokenExchange(firebaseSaid('invalid_client'))).toBe('no-key')
  })
})
