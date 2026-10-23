import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LangContext } from '@/lib/i18n/LangProvider'
import { RTL_LANGS, translations, Lang, TranslationKey } from '@/lib/i18n/translations'
import { formatRedeemedDate } from '@/lib/format'

vi.mock('@/lib/firebase/orders', () => ({ getOrdersByIds: vi.fn() }))
vi.mock('@/lib/firebase/offers', () => ({ getOffer: vi.fn() }))
const { getOrdersByIds } = await import('@/lib/firebase/orders')
const { getOffer } = await import('@/lib/firebase/offers')
const { loadVoucherOffer } = await import('@/lib/member/useVoucherOffer')
const { sumSavings, totalSaved } = await import('@/lib/member/savings')
const { default: DashboardStats } = await import('@/components/member/DashboardStats')
const { default: RedeemedTab } = await import('@/components/member/RedeemedTab')
const { default: PerksTab } = await import('@/components/member/PerksTab')

function withLang(lang: Lang, element: ReturnType<typeof createElement>) {
  const t = (key: TranslationKey) => translations[lang][key]
  const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
  return renderToStaticMarkup(createElement(LangContext.Provider, { value: { lang, setLang: () => {}, t, isRtl } }, element))
}

const voucher = (id: string, offerId: string, redeemedAt: Date | null = new Date(2026, 9, 17)) => ({
  id,
  userId: 'u1',
  offerId,
  businessId: 'b1',
  businessName: 'Cafe Nadi',
  offerTitle: 'Two coffees',
  redemptionCode: 'ABC123',
  redeemToken: null,
  status: 'redeemed' as const,
  takenAt: null,
  redeemedAt,
  expiresAt: null,
  redemptionTerms: '',
  redemptionMethod: 'in_store' as const,
  redemptionInstructions: '', orderNumber: null, displayOrderNumber: null,
})

describe('sumSavings', () => {
  const paid = (originalPrice: number | null, amount: number) => ({ status: 'paid' as const, originalPrice, amount })

  it('adds the frozen original price minus what was paid, for every paid order', () => {
    expect(sumSavings([paid(24, 15), paid(100, 60)])).toBe(49)
  })

  it('counts unpaid, unreadable, undiscounted and price-rise orders as 0', () => {
    expect(sumSavings([{ status: 'refunded', originalPrice: 50, amount: 10 }, null, paid(null, 15), paid(50, 70), paid(24, 15)])).toBe(9)
  })

  it('adds in agorot, without floating-point drift', () => {
    expect(sumSavings([paid(0.3, 0.2), paid(0.3, 0.1)])).toBe(0.3)
  })
})

describe('totalSaved', () => {
  it("reads each voucher's own order (same id) once and skips the read with no vouchers", async () => {
    vi.mocked(getOrdersByIds).mockResolvedValue([{ status: 'paid', originalPrice: 24, amount: 15 }] as never)
    expect(await totalSaved([{ id: 'u1_o1' }, { id: 'u1_o1' }])).toBe(9)
    expect(getOrdersByIds).toHaveBeenCalledWith(['u1_o1'])
    vi.mocked(getOrdersByIds).mockClear()
    expect(await totalSaved([])).toBe(0)
    expect(getOrdersByIds).not.toHaveBeenCalled()
  })
})

describe('loadVoucherOffer', () => {
  it('reads each offer once for the session, however many cards ask', async () => {
    vi.mocked(getOffer).mockResolvedValue({ id: 'cache1', imageUrl: 'https://x/y.jpg' } as never)
    const [a, b] = await Promise.all([loadVoucherOffer('cache1'), loadVoucherOffer('cache1')])
    expect(await loadVoucherOffer('cache1')).toBe(a)
    expect(b).toBe(a)
    expect(getOffer).toHaveBeenCalledTimes(1)
    vi.mocked(getOffer).mockReset()
  })

  it("doesn't cache a failed read, so the next card retries", async () => {
    vi.mocked(getOffer).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(null)
    expect(await loadVoucherOffer('cache2')).toBeNull()
    expect(await loadVoucherOffer('cache2')).toBeNull()
    expect(getOffer).toHaveBeenCalledTimes(2)
    vi.mocked(getOffer).mockReset()
  })
})

describe('member dashboard live data', () => {
  it('makes each active voucher one link to its page, with a start-side thumbnail slot', () => {
    vi.mocked(getOffer).mockReturnValue(new Promise(() => {}))
    const html = withLang('he', createElement(PerksTab, { vouchers: [{ ...voucher('u1_o1', 'o1'), status: 'active' as const, redeemedAt: null }] }))
    expect(html.match(/<a /g)).toHaveLength(1)
    expect(html).toContain('href="/member/vouchers/u1_o1"')
    expect(html).toContain(translations.he.voucher_show_button)
    // The thumbnail comes first in the row, so it sits on the start side in either direction.
    expect(html.indexOf('h-16 w-16')).toBeLessThan(html.indexOf('Cafe Nadi'))
    vi.mocked(getOffer).mockReset()
  })

  it('ends each voucher card with a chevron, not a separate View Voucher button', () => {
    vi.mocked(getOffer).mockReturnValue(new Promise(() => {}))
    const html = withLang('he', createElement(PerksTab, { vouchers: [{ ...voucher('u1_o1', 'o1'), status: 'active' as const, redeemedAt: null }] }))
    // The label is for screen readers only; the chevron (mirrored in Hebrew) is the visible cue.
    expect(html).toContain(`<span class="sr-only">${translations.he.voucher_show_button}</span>`)
    expect(html).toMatch(/<i class="fa-solid fa-chevron-right [^"]*rtl:-scale-x-100[^"]*" aria-hidden="true"><\/i><\/a>/)
    expect(html).not.toContain('bg-brand')
    expect(html).not.toContain('<button')
    vi.mocked(getOffer).mockReset()
  })

  it('mutes the redeemed thumbnail', () => {
    vi.mocked(getOffer).mockReturnValue(new Promise(() => {}))
    const html = withLang('en', createElement(RedeemedTab, { vouchers: [voucher('v1', 'o1')] }))
    expect(html).toContain('grayscale-[40%]')
    vi.mocked(getOffer).mockReset()
  })

  it('shows "–" for stats that are still loading', () => {
    const html = withLang('en', createElement(DashboardStats, { activePerks: 2, redeemed: null, saved: null }))
    expect(html.match(/>(2|–)<\/div><\/div>/g)).toEqual(['>2</div></div>', '>–</div></div>', '>–</div></div>'])
  })

  it.each(['en', 'he'] as const)('lists redeemed vouchers with the date and no QR (%s)', (lang) => {
    const html = withLang(lang, createElement(RedeemedTab, { vouchers: [voucher('v1', 'o1')] }))
    expect(html).toContain('Cafe Nadi')
    expect(html).toContain('Two coffees')
    expect(html).toContain(translations[lang].mobile_redeemed_on.replace('{date}', formatRedeemedDate(new Date(2026, 9, 17), lang)))
    expect(html).not.toMatch(/<svg|<canvas|qr/i)
  })

  it('keeps the receipt empty state with nothing redeemed', () => {
    const html = withLang('en', createElement(RedeemedTab, { vouchers: [] }))
    expect(html).toContain('fa-receipt')
    expect(html).toContain(translations.en.dash_redeemed_empty_title)
  })
})
