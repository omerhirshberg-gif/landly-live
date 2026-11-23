import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { acceptedValues } from '@/components/admin/inventory/RaayonitStockModal'
import { en } from '@/lib/admin/translations/en'
import { he } from '@/lib/admin/translations/he'

const s = (poolId: string, v: number | null) => ({ poolId, title: '', faceValueAgorot: v })
describe('Raayonit stock upload', () => {
  it('lists every value ascending, or only the opened stock\'s', () => {
    const stocks = [s('a', 15000), s('b', 10000), s('c', 20000)]
    expect(acceptedValues(stocks)).toBe('100, 150, 200')
    expect(acceptedValues(stocks, stocks[2])).toBe('200')
  })
  it('no longer hard-codes 100 or 150 and keeps file names outside the translated text', () => {
    for (const text of [en['upload.formats'], he['upload.formats']]) { expect(text).toContain('{values}'); expect(text).not.toMatch(/\.xlsx|\.csv|150/) }
    const src = readFileSync(new URL('../../components/admin/inventory/RaayonitStockModal.tsx', import.meta.url), 'utf8')
    expect(src).toContain('<bdi dir="ltr">.xlsx</bdi>')
  })
  it('sorts the stock cards and the modal list by face value', () => {
    const page = readFileSync(new URL('../../app/admin/inventory/page.tsx', import.meta.url), 'utf8')
    expect(page.match(/\(a\.faceValueAgorot \?\? 0\) - \(b\.faceValueAgorot \?\? 0\)/g)).toHaveLength(2)
  })
})
