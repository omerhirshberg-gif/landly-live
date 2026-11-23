import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { branchDrift, nameWithoutNotice } from '@/lib/inventory/raayonitBranchDrift'
import type { ExistingCard, LiveDirectory } from '@/lib/inventory/raayonitLiveDiff'
import type { ListingRow } from '@/lib/inventory/raayonitListing'

const row = (sid: string, title: string, address: string, phone = '', kosher = false): ListingRow => ({ rowId: `r${sid}${address.length}`, sid, sectionId: '15', regionId: '1', title, address, phone, website: '', kosher })
const live = (rows: ListingRow[], suspendedRows: ListingRow[] = []): LiveDirectory => ({ rows, sections: [{ id: '15', title: 'בתי קפה ומסעדות', description: '' }], entries: [], suspended: suspendedRows.map((r) => r.title), suspendedRows })
const card = (key: string, name: string, branches: NonNullable<ExistingCard['branches']>): ExistingCard => ({ id: `c-${key}`, sourceKey: `raayonit:${key}`, brandName: name, published: true, pending: false, branches })

describe('branch drift', () => {
  const a = row('100', 'קפה נעמי', 'הרצל 1, תל אביב', '03-1111111')
  const b = row('100', 'קפה נעמי', 'דיזנגוף 5, תל אביב', '03-2222222')

  it('reports nothing when the card matches the live directory', () => {
    const r = branchDrift(live([a, b]), [card('l-100', 'קפה נעמי', [{ address: a.address, phone: a.phone }, { address: b.address, phone: b.phone }])])
    expect(r.brands).toEqual([])
    expect(r.counts).toMatchObject({ brandsCompared: 1, brandsDrifted: 0, added: 0, missing: 0, changed: 0 })
  })

  it('reports a new live branch, a branch Raayonit dropped, and a changed phone, without touching anything', () => {
    const cards = [card('l-100', 'קפה נעמי', [{ address: a.address, phone: '03-9999999' }, { address: 'ישן 9, חיפה', phone: '04-1234567' }])]
    const r = branchDrift(live([a, b]), cards)
    const entry = r.brands[0]!
    expect(entry.added.map((x) => x.address)).toEqual([b.address])
    expect(entry.missing.map((x) => x.address)).toEqual(['ישן 9, חיפה'])
    expect(entry.changed).toEqual([{ address: a.address, field: 'phone', before: '03-9999999', after: '03-1111111' }])
    expect(cards[0]!.branches).toHaveLength(2)
  })

  it('reports a changed kosher flag, and ignores phone formatting and an empty-to-empty phone', () => {
    const k = row('100', 'קפה נעמי', 'הרצל 1, תל אביב', '03-1111111', true)
    expect(branchDrift(live([k]), [card('l-100', 'קפה נעמי', [{ address: k.address, phone: '031111111', kosher: false }])]).brands[0]!.changed).toEqual([{ address: k.address, field: 'kosher', before: 'false', after: 'true' }])
    const none = row('100', 'קפה נעמי', 'הרצל 1, תל אביב', '')
    expect(branchDrift(live([none]), [card('l-100', 'קפה נעמי', [{ address: none.address, phone: '' }])]).brands).toEqual([])
  })

  it('never invents a phone: an empty live phone is reported as it is', () => {
    const none = row('100', 'קפה נעמי', 'הרצל 1, תל אביב', '')
    const r = branchDrift(live([none]), [card('l-100', 'קפה נעמי', [{ address: none.address, phone: '03-1111111' }])])
    expect(r.brands[0]!.changed).toEqual([{ address: none.address, field: 'phone', before: '03-1111111', after: '' }])
  })

  it('never reports a card branch as missing for a network-keyed business (its branches live on its own page)', () => {
    const r = branchDrift(live([a]), [card('35', 'קפה נעמי', [{ address: a.address, phone: a.phone }, { address: 'רק בעמוד הרשת 3', phone: '' }])])
    expect(r.brands).toEqual([])
  })

  it('skips a business with no card or with no stored branches', () => {
    expect(branchDrift(live([a]), []).counts.brandsCompared).toBe(0)
    expect(branchDrift(live([a]), [{ ...card('l-100', 'קפה נעמי', []), branches: undefined }]).counts.brandsCompared).toBe(0)
  })
})

describe('partial closure versus full suspension', () => {
  const open = row('100', 'קפה נעמי', 'הרצל 1, תל אביב', '03-1111111')
  const closedRow = row('101', 'קפה נעמי - האתר לא מכבד תווים עד להודעה חדשה, עמכם הסליחה!', 'שוק 2, ירושלים')
  const goneOnly = row('200', 'מסעדה סגורה - האתר סגור באופן זמני, עמכם הסליחה!', 'אין 1, חיפה')
  const cards = [card('l-100', 'קפה נעמי', [{ address: open.address, phone: open.phone }])]

  it('flags a business that still has live branches but some closed as a partial closure', () => {
    const r = branchDrift(live([open], [closedRow]), cards)
    expect(r.partialClosures).toHaveLength(1)
    expect(r.partialClosures[0]).toMatchObject({ nameHe: 'קפה נעמי', liveBranches: 1 })
    expect(r.partialClosures[0]!.closed).toEqual([closedRow.title])
    expect(r.fullSuspensions).toEqual([])
  })

  it('lists a business whose every row is closed as a full suspension, not a partial one', () => {
    const r = branchDrift(live([open], [goneOnly]), cards)
    expect(r.fullSuspensions).toEqual(['מסעדה סגורה'])
    expect(r.partialClosures).toEqual([])
    expect(r.counts).toMatchObject({ partialClosures: 0, fullSuspensions: 1 })
  })

  it('strips the notice from a title in either order', () => {
    expect(nameWithoutNotice('קפה רוסטרס שוק מחנה יהודה - האתר לא מכבד תווים עד להודעה חדשה, עמכם הסליחה!')).toBe('קפה רוסטרס שוק מחנה יהודה')
    expect(nameWithoutNotice('האתר לא מכבד תווים עד להודעה חדשה, עמכם הסליחה! - BROWN JLM SPA')).toBe('BROWN JLM SPA')
  })
})

describe('the daily sync', () => {
  const src = readFileSync(new URL('../../lib/inventory/raayonitDailySync.ts', import.meta.url), 'utf8')
  it('adds the drift to its report without letting it block the run or change a safety guard', () => {
    expect(src).toContain('branchDrift(live, existing)')
    expect(src).toContain("catch (err) { console.error('[raayonit-sync] branch drift check failed'")
    expect(src).toContain('MAX_ADDITIONS = 25')
    expect(src).toContain('MIN_LIVE_ROWS = 150')
  })
})
