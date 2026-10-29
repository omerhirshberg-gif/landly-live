import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { appUrlForLink } from '@/lib/navigation/deepLinks'

// The "Open in app" card (components/layout/OpenInAppHint.tsx) belongs on
// offer and voucher pages only. Sign-in, sign-up and Firebase's sign-in
// return (/__/auth/handler) must never show it.
const AUTH_ROUTES = [
  '/login',
  '/signup',
  '/verify-email',
  '/reset-password',
  '/forgot-password',
  '/__/auth/handler',
  '/__/auth/iframe',
  '/login?mode=signUp',
  'https://www.golandly.com/__/auth/handler?state=x',
]

const sources = () =>
  execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', 'app', 'components'], { encoding: 'utf8' })
    .split('\n')
    .filter((f) => /\.tsx?$/.test(f) && existsSync(f))

describe('Open in app card stays off sign-in pages', () => {
  it('has no app link for any sign-in or sign-in return route', () => {
    for (const route of AUTH_ROUTES) expect(appUrlForLink(route), route).toBeNull()
    // Still offered where it belongs.
    expect(appUrlForLink('/offers/abc')).not.toBeNull()
    expect(appUrlForLink('/member/vouchers/abc')).not.toBeNull()
  })

  it('is mounted only on the offer and voucher pages', () => {
    const mounts = sources().filter((f) => f !== 'components/layout/OpenInAppHint.tsx' && /\bOpenInApp(Hint|Bar)\b/.test(readFileSync(f, 'utf8')))
    expect(mounts.sort()).toEqual(['app/member/vouchers/[voucherId]/page.tsx', 'app/offers/[offerId]/page.tsx'])
  })

  it('is not in the sign-in screens, the root layout or a Smart App Banner', () => {
    for (const f of ['app/layout.tsx', 'components/auth/entrance/AuthScreen.tsx', ...sources().filter((f) => /^app\/(login|signup|verify-email|reset-password|forgot-password)\//.test(f))]) {
      const src = readFileSync(f, 'utf8')
      expect(src, f).not.toMatch(/OpenInApp/)
      expect(src, f).not.toMatch(/apple-itunes-app|itunes:\s*\{/)
    }
  })
})
