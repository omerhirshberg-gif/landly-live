import { describe, expect, it } from 'vitest'
import { classifyNativeAudience, NATIVE_APPLE_AUDIENCE } from '../../scripts/lib/appleOAuth.mjs'

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
