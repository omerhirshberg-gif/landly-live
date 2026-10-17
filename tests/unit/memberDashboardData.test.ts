import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LangContext } from '@/lib/i18n/LangProvider'
import { RTL_LANGS, translations, Lang, TranslationKey } from '@/lib/i18n/translations'
import { formatRedeemedDate } from '@/lib/format'

vi.mock('@/lib/firebase/offers', () => ({ getOffersByIds: vi.fn() }))
const { getOffersByIds } = await import('@/lib/firebase/offers')
const { sumSavings, totalSaved } = await import('@/lib/member/savings')
const { default: DashboardStats } = await import('@/components/member/DashboardStats')
const { default: RedeemedTab } = await import('@/components/member/RedeemedTab')

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
  status: 'redeemed' as const,
  takenAt: null,
  redeemedAt,
})

describe('sumSavings', () => {
  const offers = [
    { id: 'o1', originalPrice: 100, offerPrice: 60 },
    { id: 'o2', originalPrice: 50, offerPrice: 70 },
  ]

  it('adds original minus paid for every redeemed voucher, counting repeats', () => {
    expect(sumSavings([{ offerId: 'o1' }, { offerId: 'o1' }], offers)).toBe(80)
  })

  it('counts a deleted offer and a price rise as 0', () => {
    expect(sumSavings([{ offerId: 'gone' }, { offerId: 'o2' }, { offerId: 'o1' }], offers)).toBe(40)
  })
})

describe('totalSaved', () => {
  it('reads each offer once and skips the read with nothing redeemed', async () => {
    vi.mocked(getOffersByIds).mockResolvedValue([{ id: 'o1', originalPrice: 100, offerPrice: 75 }] as never)
    expect(await totalSaved([{ offerId: 'o1' }, { offerId: 'o1' }])).toBe(50)
    expect(getOffersByIds).toHaveBeenCalledWith(['o1'])
    vi.mocked(getOffersByIds).mockClear()
    expect(await totalSaved([])).toBe(0)
    expect(getOffersByIds).not.toHaveBeenCalled()
  })
})

describe('member dashboard live data', () => {
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
