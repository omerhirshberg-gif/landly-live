import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LangContext } from '@/lib/i18n/LangProvider'
import { translations, type TranslationKey } from '@/lib/i18n/translations'

vi.mock('firebase/auth', () => ({ EmailAuthProvider: { credential: vi.fn() }, reauthenticateWithCredential: vi.fn(), updatePassword: vi.fn() }))

const { default: SecuritySection } = await import('@/components/settings/SecuritySection')

// /account's Change Password follows the sign-up password rule, not just a
// 6-character minimum.
describe('web change password', () => {
  const t = (key: TranslationKey) => translations.en[key]
  const html = renderToStaticMarkup(
    createElement(
      LangContext.Provider,
      { value: { lang: 'en', setLang: () => {}, t, isRtl: false } },
      createElement(SecuritySection, { user: { email: 'dana@example.com' } as never })
    )
  )

  it('drops the bare 6-character minimum', () => {
    expect(html).not.toContain('minLength')
    expect(html).not.toContain('minlength')
  })

  it('has the sign-up checklist under the new password, collapsed until focused', () => {
    const field = html.indexOf('autoComplete="new-password"') > -1 ? html.indexOf('autoComplete="new-password"') : html.indexOf('autocomplete="new-password"')
    const checklist = html.indexOf(`aria-label="${translations.en.onb_pwReq_title}"`)
    expect(field).toBeGreaterThan(-1)
    expect(checklist).toBeGreaterThan(field)
    for (const { label } of [{ label: 'onb_pwReq_length' }, { label: 'onb_pwReq_upper' }, { label: 'onb_pwReq_lower' }, { label: 'onb_pwReq_number' }] as const) {
      expect(html).toContain(translations.en[label])
    }
    expect(html).toMatch(/aria-hidden="true"[^>]*class="grid [^"]*grid-rows-\[0fr\]/)
  })
})
