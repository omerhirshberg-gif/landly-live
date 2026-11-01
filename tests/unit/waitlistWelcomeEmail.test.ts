import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import type { Firestore } from 'firebase-admin/firestore'
import { TransactionStore } from '../helpers/transactionStore'

const mocks = vi.hoisted(() => ({ send: vi.fn(), after: vi.fn(), sync: vi.fn(), db: null as unknown }))
vi.mock('resend', () => ({ Resend: class { emails = { send: mocks.send } } }))
vi.mock('next/server', async (importOriginal) => ({ ...(await importOriginal<typeof import('next/server')>()), after: mocks.after }))
vi.mock('@/lib/firebase/admin', () => ({ getAdminDb: () => mocks.db }))
vi.mock('@/lib/marketing/ravMesser.server', () => ({ syncLeadToRavMesser: mocks.sync }))

import { POST } from '@/app/api/prelaunch/route'
import { WAITLIST_WELCOME_COPY, renderWaitlistWelcomeEmail, sendWaitlistWelcomeEmail } from '@/lib/email/sendWaitlistWelcomeEmail'
import { escapeHtml } from '@/lib/email/brandedEmail'
import { translations, type Lang } from '@/lib/i18n/translations'

const LANGS: Lang[] = ['en', 'he', 'ru', 'fr', 'es']
const LEAD = { firstName: 'Noa', lastName: 'Cohen', phone: '+972501234567', email: 'noa@example.com', lang: 'he' }
const PATH = 'prelaunch_leads/lead1'

// TransactionStore's references have no update(); the release needs one that
// removes a FieldValue.delete() field, as Firestore would.
class LeadStore extends TransactionStore {
  releaseFails = false
  private readonly base = this.db
  readonly leadDb = {
    runTransaction: (work: never) => this.base.runTransaction(work),
    collection: (name: string) => ({
      doc: (id: string) => ({
        ...this.base.collection(name).doc(id),
        update: async (patch: Record<string, unknown>) => {
          if (this.releaseFails) throw new Error('offline')
          const path = `${name}/${id}`
          const next = { ...this.read(path) }
          for (const key of Object.keys(patch)) delete next[key]
          this.seed(path, next)
        },
      }),
    }),
  } as unknown as Firestore
}

function seed(data: Record<string, unknown> = LEAD) {
  const store = new LeadStore()
  store.seed(PATH, data)
  return store
}

beforeEach(() => {
  vi.stubEnv('RESEND_API_KEY', 're_test')
  vi.stubEnv('EMAIL_FROM', 'Landly <noreply@golandly.com>')
  mocks.send.mockReset().mockResolvedValue({ data: { id: 'm1' }, error: null })
  mocks.after.mockReset()
  mocks.sync.mockReset().mockResolvedValue('synced')
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('renderWaitlistWelcomeEmail', () => {
  it('matches the saved English template', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-01T12:00:00Z'), toFake: ['Date'] })
    await expect(renderWaitlistWelcomeEmail('en', 'Noa')).toMatchFileSnapshot('../../email-templates/waitlist-welcome.html')
  })

  it.each(LANGS)('is complete and self-contained in %s', (lang) => {
    const html = renderWaitlistWelcomeEmail(lang, 'Noa')
    const copy = WAITLIST_WELCOME_COPY[lang]
    expect(html).toContain(`lang="${lang}" dir="${lang === 'he' ? 'rtl' : 'ltr'}"`)
    expect(html).not.toMatch(/<style|<script|<svg|class=|\{name\}|\{date\}|\{network\}|undefined/)
    expect(html).toContain(escapeHtml(copy.headline))
    expect(html).toContain(translations[lang].footer_location)
    expect(copy.launchDate, 'the sentence supplies the full stop').not.toMatch(/\.$/)
    expect(html).toContain('max-width:580px')
    expect(html).toContain('0 4px 12px rgba(15,23,42,0.04)')
    expect(html).toContain('bgcolor="#0038B8"')
    expect(html.match(/contact@golandly\.com<\/a>/g)).toHaveLength(2)
    expect(html).toContain('unsubscribe')
    for (const { title } of copy.perks) expect(html).toContain(title)
  })

  it('has one 25% cell per network, each a new-tab link with a tooltip and a text label', () => {
    const html = renderWaitlistWelcomeEmail('en', 'Noa')
    const cells = [...html.matchAll(/<td width="25%"[\s\S]*?<\/td>/g)].map((m) => m[0])
    expect(cells).toHaveLength(4)
    const expected = [
      ['Instagram', 'https://www.instagram.com/golandly/'],
      ['LinkedIn', 'https://www.linkedin.com/company/golandly/'],
      ['WhatsApp', 'https://www.golandly.com/whatsapp'],
      ['Facebook', 'https://www.facebook.com/golandly/'],
    ]
    expected.forEach(([name, href], i) => {
      expect(cells[i]).toContain(`href="${href}"`)
      expect(cells[i]).toContain(`title="Landly on ${name}"`)
      expect(cells[i]).toContain('target="_blank" rel="noopener noreferrer"')
      expect(cells[i]).toContain(`src="https://www.golandly.com/email/${name.toLowerCase()}.png"`)
      expect(cells[i]).toMatch(new RegExp(`\\s${name}\\s+</a>`))
    })
  })

  it('points the button at /whatsapp in WhatsApp green', () => {
    const html = renderWaitlistWelcomeEmail('en', 'Noa')
    expect(html).toContain('<a href="https://www.golandly.com/whatsapp" target="_blank" rel="noopener noreferrer" style="display:inline-block;background-color:#25D366')
    expect(html).toContain('fillcolor="#25D366"')
  })

  it('escapes the name and isolates its direction', () => {
    const html = renderWaitlistWelcomeEmail('he', '<img src=x onerror=1>')
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('<span dir="auto" style="unicode-bidi:isolate;">&lt;img src=x onerror=1&gt;</span>')
  })

  it('accepts a name holding the placeholder text without touching the rest', () => {
    expect(renderWaitlistWelcomeEmail('en', '$& {date}')).toContain('$&amp; {date}')
  })
})

describe('sendWaitlistWelcomeEmail', () => {
  it('sends once, in the lead\'s language, with the sender, reply address and idempotency key', async () => {
    const store = seed()
    expect(await sendWaitlistWelcomeEmail(store.leadDb, 'lead1')).toBe('sent')
    expect(mocks.send).toHaveBeenCalledTimes(1)
    const [payload, options] = mocks.send.mock.calls[0]
    expect(payload).toMatchObject({ from: 'Landly <noreply@golandly.com>', to: 'noa@example.com', replyTo: 'contact@golandly.com', subject: WAITLIST_WELCOME_COPY.he.subject })
    expect(payload.html).toContain('dir="rtl"')
    expect(options).toEqual({ idempotencyKey: 'waitlist-welcome/lead1' })
    expect(store.snapshot()[PATH].welcomeEmailSent).toBe(true)
  })

  it('never sends a second time', async () => {
    const store = seed()
    await sendWaitlistWelcomeEmail(store.leadDb, 'lead1')
    expect(await sendWaitlistWelcomeEmail(store.leadDb, 'lead1')).toBe('already-sent')
    expect(mocks.send).toHaveBeenCalledTimes(1)
  })

  it('skips a lead that already has the flag and one that no longer exists', async () => {
    expect(await sendWaitlistWelcomeEmail(seed({ ...LEAD, welcomeEmailSent: true }).leadDb, 'lead1')).toBe('already-sent')
    expect(await sendWaitlistWelcomeEmail(new LeadStore().leadDb, 'gone')).toBe('already-sent')
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it.each(['RESEND_API_KEY', 'EMAIL_FROM'])('without %s: logs no personal data, claims nothing and does not throw', async (name) => {
    vi.stubEnv(name, '')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const store = seed()
    expect(await sendWaitlistWelcomeEmail(store.leadDb, 'lead1')).toBe('skipped')
    expect(mocks.send).not.toHaveBeenCalled()
    expect(store.snapshot()[PATH].welcomeEmailSent).toBeUndefined()
    expect(JSON.stringify(warn.mock.calls)).toContain('lead1')
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(/noa@example|Noa|Cohen|\+972/)
  })

  it.each([
    ['refuses', () => mocks.send.mockResolvedValue({ data: null, error: { name: 'validation_error', message: 'bad noa@example.com', statusCode: 422 } })],
    ['throws', () => mocks.send.mockRejectedValue(new TypeError('network down for noa@example.com'))],
  ])('when Resend %s: gives the claim back, keeps the address out of the log and does not throw', async (_, arrange) => {
    arrange()
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const store = seed()
    expect(await sendWaitlistWelcomeEmail(store.leadDb, 'lead1')).toBe('failed')
    expect(store.snapshot()[PATH].welcomeEmailSent).toBeUndefined()
    expect(store.snapshot()[PATH].welcomeEmailSentAt).toBeUndefined()
    expect(JSON.stringify(error.mock.calls)).not.toContain('noa@example.com')
  })

  it('does not throw when the claim cannot be given back', async () => {
    mocks.send.mockRejectedValue(new Error('down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const store = seed()
    store.releaseFails = true
    expect(await sendWaitlistWelcomeEmail(store.leadDb, 'lead1')).toBe('failed')
  })

  it('falls back to English for an unknown language', async () => {
    await sendWaitlistWelcomeEmail(seed({ ...LEAD, lang: 'de' }).leadDb, 'lead1')
    expect(mocks.send.mock.calls[0][0].subject).toBe(WAITLIST_WELCOME_COPY.en.subject)
  })
})

describe('POST /api/prelaunch', () => {
  const body = { firstName: 'Noa', lastName: 'Cohen', phone: '+972501234567', email: 'noa@example.com', consent: true, lang: 'en' }
  const post = () => POST(new Request('http://localhost/api/prelaunch', { method: 'POST', body: JSON.stringify(body) }))

  it('answers before the email starts, sends it for a new lead, and not for a repeat', async () => {
    mocks.db = new TransactionStore().db
    expect((await post()).status).toBe(200)
    expect(mocks.send).not.toHaveBeenCalled()
    await mocks.after.mock.calls[0][0]()
    expect(mocks.send).toHaveBeenCalledTimes(1)
    expect(mocks.sync).toHaveBeenCalledTimes(1)
    expect((await post()).status).toBe(200)
    expect(mocks.after).toHaveBeenCalledTimes(1)
  })

  it('still answers 200 when the email fails', async () => {
    mocks.db = new LeadStore().leadDb
    mocks.send.mockRejectedValue(new Error('down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await post()).status).toBe(200)
    await expect(mocks.after.mock.calls[0][0]()).resolves.toBeDefined()
  })
})

describe('privacy policy', () => {
  it('names the waiting-list confirmation under Resend in every language', () => {
    const words: Record<Lang, string> = { en: 'launch waiting list', he: 'רשימת ההמתנה', ru: 'лист ожидания', fr: "liste d'attente", es: 'lista de espera' }
    for (const lang of LANGS) expect(translations[lang].pp_providers_4).toContain(words[lang])
  })
})

describe('email assets', () => {
  it.each(['instagram', 'linkedin', 'whatsapp', 'facebook'])('%s.png is a 96x96 PNG', (name) => {
    const png = readFileSync(`public/email/${name}.png`)
    expect(png.subarray(1, 4).toString()).toBe('PNG')
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([96, 96])
  })
})
