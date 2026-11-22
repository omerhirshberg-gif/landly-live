import { beforeAll, describe, expect, it } from 'vitest'
import { randomBytes } from 'node:crypto'
import { contentHash, validateRows, batchIdFor } from '@/lib/inventory/ledger/importBatch'
import { decryptVoucherCode, hashCode } from '@/lib/inventory/ledger/codes'

beforeAll(() => { process.env.POOL_CODES_KEY = randomBytes(32).toString('base64') })

const products = new Map([[10000, 'p100'], [15000, 'p150'], [20000, 'p200'], [25000, 'p250']])

describe('import validation', () => {
  it('accepts valid rows for every supported face value and totals them', () => {
    const r = validateRows([{ code: 'AAAA1111', amount: 100 }, { code: 'BBBB2222', amount: '150 ₪' }, { code: 'CCCC3333', amount: '200' }, { code: 'DDDD4444', amount: 250 }], products)
    expect(r.valid.map((v) => v.productId)).toEqual(['p100', 'p150', 'p200', 'p250'])
    expect(r.actualTotalAgorot).toBe(70000 * 1)
    expect(r.rejected).toEqual([])
  })
  it('rejects empty, duplicate, bad amount, unknown value and oversize rows, keeping only the code tail', () => {
    const r = validateRows([
      { code: '', amount: 100 }, { code: 'AAAA11112222', amount: 100 }, { code: 'AAAA11112222', amount: 100 },
      { code: 'XXXX99998888', amount: 'abc' }, { code: 'YYYY77776666', amount: 175 }, { code: 'Z'.repeat(201), amount: 100 },
    ], products)
    expect(r.rejected.map((x) => [x.row, x.reason])).toEqual([[1, 'empty'], [3, 'duplicate_in_file'], [4, 'bad_amount'], [5, 'no_product'], [6, 'too_long']])
    expect(JSON.stringify(r.rejected)).not.toContain('AAAA1111')
    expect(r.rejected.find((x) => x.row === 3)!.codeTail).toBe('2222')
    expect(r.valid).toHaveLength(1)
  })
})

describe('file duplicate guard', () => {
  it('hashes content, not order, and the batch id is deterministic', () => {
    const a = [{ code: 'A1', amount: 100 }, { code: 'B2', amount: 150 }]
    expect(contentHash(a)).toBe(contentHash([...a].reverse()))
    expect(contentHash(a)).not.toBe(contentHash([{ code: 'A1', amount: 100 }]))
    expect(batchIdFor('raayonit', contentHash(a))).toMatch(/^raayonit_[0-9a-f]{40}$/)
  })
})

describe('code at rest', () => {
  it('encrypts per document and never stores the plaintext', async () => {
    const { encryptVoucherCode } = await import('@/lib/inventory/ledger/codes')
    const id = hashCode('SECRET-CODE-123')
    const cipher = encryptVoucherCode('SECRET-CODE-123', id)
    expect(cipher).not.toContain('SECRET')
    expect(decryptVoucherCode(cipher, id)).toBe('SECRET-CODE-123')
    expect(() => decryptVoucherCode(cipher, 'other')).toThrow()
  })
})
