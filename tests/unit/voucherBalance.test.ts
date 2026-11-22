import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { existsSync, readFileSync } from 'node:fs'
import { LangContext } from '@/lib/i18n/LangProvider'
import { RTL_LANGS, translations, type Lang, type TranslationKey } from '@/lib/i18n/translations'
import { balanceAmount, resolveVoucherRedemptionProgress, voucherFaceValueText } from '@/lib/vouchers/redemptionProgress'

const read = (p: string) => readFileSync(p, 'utf8')
const LANGS = ['en', 'he', 'ru', 'es', 'fr'] as const
const base = { amountAgorot: 7900, faceValueAgorot: 10000 }

describe('the balance follows the voucher state', () => {
  it('active: the whole value is available', () => {
    expect(resolveVoucherRedemptionProgress({ ...base, status: 'active' })).toEqual({ redeemedAgorot: 0, faceValueAgorot: 10000, remainingAgorot: 10000 })
  })
  it('partly used: the rest is available', () => {
    const p = resolveVoucherRedemptionProgress({ ...base, status: 'active', redeemedAgorot: 3000 })!
    expect(p.remainingAgorot).toBe(7000)
    expect(balanceAmount(p)).toBe('⁦₪70⁩')
  })
  it('redeemed: nothing is left, whatever was recorded', () => {
    expect(resolveVoucherRedemptionProgress({ ...base, status: 'redeemed' })!.remainingAgorot).toBe(0)
    expect(resolveVoucherRedemptionProgress({ ...base, status: 'redeemed', redeemedAgorot: 100 })!.remainingAgorot).toBe(0)
    expect(resolveVoucherRedemptionProgress({ ...base, status: 'active', redeemedAgorot: 99999 })!.remainingAgorot).toBe(0)
  })
  it('free perk: no balance and no face value', () => {
    expect(resolveVoucherRedemptionProgress({ amountAgorot: 0, status: 'active' })).toBeNull()
    expect(voucherFaceValueText({ amountAgorot: 0 })).toBeNull()
  })
  it('the cover shows the face value', () => {
    expect(voucherFaceValueText(base)).toBe('₪100')
    expect(voucherFaceValueText({ amountAgorot: 12900, faceValueAgorot: 15000 })).toBe('₪150')
  })
})

describe('one clean line, nothing else', () => {
  it.each(LANGS)('says "%s" balance with the amount isolated left to right', async (lang) => {
    const { default: VoucherBalance } = await import('@/components/member/VoucherBalance')
    const t = (k: TranslationKey) => translations[lang][k]
    const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
    const render = (v: object, variant: 'card' | 'detail') => renderToStaticMarkup(createElement(LangContext.Provider, { value: { lang: lang as Lang, setLang: () => {}, t, isRtl } }, createElement(VoucherBalance, { voucher: v, variant })))
    for (const variant of ['card', 'detail'] as const) {
      const html = render({ ...base, status: 'active', redeemedAgorot: 3000 }, variant)
      expect(html).toContain('<bdi dir="ltr" class="tabular-nums">⁦₪70⁩</bdi>')
      expect(html).not.toMatch(/₪[0-9]+ ?\/ ?₪/)
      expect(html).not.toContain('progressbar')
      expect(html).not.toContain('<button')
      expect(render({ ...base, status: 'redeemed' }, variant)).toContain('₪0')
      expect(render({ amountAgorot: 0, status: 'active' }, variant)).toBe('')
    }
  })
  it('has the exact copy, in all five languages', () => {
    expect(translations.en.voucher_balance_available).toBe('Available balance: {amount}')
    expect(translations.he.voucher_balance_available).toBe('יתרה למימוש: {amount}')
    for (const l of LANGS) expect(translations[l].voucher_balance_available).toContain('{amount}')
  })
  it('has no slash ratio, progress bar, manual balance control or balance route', () => {
    for (const p of ['components/member/VoucherBalance.tsx', 'landly-mobile/src/components/VoucherBalance.tsx', 'components/member/PerksTab.tsx', 'landly-mobile/src/components/VoucherPass.tsx', 'app/member/vouchers/[voucherId]/page.tsx', 'landly-mobile/src/app/voucher/[voucherId].tsx']) {
      const src = read(p)
      for (const bad of ['voucher_balance_update', 'voucher_balance_subline', 'voucher_redeemed_ratio', 'value_ratio_label', 'formatValueRatio', 'formatRedemptionRatio', 'progressbar', 'BalanceSheet', 'updateVoucherBalance']) expect(src, `${p} ${bad}`).not.toContain(bad)
    }
    for (const gone of ['app/api/member', 'lib/vouchers/balanceUpdate.ts', 'lib/vouchers/balanceClient.ts', 'components/member/BalanceSheet.tsx', 'components/member/ValueRatio.tsx', 'landly-mobile/src/components/ValueRatio.tsx']) expect(existsSync(gone), gone).toBe(false)
  })
  it('the voucher page puts the balance, then the expiry, directly under the cover', () => {
    const page = read('app/member/vouchers/[voucherId]/page.tsx')
    expect(page.indexOf('<VoucherCover')).toBeLessThan(page.indexOf('<VoucherBalance'))
    expect(page.indexOf('<VoucherBalance')).toBeLessThan(page.indexOf('voucher_valid_until'))
    expect(page.indexOf('voucher_valid_until')).toBeLessThan(page.indexOf('{headline ? ('))
    for (const p of ['components/member/VoucherCover.tsx', 'landly-mobile/src/components/VoucherCover.tsx']) expect(read(p)).toContain('voucherFaceValueText')
  })
})
