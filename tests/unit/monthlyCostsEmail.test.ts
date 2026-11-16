import { describe, expect, it } from 'vitest'
import { buildCostsCsv, buildMonthlyCostsEmail, costRows, costTotals, fixedRows, formatUnitPrice } from '@/lib/usage/monthlyCostsEmail'
import { netCostIls, SKUS, VAT_RATE } from '@/lib/usage/pricing'
import { buildUsageReport, type FxInfo } from '@/lib/usage/usageReport'
import { emptyCounters } from '@/lib/usage/usageTypes'

const fx: FxInfo = { usdToIls: 3.2, updatedAt: '2026-11-16T05:00:00.000Z', source: 'boi', stale: false, verifiedAt: '2026-11' }

function report(overrides: Partial<FxInfo> = {}) {
  const counters = emptyCounters()
  counters.google.translation.chars = 1_500_000 // 1,000,000 billable
  counters.gateway019.smsOtpSent = 100 // 2.00 ILS
  counters.gateway019.whatsappOtpSent = 40 // 3.00 ILS
  counters.resend.emailsSent = 200
  return buildUsageReport({ month: '2026-11', months: ['2026-11'], projectId: 'landly-be752', counters, fx: { ...fx, ...overrides } })
}

describe('VAT arithmetic', () => {
  it('adds 18% to every net line and to the total', () => {
    const rows = costRows(report())
    for (const row of rows) {
      expect(row.vatIls).toBeCloseTo(row.netIls * 0.18, 10)
      expect(row.grossIls).toBeCloseTo(row.netIls * 1.18, 10)
    }
    const totals = costTotals(rows)
    // Translate: 1,000,000 x $0.00002 x 3.2 = 64 ILS; 019: 2 + 3 ILS; Resend inside its free tier.
    expect(totals.netIls).toBeCloseTo(64 + 5, 6)
    expect(totals.vatIls).toBeCloseTo(69 * VAT_RATE, 6)
    expect(totals.grossIls).toBeCloseTo(69 * 1.18, 6)
    // Vercel Pro $20 x 3.2 = 64 ILS joins it in the combined outlay.
    const { outlay } = report()
    expect(outlay.fixed.netIls).toBeCloseTo(64, 6)
    expect(outlay.total.netIls).toBeCloseTo(133, 6)
    expect(outlay.total.vatIls).toBeCloseTo(133 * 0.18, 6)
    expect(outlay.total.grossIls).toBeCloseTo(133 * 1.18, 6)
    expect(fixedRows(report()).map((row) => row.id)).toEqual(['vercelPro', 'resend', 'tranzila'])
  })

  it('prices dollar SKUs at the live rate in the report', () => {
    const translate = SKUS.find((sku) => sku.id === 'translation')!
    expect(netCostIls(translate, 1_500_000, 3.2)).toBeCloseTo(64, 6)
    expect(report().fx.usdToIls).toBe(3.2)
    expect(report().usdToIlsRate).toBe(3.2)
    expect(report().rateUpdatedAt).toBe(fx.updatedAt)
  })
})

describe('CSV', () => {
  const csv = buildCostsCsv(report())
  it('starts with a UTF-8 BOM, uses CRLF and ends with a TOTAL row', () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(Buffer.from(csv, 'utf8').subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]))
    const lines = csv.trimEnd().split('\r\n')
    expect(lines[0]).toBe('\uFEFFMonth,Kind,Vendor,Service,Unit,Used,Free allowance,Billable units,Unit rate,Rate currency,USD/ILS rate,Net ILS,VAT 18% ILS,Gross ILS,Status')
    expect(lines.at(-3)).toBe('2026-11,total,,SUBTOTAL METERED,,,,,,,3.2,69.00,12.42,81.42,')
    expect(lines.at(-2)).toBe('2026-11,total,,SUBTOTAL FIXED,,,,,,,3.2,64.00,11.52,75.52,')
    expect(lines.at(-1)).toBe('2026-11,total,,TOTAL,,,,,,,3.2,133.00,23.94,156.94,')
    expect(csv.endsWith('\r\n')).toBe(true)
  })
  it('lists the fixed rows: Vercel Pro in shekels at the live rate, Resend against its free tier, Tranzila not configured', () => {
    const fixed = csv.split('\r\n').filter((line) => line.startsWith('2026-11,fixed,'))
    expect(fixed).toEqual([
      '2026-11,fixed,Vercel,Vercel Pro,month,,,,20,USD,3.2,64.00,11.52,75.52,billed',
      '2026-11,fixed,Resend Email,Resend,emails,200,3000,,,,,0.00,0.00,0.00,free tier',
      '2026-11,fixed,Tranzila,Tranzila,payments,,,,,,,0.00,0.00,0.00,not configured',
    ])
  })
  it('prefixes cells that start like a formula and quotes commas and quotes', () => {
    const r = report()
    r.groups[0].lines[0].service = '=HYPERLINK("x","y")'
    r.groups[0].label = '+cmd, "Inc"'
    const out = buildCostsCsv(r)
    expect(out).toContain(`"'=HYPERLINK(""x"",""y"")"`)
    expect(out).toContain(`"'+cmd, ""Inc"""`)
    expect(out).not.toMatch(/(^|,)=HYPERLINK/m)
  })
})

describe('email', () => {
  it('builds an English summary with the KPIs, the rate and its date', () => {
    const email = buildMonthlyCostsEmail(report())
    expect(email.subject).toBe('GoLandly usage & costs 2026-11')
    expect(email.csvFilename).toBe('golandly-costs-2026-11.csv')
    expect(email.html).toContain('dir="ltr"')
    expect(email.html).toContain('1 USD = 3.2 ILS')
    expect(email.html).toContain('2026-11-16')
    expect(email.html).toContain('Fixed subscriptions and platform tiers')
    expect(email.html).toContain('Vercel Pro')
    expect(email.html).toContain('Plan fee only, overages not metered here')
    expect(email.html.replace(/<[^>]+>/g, '')).toContain('200 / 3,000 emails')
    expect(email.html).toContain('Not configured yet, infrastructure ready')
    expect(email.html).toContain('Total monthly outlay')
    expect(email.html).toContain('₪156.94')
    expect(email.html).toContain('<bdi dir="ltr"')
    expect(email.text).toContain('Grand total')
  })
  it('renders Hebrew right-to-left and warns about a stale or default rate', () => {
    const he = buildMonthlyCostsEmail(report({ stale: true }), 'he')
    expect(he.html).toContain('lang="he" dir="rtl"')
    expect(he.html).toContain('דוח שימוש ועלויות')
    expect(he.html).toContain('מנויים קבועים ושכבות פלטפורמה')
    expect(he.html).toContain('מקור השער החי לא היה זמין')
    expect(buildMonthlyCostsEmail(report({ source: 'default', updatedAt: null })).html).toContain('built-in default rate')
  })
  it('contains no emoji', () => {
    expect(buildMonthlyCostsEmail(report(), 'he').html).not.toMatch(/\p{Extended_Pictographic}/u)
  })
  it('formats unit prices', () => {
    expect(formatUnitPrice({ amount: 0.00002, currency: 'USD' })).toBe('$0.00002')
    expect(formatUnitPrice({ amount: 0.005, currency: 'USD' })).toBe('$0.005')
    expect(formatUnitPrice({ amount: 20, currency: 'USD' })).toBe('$20.00')
    expect(formatUnitPrice({ amount: 0.075, currency: 'ILS' })).toContain('0.075')
  })
})
