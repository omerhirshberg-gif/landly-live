import { describe, expect, it } from 'vitest'
import {
  AVATAR_MAX_BYTES,
  AVATAR_SIZE,
  avatarInitials,
  avatarPath,
  coverCrop,
  resolveAvatarUrl,
  withAvatarVersion,
} from '@/lib/avatar/avatar'
import { readFileSync } from 'node:fs'

describe('avatar storage path', () => {
  it('is one object per member under avatars/{uid}', () => {
    expect(avatarPath('abc123')).toBe('avatars/abc123')
  })

  it('matches the path and the 2MB cap storage.rules enforces', () => {
    const rules = readFileSync('storage.rules', 'utf8')
    expect(rules).toContain('match /avatars/{userId}')
    expect(rules).toContain('request.auth.uid == userId')
    expect(rules).toContain('request.resource.size < 2 * 1024 * 1024')
    expect(rules).toContain("request.resource.contentType.matches('image/.*')")
    expect(AVATAR_MAX_BYTES).toBe(2 * 1024 * 1024)
    expect(JSON.parse(readFileSync('firebase.json', 'utf8')).storage.rules).toBe('storage.rules')
  })
})

describe('withAvatarVersion', () => {
  it('appends a version to a Storage download URL so caches refetch after an overwrite', () => {
    const url = 'https://firebasestorage.googleapis.com/v0/b/x.appspot.com/o/avatars%2Fu1?alt=media&token=t'
    expect(withAvatarVersion(url, 42)).toBe(`${url}&v=42`)
  })

  it('starts a query string when there is none', () => {
    expect(withAvatarVersion('https://example.com/a.jpg', 7)).toBe('https://example.com/a.jpg?v=7')
  })
})

describe('resolveAvatarUrl', () => {
  it('prefers the uploaded photo, then the sign-in provider photo, then none', () => {
    expect(resolveAvatarUrl({ photoURL: 'https://cdn/up.jpg' }, 'https://google/p.jpg')).toBe('https://cdn/up.jpg')
    expect(resolveAvatarUrl({ photoURL: '' }, 'https://google/p.jpg')).toBe('https://google/p.jpg')
    expect(resolveAvatarUrl(null, null)).toBeNull()
  })

  it('ignores anything that is not an http(s) URL', () => {
    expect(resolveAvatarUrl({ photoURL: 'javascript:alert(1)' }, 'data:image/png;base64,xx')).toBeNull()
  })
})

describe('avatarInitials', () => {
  it('uses first and last initials from the profile', () => {
    expect(avatarInitials({ firstName: 'dana', lastName: 'levi' })).toBe('DL')
  })

  it('falls back to the display name, then the Auth name', () => {
    expect(avatarInitials({ displayName: 'Noa Cohen' })).toBe('NC')
    expect(avatarInitials(null, 'Avi')).toBe('A')
  })

  it('handles Hebrew names', () => {
    expect(avatarInitials({ firstName: 'שרה', lastName: 'כהן' })).toBe('שכ')
  })

  it('never derives initials from an email', () => {
    expect(avatarInitials({ displayName: 'someone@example.com' }, 'someone@example.com')).toBe('')
  })

  it('keeps a surrogate pair whole', () => {
    expect(avatarInitials({ firstName: '𝒜lex' })).toBe('𝒜')
  })
})

describe('coverCrop', () => {
  it('takes the centred square of a landscape photo and scales it to 512px', () => {
    expect(coverCrop(4000, 3000)).toEqual({ originX: 500, originY: 0, side: 3000, output: AVATAR_SIZE })
  })

  it('takes the centred square of a portrait photo', () => {
    expect(coverCrop(1080, 1920)).toEqual({ originX: 0, originY: 420, side: 1080, output: AVATAR_SIZE })
  })

  it('never upscales a small image', () => {
    expect(coverCrop(200, 300).output).toBe(200)
  })
})
