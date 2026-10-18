import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LangContext } from '@/lib/i18n/LangProvider'
import { RTL_LANGS, translations, type Lang, type TranslationKey } from '@/lib/i18n/translations'

const mocks = vi.hoisted(() => {
  class MockRequestAuthError extends Error { status: 401 | 403 | 503; constructor(message: string, status: 401 | 403 | 503) { super(message); this.status = status } }
  return {
    send: vi.fn(),
    limited: vi.fn(() => false),
    uidLimited: vi.fn(() => false),
    requireCustomer: vi.fn(),
    MockRequestAuthError,
    auth: { user: null as null | { uid: string; email: string | null; displayName: string | null }, loading: false },
    profile: { profile: null as null | { firstName: string; lastName: string; displayName: string } },
  }
})
vi.mock('resend', () => ({ Resend: class { emails = { send: mocks.send } } }))
vi.mock('@/lib/auth/contactFormRateLimit', () => ({ isMentorRequestRateLimited: mocks.limited, isMentorRequestUidRateLimited: mocks.uidLimited }))
vi.mock('@/lib/firebase/verifyRequestUser', () => ({ requireCustomer: mocks.requireCustomer, RequestAuthError: mocks.MockRequestAuthError }))
vi.mock('@/lib/firebase/useAuth', () => ({ useAuth: () => mocks.auth }))
vi.mock('@/lib/firebase/useMemberProfile', () => ({ useMemberProfile: () => mocks.profile }))
vi.mock('@/components/layout/Navbar', () => ({ default: () => null }))

import { POST } from '@/app/api/mentor/inquiry/route'
import { parseMentorRequest } from '@/lib/email/sendMentorRequest'
const { default: OlimPage } = await import('@/app/olim/page')

const token = { uid: 'user-1', email: 'olga@example.com' }

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('EMAIL_FROM', 'test@landly.test')
  vi.stubEnv('RESEND_API_KEY', 'fake-test-key')
  mocks.send.mockResolvedValue({ error: null })
  mocks.limited.mockReturnValue(false)
  mocks.uidLimited.mockReturnValue(false)
  mocks.requireCustomer.mockResolvedValue(token)
  mocks.auth = { user: null, loading: false }
  mocks.profile = { profile: null }
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })

const valid = { name: 'Olga Petrova', mentorLanguage: 'ru', aliyahDate: 'March 2027', lang: 'ru' }

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
    for (const v of ['Olga Petrova', 'olga@example.com', 'Russian', 'March 2027', 'user-1']) {
      expect(email.text).toContain(v)
      expect(email.html).toContain(v)
    }
  })

  it('accepts a request without language or date', async () => {
    expect((await post({ name: 'Dan' })).status).toBe(200)
    const email = mocks.send.mock.calls[0][0]
    expect(email.subject).toBe('[Landly Mentor Request] Dan — Aliyah mentor')
    expect(email.text).toContain('Mentor language: Not specified')
  })

  it('sends the member notes as the message', async () => {
    await post({ ...valid, notes: 'Moving with two kids.\nPrefer evenings.' })
    expect(mocks.send.mock.calls[0][0].text).toContain('Message:\nMoving with two kids.\nPrefer evenings.')
  })

  it('answers 401 to guests without emailing', async () => {
    mocks.requireCustomer.mockRejectedValueOnce(new mocks.MockRequestAuthError('Unauthorized', 401))
    const res = await post(valid)
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it('answers 403 to business accounts and 503 when auth is down', async () => {
    mocks.requireCustomer.mockRejectedValueOnce(new mocks.MockRequestAuthError('This account cannot access this resource.', 403))
    expect((await post(valid)).status).toBe(403)
    mocks.requireCustomer.mockRejectedValueOnce(new mocks.MockRequestAuthError('Authentication service unavailable.', 503))
    expect((await post(valid)).status).toBe(503)
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it('takes the email from the token, never the body', async () => {
    await post({ ...valid, email: 'victim@example.com' })
    const email = mocks.send.mock.calls[0][0]
    expect(email.replyTo).toBe('olga@example.com')
    expect(email.text).not.toContain('victim@example.com')
  })

  it('rejects an account without a usable email', async () => {
    mocks.requireCustomer.mockResolvedValueOnce({ uid: 'phone-only' })
    expect((await post(valid)).status).toBe(400)
    expect(mocks.send).not.toHaveBeenCalled()
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
    [{ ...valid, name: 'x'.repeat(101) }],
    [{ ...valid, aliyahDate: 'x'.repeat(61) }],
    [{ ...valid, notes: 'x'.repeat(1001) }],
    [null],
  ])('rejects invalid input %#', async (body) => {
    expect((await post(body)).status).toBe(400)
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it('drops honeypot submissions, rate limits by IP and account, and reports send failures', async () => {
    expect((await post({ ...valid, website: 'x' })).status).toBe(200)
    expect(mocks.send).not.toHaveBeenCalled()
    expect(mocks.requireCustomer).not.toHaveBeenCalled()
    mocks.limited.mockReturnValueOnce(true)
    expect((await post(valid)).status).toBe(429)
    mocks.uidLimited.mockReturnValueOnce(true)
    expect((await post(valid)).status).toBe(429)
    expect(mocks.uidLimited).toHaveBeenCalledWith('user-1')
    mocks.send.mockResolvedValue({ error: { name: 'validation_error', statusCode: 422, message: 'bad' } })
    expect((await post(valid)).status).toBe(502)
  })
})

describe('/olim mentor card', () => {
  function render(lang: Lang) {
    const t = (key: TranslationKey) => translations[lang][key]
    const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
    return renderToStaticMarkup(createElement(LangContext.Provider, { value: { lang, setLang: () => {}, t, isRtl } }, createElement(OlimPage)))
  }
  // Text as React writes it into markup.
  const esc = (text: string) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const signIn = () => { mocks.auth = { user: { uid: 'user-1', email: 'olga@example.com', displayName: 'Olga P' }, loading: false } }

  it.each(Object.keys(translations) as Lang[])('shows guests the sign-up gate and no form (%s)', (lang) => {
    const html = render(lang)
    const t = translations[lang]
    expect(html).toContain(esc(t.olim_mentor_form_title))
    expect(html).toContain(esc(t.olim_gate_message))
    expect(html).not.toContain('<form')
    expect(html).not.toContain('type="submit"')
    expect(html).toContain(`href="/signup?redirect=%2Folim%23mentor">${esc(t.olim_gate_signup)}</a>`)
    expect(html).toContain(`href="/login?redirect=%2Folim%23mentor">${esc(t.olim_gate_login)}</a>`)
  })

  it.each(Object.keys(translations) as Lang[])('has the Lone Soldiers section for search and visitors (%s)', (lang) => {
    const t = translations[lang]
    const html = render(lang)
    expect(html).toContain(`<section id="lone-soldiers" aria-labelledby="lone-soldiers-title"`)
    expect(html).toContain(`<h2 id="lone-soldiers-title" class="text-xl sm:text-2xl font-black text-slate-900 mb-2">${esc(t.olim_lone_title)}</h2>`)
    expect(html).toContain(esc(t.olim_lone_desc))
    expect(t.olim_lone_desc).toContain(t.signup_customerType_loneSoldier)
  })

  it('shows neither the gate nor the form while auth loads', () => {
    mocks.auth = { user: null, loading: true }
    const html = render('en')
    expect(html).toContain('role="status"')
    expect(html).not.toContain('<form')
    expect(html).not.toContain(esc(translations.en.olim_gate_message))
  })

  it.each(Object.keys(translations) as Lang[])('shows members the form with translated labels (%s)', (lang) => {
    signIn()
    const html = render(lang)
    const t = translations[lang]
    expect(html).not.toContain(esc(t.olim_gate_message))
    expect(html).not.toContain('formspree')
    expect(html).toMatch(new RegExp(`<button type="submit"[^>]*>${t.olim_request_btn}</button>`))
    for (const code of ['ru', 'fr', 'es', 'en']) expect(html).toContain(`value="${code}"`)
    expect(html).toContain(`aria-label="${t.form_name}"`)
    expect(html).toContain(`aria-label="${esc(t.olim_notes_ph)}"`)
    for (const key of ['olim_form_success', 'olim_form_error', 'olim_form_rate_limited', 'olim_form_invalid', 'olim_form_session_expired'] as const) expect(t[key]).toBeTruthy()
  })

  it('pre-fills the profile name and the read-only account email', () => {
    signIn()
    mocks.profile = { profile: { firstName: 'Olga', lastName: 'Petrova', displayName: 'Olga Petrova' } }
    const html = render('en')
    expect(html).toMatch(/name="name"[^>]*value="Olga Petrova"/)
    expect(html).toMatch(/type="email"[^>]*readOnly=""[^>]*value="olga@example.com"/)
  })

  it('falls back to the Auth display name before the profile loads', () => {
    signIn()
    expect(render('en')).toMatch(/name="name"[^>]*value="Olga P"/)
  })

  it('keeps the email field left-to-right, aligned to the reading side', () => {
    signIn()
    expect(render('he')).toMatch(/type="email"[^>]*dir="ltr"[^>]*class="inp rtl:text-right/)
  })
})
