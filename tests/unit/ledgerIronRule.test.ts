import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// Iron rule: nothing but lib/inventory/ledger/transitions.ts writes an inventoryVouchers `status`, and voucherEvents are only
// ever created (append-only). A new offender fails here, in CI, before it can double-sell or erase history.
const ROOT = join(__dirname, '..', '..')
const SKIP = new Set(['node_modules', '.next', '.git', 'strix_runs', 'tests', 'landly-mobile', '.expo', 'scratchpad'])
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|mjs)$/.test(name)) out.push(p)
  }
  return out
}
const files = ['app', 'lib', 'components', 'scripts'].flatMap((d) => { try { return walk(join(ROOT, d)) } catch { return [] } })
const rel = (p: string) => relative(ROOT, p)

describe('voucher ledger iron rule', () => {
  it('writes `status:` for an inventory voucher only inside transitions.ts', () => {
    const offenders = files.filter((f) => {
      const text = readFileSync(f, 'utf8')
      if (!/inventoryVouchers|VOUCHERS_COLLECTION/.test(text)) return false
      if (rel(f) === 'lib/inventory/ledger/transitions.ts') return false
      // A ledger status as an object-literal value. Reading one in a query (`where('status', '==', 'IN_STOCK')`) has no `status:` key.
      return /\bstatus\s*:\s*['"](?:STAGED|IN_STOCK|RESERVED|SOLD|DELIVERED|PARTIALLY_REDEEMED|REDEEMED|CANCELLED|EXPIRED|VOID)['"]/.test(text)
    }).map(rel)
    expect(offenders).toEqual([])
  })
  it('never updates or deletes a voucherEvents document', () => {
    const offenders = files.filter((f) => {
      const text = readFileSync(f, 'utf8')
      return /(?:EVENTS_COLLECTION|['"]voucherEvents['"])[^;\n]*\)\s*\.doc\([^)]*\)\s*\.(?:update|set|delete)\(/.test(text) || /tx\.(?:update|delete|set)\(\s*eventRef/.test(text)
    }).map(rel)
    expect(offenders).toEqual([])
  })
  it('the rules forbid any client write to the ledger and make events immutable', () => {
    const rules = readFileSync(join(ROOT, 'firestore.rules'), 'utf8')
    const block = (name: string) => rules.slice(rules.indexOf(`match /${name}/`), rules.indexOf(`match /${name}/`) + 260)
    for (const c of ['suppliers', 'inventoryProducts', 'inventoryVouchers', 'importBatches', 'reconciliationRuns', 'businessChanges', 'inventoryAlerts']) expect(block(c)).toContain('allow read, write: if false')
    expect(block('voucherEvents')).toMatch(/allow update, delete: if false/)
    expect(block('voucherEvents')).toMatch(/allow create: if false/)
  })
})
