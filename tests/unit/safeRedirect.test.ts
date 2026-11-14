import { describe, expect, it } from 'vitest'
import { DEFAULT_REDIRECT, safeRedirectPath, withRedirect } from '@/lib/auth/safeRedirect'

describe('safeRedirectPath', () => {
  it.each([
    ['/offers/abc#reviews', '/offers/abc#reviews'],
    ['/offers/abc?x=1', '/offers/abc?x=1'],
    ['/offers/a%20b%2Fc', '/offers/a%20b%2Fc'],
    ['/', '/'],
    ['/a/../support', '/support'],
  ])('keeps same-site path %s', (raw, expected) => {
    expect(safeRedirectPath(raw)).toBe(expected)
  })

  it.each([
    [null], [undefined], [''],
    ['//evil.com'], ['/\\evil.com'], ['\\\\evil.com'], ['/\t/evil.com'], ['/ /evil.com'],
    ['https://evil.com'], ['javascript:alert(1)'], ['support'], ['%2F%2Fevil.com'],
  ])('sends %s home', (raw) => {
    expect(safeRedirectPath(raw)).toBe(DEFAULT_REDIRECT)
  })

  it('round-trips through withRedirect', () => {
    const href = withRedirect('/login', '/offers/abc#reviews')
    expect(href).toBe('/login?redirect=%2Foffers%2Fabc%23reviews')
    expect(safeRedirectPath(new URLSearchParams(href.split('?')[1]).get('redirect'))).toBe('/offers/abc#reviews')
  })
})
