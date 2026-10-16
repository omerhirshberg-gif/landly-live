import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LangContext } from '@/lib/i18n/LangProvider'
import { RTL_LANGS, translations, type Lang, type TranslationKey } from '@/lib/i18n/translations'

const mocks = vi.hoisted(() => ({ send: vi.fn(), limited: vi.fn(() => false) }))
vi.mock('resend', () => ({ Resend: class { emails = { send: mocks.send } } }))
vi.mock('@/lib/auth/contactFormRateLimit', () => ({ isMentorRequestRateLimited: mocks.limited }))
vi.mock('@/components/layout/Navbar', () => ({ default: () => null }))

import { POST } from '@/app/api/mentor/inquiry/route'
import { parseMentorRequest } from '@/lib/email/sendMentorRequest'
const { default: OlimPage } = await import('@/app/olim/page')

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('EMAIL_FROM', 'test@landly.test')
  vi.stubEnv('RESEND_API_KEY', 'fake-test-key')
  mocks.send.mockResolvedValue({ error: null })
  mocks.limited.mockReturnValue(false)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })

const valid = { name: 'Olga Petrova', email: 'olga@example.com', mentorLanguage: 'ru', aliyahDate: 'March 2027', lang: 'ru' }

function post(body: unknown) {
  return POST(new Request('https://landly.test/api/mentor/inquiry', { method: 'POST', body: JSON.stringify(body) }))
}

describe('/api/mentor/inquiry', () => {
  it('emails the team inbox with Reply-To set to the member', async () => {
    expect((await post(valid)).status).toBe(200)
    const email = mocks.send.mock.calls[0][0]
    expect(email.to).toBe('team.landly@gmail.com')
    expect(email.replyTo).toBe('olga@example.com')
    expect(email.subject).toBe('[Landly Mentor Request] Olga Petrova — Russian-speaking mentor')
    for (const v of ['Olga Petrova', 'olga@example.com', 'Russian', 'March 2027']) {
      expect(email.text).toContain(v)
      expect(email.html).toContain(v)
    }
  })

  it('accepts a request without language or date', async () => {
    expect((await post({ name: 'Dan', email: 'dan@example.com' })).status).toBe(200)
    const email = mocks.send.mock.calls[0][0]
    expect(email.subject).toBe('[Landly Mentor Request] Dan — Aliyah mentor')
    expect(email.text).toContain('Mentor language: Not specified')
  })

  it('escapes HTML and keeps the subject on one line', async () => {
    await post({ ...valid, name: '<b>Eve</b>\r\nBcc: x@y.z', aliyahDate: '<script>x</script>' })
    const email = mocks.send.mock.calls[0][0]
    expect(email.subject).not.toMatch(/[\r\n]/)
    expect(email.html).not.toContain('<script>')
    expect(email.html).not.toContain('<b>Eve')
  })

  it('ignores unknown mentor languages', () => {
    expect(parseMentorRequest({ ...valid, mentorLanguage: 'toString' })?.mentorLanguage).toBe('')
  })

  it.each([
    [{ ...valid, name: '' }],
    [{ ...valid, email: 'nope' }],
    [{ ...valid, name: 'x'.repeat(101) }],
    [{ ...valid, aliyahDate: 'x'.repeat(61) }],
    [null],
  ])('rejects invalid input %#', async (body) => {
    expect((await post(body)).status).toBe(400)
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it('drops honeypot submissions, rate limits, and reports send failures', async () => {
    expect((await post({ ...valid, website: 'x' })).status).toBe(200)
    expect(mocks.send).not.toHaveBeenCalled()
    mocks.limited.mockReturnValueOnce(true)
    expect((await post(valid)).status).toBe(429)
    mocks.send.mockResolvedValue({ error: { name: 'validation_error', statusCode: 422, message: 'bad' } })
    expect((await post(valid)).status).toBe(502)
  })
})

describe('/olim mentor form', () => {
  function render(lang: Lang) {
    const t = (key: TranslationKey) => translations[lang][key]
    const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
    return renderToStaticMarkup(createElement(LangContext.Provider, { value: { lang, setLang: () => {}, t, isRtl } }, createElement(OlimPage)))
  }

  it.each(Object.keys(translations) as Lang[])('posts via fetch (no Formspree) with translated labels (%s)', (lang) => {
    const html = render(lang)
    const t = translations[lang]
    expect(html).not.toContain('formspree')
    expect(html).toMatch(new RegExp(`<button type="submit"[^>]*>${t.olim_request_btn}</button>`))
    for (const code of ['ru', 'fr', 'es', 'en']) expect(html).toContain(`value="${code}"`)
    expect(html).toContain(`aria-label="${t.form_name}"`)
    for (const key of ['olim_form_success', 'olim_form_error', 'olim_form_rate_limited', 'olim_form_invalid'] as const) expect(t[key]).toBeTruthy()
  })

  it('keeps the email field left-to-right, aligned to the reading side', () => {
    expect(render('he')).toMatch(/type="email"[^>]*dir="ltr"[^>]*class="inp rtl:text-right"/)
  })
})
