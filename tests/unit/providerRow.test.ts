import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { providerOrder } from '@/lib/auth/appleDevice'
import { translations, type Lang } from '@/lib/i18n/translations'
import ProviderRow from '@/components/auth/entrance/ProviderRow'
import ProviderTile from '@/components/auth/entrance/ProviderTile'

const read = (path: string) => readFileSync(path, 'utf8')
// Code only: comments may name the projects to explain where the settings live.
const code = (path: string) => read(path).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
// How React escapes an attribute value.
const attr = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const LANGS = Object.keys(translations) as Lang[]
const tile = (props: Parameters<typeof ProviderTile>[0]) => renderToStaticMarkup(createElement(ProviderTile, props))

describe('providerOrder', () => {
  it('leads with Apple on iPhone and iPad, with Google everywhere else, the passkey last', () => {
    expect(providerOrder({ appleFirst: true, passkey: true })).toEqual(['apple', 'google', 'passkey'])
    expect(providerOrder({ appleFirst: false, passkey: true })).toEqual(['google', 'apple', 'passkey'])
    expect(providerOrder({ appleFirst: false })).toEqual(['google', 'apple'])
  })

  it('drops Apple where it is unavailable (Android)', () => {
    expect(providerOrder({ appleFirst: false, apple: false })).toEqual(['google'])
    expect(providerOrder({ appleFirst: true, apple: false, passkey: true })).toEqual(['google', 'passkey'])
  })
})

describe('web ProviderTile (a full-width button)', () => {
  it.each(LANGS)('shows each provider\'s label as the button text in the page language (%s)', (lang) => {
    const t = translations[lang]
    for (const [provider, label] of [['apple', t.login_appleBtn], ['google', t.login_googleBtn], ['passkey', t.login_passkeyBtn]] as const) {
      const html = tile({ provider, label, onClick: () => {} })
      expect(html).toContain(`<span class="truncate">${attr(label)}</span>`)
      // The icon itself is hidden from screen readers; the visible label is the name.
      expect(html).toMatch(/<span aria-hidden="true"/)
    }
  })

  it('says Continue with Google in all five languages, Hebrew included', () => {
    expect(translations.en.login_googleBtn).toBe('Continue with Google')
    expect(translations.he.login_googleBtn).toBe('המשך עם Google')
    for (const lang of LANGS) {
      expect(translations[lang].login_googleBtn).toMatch(/Google/)
      expect(translations[lang].signup_googleBtn).toBe(translations[lang].login_googleBtn)
    }
  })

  it('has the primary button\'s metrics: full width, 52px, 14px corners, 0.97 press, a 22px icon box', () => {
    const html = tile({ provider: 'google', label: 'x', onClick: () => {} })
    for (const cls of ['w-full', 'h-[52px]', 'rounded-[14px]', 'active:enabled:scale-[0.97]', 'h-[22px] w-[22px]']) {
      expect(html).toContain(cls)
    }
  })

  it('puts the logo on the logical start edge, so Hebrew mirrors it', () => {
    const html = tile({ provider: 'google', label: 'x', onClick: () => {} })
    expect(html).toContain('absolute start-[18px]')
    expect(html).not.toMatch(/\b(?:left|right|ml|mr|pl|pr)-/)
  })

  it('draws Apple black with a white logo nudged up 1px by an offset, not a transform', () => {
    const html = tile({ provider: 'apple', label: 'x', onClick: () => {} })
    expect(html).toContain('bg-black')
    expect(html).toContain('text-white')
    expect(html).toContain('relative bottom-px')
  })

  it('draws Google white with a hairline border', () => {
    const html = tile({ provider: 'google', label: 'x', onClick: () => {} })
    expect(html).toContain('border-slate-200 bg-white')
    expect(html).toMatch(/ border /)
  })

  it.each(['apple', 'google', 'passkey'] as const)('stays crisp at rest (%s): no transform or layer hint outside the press and a mouse hover', (provider) => {
    const html = tile({ provider, label: 'x', onClick: () => {} })
    // Transforms only behind :active and a real mouse's hover.
    expect(html.match(/(?:^|[\s"])(?:-?translate-[xyz]|scale-|rotate-|transform\b|will-change|backface|translateZ)/g) ?? []).toEqual([])
    expect(html).toContain('active:enabled:scale-[0.97]')
    expect(html).toContain('[@media(hover:hover)]:hover:enabled:-translate-y-px')
    expect(html).toContain('shape-rendering="geometricPrecision"')
  })

  it('draws the passkey glyph 1:1 so its 2px stroke lands on whole pixels', () => {
    const html = tile({ provider: 'passkey', label: 'Sign in', onClick: () => {} })
    expect(html).toContain('width="22" height="22" viewBox="1 1 22 22"')
    expect(html).toContain('stroke-width="2"')
    expect(html).toContain('stroke="#0038b8"')
  })

  it('shows a spinner and the busy label while its sign-in runs, at full strength', () => {
    const html = tile({ provider: 'passkey', label: 'Sign in', busyLabel: 'Waiting', busy: true, disabled: true, onClick: () => {} })
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('<span class="truncate">Waiting</span>')
    expect(html).toContain('animate-spin')
    expect(html).not.toContain('opacity-60')
  })

  it('dims the other buttons while another sign-in runs', () => {
    const html = tile({ provider: 'apple', label: 'x', disabled: true, onClick: () => {} })
    expect(html).toContain('disabled=""')
    expect(html).toContain('opacity-60')
  })

  it('stacks the buttons full width, 12px apart', () => {
    const html = renderToStaticMarkup(createElement(ProviderRow, null, 'a'))
    expect(html).toContain('flex flex-col gap-3 w-full')
  })
})

describe('the app\'s ProviderTile (a full-width button)', () => {
  const src = read('landly-mobile/src/components/ProviderTile.tsx')

  it('matches the primary button: stretched, 52pt, 14 corners, a 1px hairline on the white one', () => {
    expect(src).toContain("alignSelf: 'stretch'")
    expect(src).toContain('height: 52')
    expect(src).toContain('borderRadius: 14')
    expect(src).toContain('borderWidth: 1')
    expect(src).toContain('plain: { backgroundColor: colors.white, borderColor: colors.border }')
    expect(src).toContain("apple: { backgroundColor: '#000000', borderColor: '#000000' }")
  })

  it('springs to 0.97 on the UI thread with a soft haptic, and skips the spring under Reduce Motion', () => {
    expect(src).toContain('const PRESS_SCALE = 0.97')
    expect(src).toContain('withSpring(PRESS_SCALE, PRESS_SPRING)')
    expect(src).toContain('useReducedMotion()')
    expect(src).toContain('soft()')
    expect(read('landly-mobile/src/lib/haptics.ts')).toContain('ImpactFeedbackStyle.Soft')
  })

  it('puts the logo on the logical start edge and centres the label', () => {
    expect(src).toContain('start: 18')
    expect(src).not.toMatch(/\b(?:left|right|marginLeft|marginRight|paddingLeft|paddingRight):/)
    expect(src).toContain("textAlign: 'center'")
  })

  it('stacks the providers in a column on the login screen', () => {
    expect(read('landly-mobile/src/app/(auth)/login.tsx')).toContain("providerRow: { flexDirection: 'column', gap: 12, alignSelf: 'stretch' }")
  })
})

describe('the auth screens use the stack', () => {
  const web = read('components/auth/entrance/AuthScreen.tsx')
  const app = read('landly-mobile/src/app/(auth)/login.tsx')

  it('offers the passkey on the website\'s Sign In tab only, inside the row, with no separate button', () => {
    expect(web).toContain('providerOrder({ appleFirst, passkey: passkey.webauthn && !signUp })')
    expect(web).toContain('<ProviderRow>{providers.map(providerTile)}</ProviderRow>')
    expect(web).not.toMatch(/PasskeyButton|passkeyFirst|GoogleButton|AppleButton/)
  })

  it('offers Google and Apple only in the app, with Apple only where available', () => {
    expect(app).toContain('providerOrder({ appleFirst, apple: appleAvailable })')
    expect(code('landly-mobile/src/app/(auth)/login.tsx')).not.toMatch(/passkey/i)
    expect(app).not.toMatch(/GoogleButton|AppleButton/)
  })
})

describe('the auth card', () => {
  it('leaves no transform filling forwards after its entrance (it would keep the card on a soft GPU layer)', () => {
    const css = read('components/auth/entrance/entrance.module.css')
    expect(css).toContain('animation-name: landlyFadeIn, landlyCardRise;')
    expect(css).toContain('animation-fill-mode: backwards, backwards;')
  })
})

describe('Sign in with Apple: DEV and PROD parity', () => {
  const files = [
    'lib/firebase/config.ts',
    'lib/firebase/config.web.ts',
    'lib/firebase/config.native.ts',
    'lib/auth/oauthWebSignIn.ts',
    'landly-mobile/src/auth/appleSignIn.ts',
    'landly-mobile/src/auth/appleSignIn.web.ts',
  ]

  it.each(files)('%s names no Services ID, project or auth host (the Firebase project settings hold them)', (file) => {
    expect(code(file)).not.toMatch(/com\.amitbd\.landlyapp\.web|landly-dev|landly-be752|firebaseapp\.com|golandly\.com/)
  })

  it('builds the provider from apple.com alone in every config', () => {
    for (const file of files.slice(0, 3)) expect(read(file)).toContain("export const appleProvider = new OAuthProvider('apple.com')")
  })

  it('takes the Firebase project and auth domain from env on every platform', () => {
    expect(read('lib/firebase/config.ts')).toContain('authDomain: currentAuthDomain()')
    expect(read('lib/firebase/authDomain.ts')).toContain('envAuthDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN')
    expect(read('landly-mobile/app.config.js')).toContain("authDomain: firebaseValue('AUTH_DOMAIN')")
  })
})
