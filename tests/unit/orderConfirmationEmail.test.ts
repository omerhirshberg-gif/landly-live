import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { Timestamp } from 'firebase-admin/firestore'
import { TransactionStore } from '../helpers/transactionStore'
import { pending } from '../helpers/paymentFixtures'

const mocks = vi.hoisted(() => ({ send: vi.fn(), getUser: vi.fn(), after: vi.fn() }))
vi.mock('resend', () => ({ Resend: class { emails = { send: mocks.send } } }))
vi.mock('@/lib/firebase/admin', () => ({ getAdminAuth: () => ({ getUser: mocks.getUser }) }))
vi.mock('next/server', async (importOriginal) => ({ ...(await importOriginal<object>()), after: mocks.after }))

import { renderBrandedEmail } from '@/lib/email/brandedEmail'
import { buildOrderConfirmationEmail, type OrderConfirmationDetails } from '@/lib/email/sendOrderConfirmationEmail'
import { EMAIL_PREVIEW_DIR, scheduleOrderConfirmation, sendOrderConfirmation } from '@/lib/payments/orderConfirmation'
import { translations } from '@/lib/i18n/translations'

const ORIGIN = 'https://landly.test'
const details: OrderConfirmationDetails = {
  orderId: 'user_offer', displayOrderNumber: '#1001', paidAt: new Date('2026-10-18T09:30:00Z'),
  businessName: 'Café Tel Aviv', offerTitle: 'Two coffees for one',
  imageUrl: 'https://images.test/coffee.jpg', amount: 79.9, originalPrice: 100,
  voucherLink: `${ORIGIN}/member/vouchers/user_offer`,
}
const render = (lang: 'he' | 'en', order: OrderConfirmationDetails = details) =>
  renderBrandedEmail({ lang, origin: ORIGIN, ...buildOrderConfirmationEmail(lang, order) })

describe('order confirmation email', () => {
  it('renders the Hebrew confirmation right-to-left in the shared auth shell', () => {
    const html = render('he')
    const t = translations.he
    expect(html).toContain('<html lang="he" dir="rtl"')
    expect(html).toContain('איזה כיף, ההזמנה שלך אושרה! 🎉')
    expect(html).toContain('שולם ואושר ✅')
    expect(html).toContain('>#1001</span>')
    expect(html).not.toContain('#user_offer')
    expect(html).toContain('לצפייה ומימוש השובר')
    // Same shell as the auth emails: tagline, link fallback, security note, footer.
    for (const text of [t.email_tagline, t.email_linkFallback, t.email_securityTitle, t.email_footerSupport, t.footer_location]) {
      expect(html).toContain(text)
    }
    expect(html).toContain('border-right:3px solid #2563EB')
    // Button (VML and HTML) plus the copy-paste fallback all point at the voucher.
    expect(html.split(`href="${details.voucherLink}"`).length - 1).toBe(3)
  })

  it('shows the thumbnail, both prices and the savings badge', () => {
    const html = render('en')
    expect(html).toContain('src="https://images.test/coffee.jpg"')
    expect(html).toContain('₪79.90')
    expect(html).toContain('text-decoration:line-through;color:#94A3B8;">₪100</span>')
    expect(html).toContain('You saved ₪20.10!')
    expect(html).toContain('<html lang="en" dir="ltr"')
  })

  it('leaves out the savings and thumbnail when there are none', () => {
    const html = render('en', { ...details, originalPrice: null, imageUrl: '', amount: 50 })
    expect(html).not.toContain('You saved')
    expect(html).not.toContain('line-through')
    expect(html).not.toContain('<img src="https://images.test')
    expect(html).toContain('₪50')
  })

  it('escapes every member-visible value', () => {
    const html = render('en', { ...details, businessName: '<script>alert(1)</script>', offerTitle: '"><img src=x onerror=alert(1)>', orderId: 'a&b', displayOrderNumber: null })
    expect(html).not.toContain('<script>alert(1)')
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain('#a&amp;b')
  })

  it('falls back to the document id for an order settled before numbering', () => {
    const html = render('en', { ...details, displayOrderNumber: null })
    expect(html).toContain('>#user_offer</span>')
  })

  it('keeps the auth emails unchanged when no details are passed', () => {
    const t = translations.en
    const content = {
      heading: t.resetEmail_heading, body: t.resetEmail_body, buttonLabel: t.resetEmail_button,
      buttonLink: `${ORIGIN}/reset-password?oobCode=x`, footnote: t.resetEmail_ignoreNote,
    }
    const html = renderBrandedEmail({ lang: 'en', origin: ORIGIN, ...content })
    expect(renderBrandedEmail({ lang: 'en', origin: ORIGIN, ...content, detailsHtml: '' })).toBe(html)
    expect(html).not.toContain('padding:24px 40px 0 40px')
  })
})

describe('sending on settlement', () => {
  let store: TransactionStore
  const paid = { ...pending, status: 'paid', paidAt: Timestamp.fromMillis(Date.UTC(2026, 9, 18, 9, 30)), voucherId: 'user_offer', originalPrice: 20, orderNumber: 1007, displayOrderNumber: '#1007' }
  const preview = join(EMAIL_PREVIEW_DIR, 'order-user_offer.html')

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('APP_URL', `${ORIGIN}/`)
    vi.stubEnv('EMAIL_FROM', 'orders@landly.test')
    vi.stubEnv('RESEND_API_KEY', 'fake-test-key')
    store = new TransactionStore()
    store.seed('orders/user_offer', paid)
    store.seed('users/user', { preferredLanguage: 'he' })
    store.seed('offers/offer', { imageUrl: 'https://images.test/offer.jpg' })
    mocks.getUser.mockResolvedValue({ email: 'member@landly.test' })
    mocks.send.mockResolvedValue({ error: null })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
    rmSync(preview, { force: true })
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    rmSync(preview, { force: true })
  })

  it("emails the member in their language with a link to the voucher", async () => {
    await sendOrderConfirmation(store.db as never, 'user_offer')
    expect(mocks.getUser).toHaveBeenCalledWith('user')
    expect(mocks.send).toHaveBeenCalledOnce()
    const message = mocks.send.mock.calls[0]![0]
    expect(message).toMatchObject({ to: 'member@landly.test', from: 'orders@landly.test', subject: translations.he.orderEmail_subject })
    expect(message.html).toContain('dir="rtl"')
    expect(message.html).toContain(`href="${ORIGIN}/member/vouchers/user_offer"`)
    expect(message.html).toContain('src="https://images.test/offer.jpg"')
    expect(message.html).toContain('חסכת')
    expect(message.html).toContain('>#1007</span>')
  })

  it('writes a local preview instead of sending when dev has no Resend key', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('RESEND_API_KEY', '')
    await sendOrderConfirmation(store.db as never, 'user_offer')
    expect(mocks.send).not.toHaveBeenCalled()
    expect(existsSync(preview)).toBe(true)
    expect(readFileSync(preview, 'utf8')).toContain('שולם ואושר ✅')
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining('[email preview]'), expect.objectContaining({ preview }))
  })

  it('only logs a missing configuration in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('RESEND_API_KEY', '')
    await sendOrderConfirmation(store.db as never, 'user_offer')
    expect(mocks.send).not.toHaveBeenCalled()
    expect(existsSync(preview)).toBe(false)
    expect(console.error).toHaveBeenCalledWith('Order confirmation not sent', expect.objectContaining({ orderId: 'user_offer' }))
  })

  it('skips an order that is not paid', async () => {
    store.seed('orders/user_offer', pending)
    await sendOrderConfirmation(store.db as never, 'user_offer')
    expect(mocks.getUser).not.toHaveBeenCalled()
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it('never throws when the provider fails', async () => {
    mocks.send.mockResolvedValue({ error: { name: 'daily_quota_exceeded', statusCode: 429, message: 'quota' } })
    await expect(sendOrderConfirmation(store.db as never, 'user_offer')).resolves.toBeUndefined()
    expect(console.error).toHaveBeenCalledWith('Order confirmation email failed', { orderId: 'user_offer', reason: 'daily_quota_exceeded' })
  })

  it('defers the send until after the response, and still sends outside a request scope', async () => {
    scheduleOrderConfirmation(store.db as never, 'user_offer')
    expect(mocks.after).toHaveBeenCalledOnce()
    expect(mocks.send).not.toHaveBeenCalled()
    await mocks.after.mock.calls[0]![0]()
    expect(mocks.send).toHaveBeenCalledOnce()

    mocks.after.mockImplementation(() => { throw new Error('`after` was called outside a request scope') })
    expect(() => scheduleOrderConfirmation(store.db as never, 'user_offer')).not.toThrow()
    await vi.waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(2))
  })
})
