import { describe, expect, it, vi } from 'vitest'

// 74 network pages less the suspended one: the 73 an empty project once reported as "unknown network pages".
const NETWORK_KEYS = Array.from({ length: 73 }, (_, i) => String(i + 4))
vi.mock('@/lib/inventory/raayonitLiveDiff', async (original) => ({
  ...(await original<typeof import('@/lib/inventory/raayonitLiveDiff')>()),
  parseLiveDirectory: () => ({
    rows: Array.from({ length: 160 }, (_, i) => ({ sid: String(i) })),
    sections: Array.from({ length: 6 }, (_, i) => ({ id: String(i) })),
    entries: [
      ...Array.from({ length: 160 }, (_, i) => ({ key: `l-${i}`, nameHe: `עסק ${i}`, nameEn: '', source: 'listing' as const })),
      ...NETWORK_KEYS.map((key) => ({ key, nameHe: '', nameEn: '', source: 'network' as const })),
    ],
    suspended: [],
  }),
}))

import { EMPTY_CATALOGUE_REASON, MAX_ADDITIONS, emptyCatalogueProblem, runDailySync, unknownPagesProblem } from '@/lib/inventory/raayonitDailySync'

const html = '<html>תו על</html>'
const fetcher = (async () => new Response(html, { headers: { 'content-type': 'text/html' } })) as unknown as typeof fetch
const dbWith = (cards: Record<string, unknown>[]) => ({
  collection: () => ({ where: () => ({ get: async () => ({ docs: cards.map((data, i) => ({ id: `c${i}`, data: () => data })) }) }) }),
}) as never

describe('empty-catalogue guard', () => {
  it('names the real cause, not the directory', () => {
    expect(emptyCatalogueProblem(0)).toBe(EMPTY_CATALOGUE_REASON)
    expect(emptyCatalogueProblem(1)).toBeNull()
    expect(EMPTY_CATALOGUE_REASON).not.toMatch(/unknown network pages/)
    expect(EMPTY_CATALOGUE_REASON).toMatch(/promotion\/seed script/)
  })

  it('aborts a project with zero Raayonit cards with that reason and nothing unresolved', async () => {
    const report = await runDailySync(dbWith([]), { dry: true }, { fetcher })
    expect(report.status).toBe('aborted_guard')
    expect(report.abortReason).toBe(EMPTY_CATALOGUE_REASON)
    expect(report.unresolved).toBeUndefined()
    expect(report.counts.liveBrands).toBe(233)
  })
})

describe('unknown-pages guard on a non-empty catalogue', () => {
  it('lists the unresolved NetworkNum keys and the existing count', async () => {
    const report = await runDailySync(dbWith([{ sourceKey: 'raayonit:l-0', brandName: 'עסק 0' }]), { dry: true }, { fetcher })
    expect(report.status).toBe('aborted_guard')
    expect(report.abortReason).toMatch(/^73 unknown network pages \(limit 25\), NetworkNum: 4, 5, 6/)
    expect(report.unresolved).toEqual(NETWORK_KEYS)
    expect(report.counts.existing).toBe(1)
  })

  it('keeps the safety limit at 25 and truncates a long key list in the text only', () => {
    expect(MAX_ADDITIONS).toBe(25)
    const text = unknownPagesProblem(NETWORK_KEYS)
    expect(text).toMatch(/…$/)
    expect(text).toContain('33')
    expect(unknownPagesProblem(['7', '9'])).toBe('2 unknown network pages (limit 25), NetworkNum: 7, 9')
  })
})
