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
    profile: { profile: null as null | { firstName: string; lastName: string; displayName: string }, loaded: false, firstName: null as string | null },
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
  mocks.profile = { profile: null, loaded: false, firstName: null }
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
    expect(html).toContain(`href="/signup?redirect=%2Folim%23mentor-section">${esc(t.olim_gate_signup)}</a>`)
    expect(html).toContain(`href="/login?redirect=%2Folim%23mentor-section">${esc(t.olim_gate_login)}</a>`)
  })

  it.each(Object.keys(translations) as Lang[])('has the Lone Soldiers section for search and visitors (%s)', (lang) => {
    const t = translations[lang]
    const html = render(lang)
    expect(html).toContain(`<section id="lone-soldiers" aria-labelledby="lone-soldiers-title"`)
    expect(html).toContain(`<h2 id="lone-soldiers-title" class="text-xl sm:text-2xl font-black text-ink mb-2">${esc(t.olim_lone_title)}</h2>`)
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
    mocks.profile = { profile: { firstName: 'Olga', lastName: 'Petrova', displayName: 'Olga Petrova' }, loaded: true, firstName: 'Olga' }
    const html = render('en')
    expect(html).toMatch(/readOnly=""[^>]*name="name" value="Olga Petrova"/)
    expect(html).toMatch(/type="email"[^>]*readOnly=""[^>]*value="olga@example.com"/)
  })

  it('falls back to the Auth display name before the profile loads', () => {
    signIn()
    expect(render('en')).toMatch(/name="name"[^>]*value="Olga P"/)
  })

  it('leaves the name editable only for a member with no name on file', () => {
    mocks.auth = { user: { uid: 'user-1', email: 'olga@example.com', displayName: null }, loading: false }
    const html = render('en')
    expect(html).toMatch(/<input type="text"[^>]*name="name" value=""/)
    expect(html).not.toMatch(/readOnly=""[^>]*name="name"/)
  })

  it('keeps the email field left-to-right, aligned to the reading side', () => {
    signIn()
    expect(render('he')).toMatch(/type="email"[^>]*dir="ltr"[^>]*class="inp rtl:text-right/)
  })
})

describe('/olim follows auth', () => {
  function render(lang: Lang) {
    const t = (key: TranslationKey) => translations[lang][key]
    const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
    return renderToStaticMarkup(createElement(LangContext.Provider, { value: { lang, setLang: () => {}, t, isRtl } }, createElement(OlimPage)))
  }
  const esc = (text: string) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const signIn = () => {
    mocks.auth = { user: { uid: 'user-1', email: 'olga@example.com', displayName: 'Olga P' }, loading: false }
    mocks.profile = { profile: { firstName: 'Olga', lastName: 'Petrova', displayName: 'Olga Petrova' }, loaded: true, firstName: 'Olga' }
  }

  it.each(Object.keys(translations) as Lang[])('pitches guests the community, the free promise and the join steps (%s)', (lang) => {
    const t = translations[lang]
    const html = render(lang)
    for (const key of ['olim_hero_badge', 'olim_title', 'olim_sub', 'olim_free_badge', 'olim_free_note', 'olim_step1_title', 'olim_step2_title', 'olim_step3_title', 'olim_final_title'] as const) expect(html).toContain(esc(t[key]))
    expect(html).toContain(`<a class="ds-btn ds-btn-inverse ds-btn-wrap shadow-[0_8px_24px_rgba(0,0,0,.18)]" href="/signup">${esc(t.olim_cta_join)}`)
    expect(html).toContain(`<a class="ds-btn ds-btn-outline-inverse ds-btn-wrap" href="/login">${esc(t.nav_login)}</a>`)
    expect(html).not.toContain(esc(t.olim_member_badge))
    expect(html).not.toContain(esc(t.olim_mstep1_title))
  })

  it.each(Object.keys(translations) as Lang[])('welcomes members back with their status, member steps and member CTAs (%s)', (lang) => {
    signIn()
    const t = translations[lang]
    const html = render(lang)
    expect(html).toContain(esc(t.olim_member_welcome.replace('{name}', 'Olga')))
    for (const key of ['olim_member_badge', 'olim_member_sub', 'olim_member_how_sub', 'olim_member_status_note', 'olim_mstep1_title', 'olim_mstep2_title', 'olim_mstep3_title', 'olim_step_done', 'olim_member_final_title'] as const) expect(html).toContain(esc(t[key]))
    expect(html).toContain(`<a class="ds-btn ds-btn-inverse ds-btn-wrap shadow-[0_8px_24px_rgba(0,0,0,.18)]" href="/categories">${esc(t.olim_cta_explore)}`)
    expect(html).toContain(`<a href="#mentor-section" class="ds-btn ds-btn-outline-inverse ds-btn-wrap">${esc(t.olim_cta_mentor)}</a>`)
    expect(html).toContain(`href="/profile">${esc(t.olim_mstep1_link)}`)
    expect(html).toContain('<section id="mentor-section"')
    for (const key of ['olim_title', 'olim_free_badge', 'olim_step1_title', 'olim_final_title'] as const) expect(html).not.toContain(esc(t[key]))
    expect(html).not.toContain('href="/signup"')
  })

  it('holds the member greeting hidden until the profile is read', () => {
    signIn()
    mocks.profile = { profile: null, loaded: false, firstName: null }
    expect(render('en')).toMatch(/<h1 id="olim-title" class="[^"]*\binvisible\b/)
  })

  it('shows the guest copy, and no CTAs, while auth loads', () => {
    mocks.auth = { user: null, loading: true }
    const html = render('en')
    expect(html).toContain(esc(translations.en.olim_title))
    expect(html).not.toContain('href="/signup">')
    expect(html).not.toContain(esc(translations.en.olim_member_badge))
  })

  it('keeps old /olim#mentor links landing on the mentor card', () => {
    expect(render('en')).toMatch(/<div id="mentor" class="[^"]*scroll-mt-/)
  })

  it('drops the olim-only hero badge in every language', () => {
    for (const lang of Object.keys(translations) as Lang[]) expect(translations[lang].olim_hero_badge).not.toBe(translations[lang].olim_title)
    expect(translations.en.olim_hero_badge).toBe('Built for Newcomers, Lone Soldiers & the International Community')
    expect(translations.en.olim_cta_explore).toBe('Explore Community Perks')
  })
})
