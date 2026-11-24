import { describe, expect, it } from 'vitest'
import { FirebaseError } from 'firebase/app'
import { formatGoogleBuildInfo, googleBuildInfoOf, googleClientHintOf, maskGoogleClientId, withGoogleClientHint } from '../../lib/auth/googleClientHint'
import { describeAuthError } from '../../lib/firebase/authErrors'

const IOS = '840081012057-15s0b8b1ocv1uuv1n9t78k29tdk0b3l6.apps.googleusercontent.com'
const WEB = '840081012057-g74k9lcrema2t6nescpgoooq2kfou6i9.apps.googleusercontent.com'

describe('maskGoogleClientId', () => {
  it('keeps the project-number prefix and the last four characters', () => {
    expect(maskGoogleClientId(IOS)).toBe('8400...b3l6')
    expect(maskGoogleClientId(WEB)).toBe('8400...u6i9')
  })
  it('handles missing and malformed IDs', () => {
    expect(maskGoogleClientId(undefined)).toBeNull()
    expect(maskGoogleClientId('  ')).toBeNull()
    expect(maskGoogleClientId('abc')).toBe('(malformed)')
  })
})

describe('client hint in the sign-in error detail', () => {
  it('shows the masked client next to the code', () => {
    const err = withGoogleClientHint(new FirebaseError('auth/google-config-error', 'x'), WEB)
    expect(googleClientHintOf(err)).toBe('8400...u6i9')
    expect(describeAuthError(err, { provider: 'google' })).toEqual({ key: 'autherr_googleConfig', code: 'auth/google-config-error · client 8400...u6i9' })
  })
  it('falls back to the Google failure message for unmapped codes', () => {
    const err = withGoogleClientHint(new FirebaseError('auth/internal-error', 'x'), IOS)
    expect(describeAuthError(err, { provider: 'google' })).toEqual({ key: 'autherr_googleFailed', code: 'auth/internal-error · client 8400...b3l6' })
  })
  it('never decorates a cancellation or an error without a hint', () => {
    const cancel = withGoogleClientHint(new FirebaseError('auth/popup-closed-by-user', 'x'), IOS)
    expect(describeAuthError(cancel).key).toBe('autherr_cancelled')
    expect(describeAuthError(new FirebaseError('auth/internal-error', 'x')).code).toBe('auth/internal-error')
  })
})

describe('build info in the sign-in error detail', () => {
  const build = { applicationId: 'com.amitbd.landlyapp', versionCode: '12', runtimeVersion: '1.0.0', channel: 'testflight', updateId: '3fa91c2d-1111-2222-3333-444455556666', embedded: false }

  it('formats package, build, runtime, channel and a short update id', () => {
    expect(formatGoogleBuildInfo(build)).toBe('pkg com.amitbd.landlyapp · v12 · rt 1.0.0 · testflight · ota 3fa91c2d')
    expect(formatGoogleBuildInfo({ ...build, embedded: true })).toBe('pkg com.amitbd.landlyapp · v12 · rt 1.0.0 · testflight · embedded')
  })
  it('omits missing fields and rejects anything that is not a plain token', () => {
    expect(formatGoogleBuildInfo({ applicationId: 'com.x', channel: 'a b <script>' })).toBe('pkg com.x')
    expect(formatGoogleBuildInfo({})).toBeNull()
    expect(formatGoogleBuildInfo(undefined)).toBeNull()
  })
  it('appends the build detail after the client ID, only on Google failures', () => {
    const err = withGoogleClientHint(new FirebaseError('auth/google-config-error', 'x'), WEB, build)
    expect(googleBuildInfoOf(err)).toContain('pkg com.amitbd.landlyapp')
    expect(describeAuthError(err, { provider: 'google' }).code).toBe(
      'auth/google-config-error · client 8400...u6i9 · pkg com.amitbd.landlyapp · v12 · rt 1.0.0 · testflight · ota 3fa91c2d',
    )
    const cancel = withGoogleClientHint(new FirebaseError('auth/popup-closed-by-user', 'x'), WEB, build)
    expect(describeAuthError(cancel).code).toBeNull()
  })
  it('ignores a forged build string on an error', () => {
    const forged = Object.assign(new FirebaseError('auth/internal-error', 'x'), { googleClient: '8400...u6i9', googleBuild: '<img onerror=x>' })
    expect(googleBuildInfoOf(forged)).toBeNull()
  })
})

describe('withIsolatedCode with the long Google diagnostic', async () => {
  const { withIsolatedCode } = await import('../../lib/firebase/authErrors')
  it('keeps short codes inline and puts a long diagnostic on its own line', () => {
    expect(withIsolatedCode('Failed.', 'auth/internal-error')).toBe('Failed. ⁦(auth/internal-error)⁩')
    const long = 'auth/google-config-error · client 8400...u6i9 · pkg com.amitbd.landlyapp · v12'
    expect(withIsolatedCode('Failed.', long)).toBe(`Failed.\n⁦(${long})⁩`)
    expect(withIsolatedCode('Failed.', null)).toBe('Failed.')
  })
})

describe('signing certificate and installer in the build detail', () => {
  const build = { applicationId: 'com.amitbd.landlyapp', versionCode: '8', runtimeVersion: '1.0.0', channel: 'testflight', updateId: '01a20e5a-1111', embedded: false }
  const play = '8A:62:09:27:9F:D5:EC:97:6C:25:E0:05:99:20:54:6F:E6:D9:E7:01'

  it('abbreviates the SHA-1 to its first and last four hex characters, then the installer', () => {
    expect(formatGoogleBuildInfo({ ...build, signingSha1: play, installer: 'play' })).toBe(
      'pkg com.amitbd.landlyapp · v8 · rt 1.0.0 · testflight · ota 01a20e5a · sha 8A62…E701 · play',
    )
    expect(formatGoogleBuildInfo({ ...build, signingSha1: play.toLowerCase(), installer: 'sideload' })).toContain('sha 8A62…E701 · sideload')
  })
  it('tells the registered keys apart', () => {
    const upload = 'BB:B8:A7:28:0B:BC:E2:6F:D0:56:31:61:C9:9E:A6:7F:6C:18:5B:61'
    expect(formatGoogleBuildInfo({ signingSha1: upload })).toBe('sha BBB8…5B61')
  })
  it('leaves both out for an older binary, and drops malformed or unknown values', () => {
    expect(formatGoogleBuildInfo(build)).toBe('pkg com.amitbd.landlyapp · v8 · rt 1.0.0 · testflight · ota 01a20e5a')
    expect(formatGoogleBuildInfo({ signingSha1: 'not-a-sha', installer: 'com.android.vending' })).toBeNull()
    expect(formatGoogleBuildInfo({ signingSha1: `${play}:00` })).toBeNull()
  })
  it('keeps the abbreviated key on the error and in the banner code', () => {
    const err = withGoogleClientHint(new FirebaseError('auth/google-config-error', 'x'), WEB, { ...build, signingSha1: play, installer: 'play' })
    expect(googleBuildInfoOf(err)).toContain('sha 8A62…E701 · play')
    expect(describeAuthError(err, { provider: 'google' }).code).toBe(
      'auth/google-config-error · client 8400...u6i9 · pkg com.amitbd.landlyapp · v8 · rt 1.0.0 · testflight · ota 01a20e5a · sha 8A62…E701 · play',
    )
  })
})

describe('the signing module stays Android-only', () => {
  it('declares only Android and is loaded optionally, never from the web or iOS sign-in files', async () => {
    const { readFile } = await import('node:fs/promises')
    const config = JSON.parse(await readFile('landly-mobile/modules/landly-app-signing/expo-module.config.json', 'utf8'))
    expect(config.platforms).toEqual(['android'])
    expect(await readFile('landly-mobile/modules/landly-app-signing/index.ts', 'utf8')).toContain('requireOptionalNativeModule')
    for (const file of ['googleSignIn.web.ts']) {
      expect(await readFile(`landly-mobile/src/auth/${file}`, 'utf8')).not.toMatch(/landly-app-signing|nativeBuildInfo/)
    }
  })
})
