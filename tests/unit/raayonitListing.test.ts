import { describe, expect, it } from 'vitest'
import { brandOfRow, groupListing, isSuspended, parseListingRows, parseListingSections, parseSupplierInfo } from '@/lib/inventory/raayonitListing'

const row = (rowId: string, sid: string, section: string, title: string, kashrut = '0', address = 'הרצל 1, חיפה') =>
  `<div class="row supplier_item_${section}" id="summary_row_${rowId}" regid="1" stypeid="${section}" rtype="summary" rowid="${rowId}" vid="253" sid="${sid}" kashrut="${kashrut}">
   <div class="title"><b>${title}</b></div><div class="kashrut">${kashrut === '1' ? 'כשר&nbsp;' : '&nbsp;'}</div>
   <div class="address phone-hide">${address}&nbsp;</div><div class="phones phone-hide">04-1111111&nbsp;</div>
   <div class="website phone-hide"><a href="http://x.example/" target="_blank" class="grid_website">&nbsp;</a></div></div>
   <div class="details supplier_item_${section}" id="info_row_${rowId}" rtype="info"></div>`
const PAGE = `<div id="supplier_header_84"><div class="title">מסעדות שף</div><div class="desc">- התו אינו תקף לארוחות עסקיות ולמשלוחים.</div></div>
  <div id="supplier_header_93"><div class="title">בתי קפה - סניפי קפה קפה</div></div>
  <div id="supplier_header_4"><div class="title">ספא</div></div>
  ${row('1', '10', '84', "הדרל'ה", '1')}
  ${row('2', '20', '93', 'קפה קפה - תל אביב')}
  ${row('3', '21', '93', 'קפה קפה - חיפה')}
  ${row('4', '30', '4', 'האתר לא מכבד תווים עד להודעה חדשה, עמכם הסליחה! - VILLA BROWN MOSHAVA SPA')}
  ${row('5', '31', '4', 'לאונרדו אין ים המלח - המלון סגור לרגל שיפוצים, עמכם הסליחה!')}
  ${row('6', '32', '4', 'ג\'אפן ג\'אפן חדרה - התו תקף לטייק - אווי ומשלוחים טלפונית בלבד')}
  ${row('7', '33', '4', 'ג\'אפן ג\'אפן ירושלים - התו תקף לטייק - אווי ומשלוחים טלפונית בלבד')}`

describe('Raayonit full listing', () => {
  const rows = parseListingRows(PAGE)
  const sections = parseListingSections(PAGE)
  it('reads sections and rows with their kosher flag, address and phone', () => {
    expect(sections.map((s) => s.id)).toEqual(['84', '93', '4'])
    expect(sections[0]!.description).toBe('התו אינו תקף לארוחות עסקיות ולמשלוחים.')
    expect(rows).toHaveLength(7)
    expect(rows[0]).toMatchObject({ sid: '10', sectionId: '84', title: "הדרל'ה", kosher: true, address: 'הרצל 1, חיפה', phone: '04-1111111', website: 'http://x.example/' })
    expect(rows[1]!.kosher).toBe(false)
  })
  it('reads a detail pane: only an absolute image counts, and the notes under "הערות"', () => {
    const own = parseSupplierInfo('<img src="https://raayonit.blob.core.windows.net/website/VouchersImg/a.jpg"/><div class="bold" style="x">הערות</div><div style="y"> - עד 500 ₪ לשולחן.<br/>- ללא כפל מבצעים.</div>')
    expect(own.image).toContain('VouchersImg/a.jpg')
    expect(own.notes).toEqual(['עד 500 ₪ לשולחן.', 'ללא כפל מבצעים.'])
    expect(parseSupplierInfo('<img src="/img/ribuakatan1_04.jpg"/>').image).toBe('')
  })
  it('drops sites that do not honour vouchers, by notice or by name', () => {
    expect(isSuspended('האתר לא מכבד תווים עד להודעה חדשה, עמכם הסליחה! - VILLA BROWN MOSHAVA SPA')).toBe(true)
    expect(isSuspended('לאונרדו אין ים המלח - המלון סגור לרגל שיפוצים, עמכם הסליחה!')).toBe(true)
    expect(isSuspended('לאונרדו ירושלים')).toBe(true)
    expect(isSuspended('קפה קפה')).toBe(false)
    expect(isSuspended('מסעדה', 'האתר לא מכבד תווים')).toBe(true)
    const { suspended, brands } = groupListing(rows, sections, new Map())
    expect(suspended).toHaveLength(2)
    expect(brands.some((b) => /BROWN|לאונרדו/.test(b.nameHe))).toBe(false)
  })
  it('groups chain branches into one brand and keeps a lone business as its own', () => {
    const infos = new Map([['10', parseSupplierInfo('<img src="https://x/y.jpg"/><div class="bold">הערות</div><div> - עד 500 ₪ לשולחן.</div>')]])
    const { brands } = groupListing(rows, sections, infos)
    const names = brands.map((b) => b.nameHe)
    expect(names).toEqual(["הדרל'ה", 'קפה קפה', "ג'אפן ג'אפן"])
    const cafe = brands.find((b) => b.nameHe === 'קפה קפה')!
    expect(cafe.branchCount).toBe(2)
    expect(cafe.category).toBe('Restaurants and Cafes')
    const chef = brands[0]!
    expect(chef).toMatchObject({ kosher: true, logoUrl: 'https://x/y.jpg', category: 'Restaurants and Cafes' })
    expect(chef.restrictions).toEqual(['התו אינו תקף לארוחות עסקיות ולמשלוחים.', 'עד 500 ₪ לשולחן.'])
    // a chain's take-away notice becomes a restriction and a phone method, never part of the branch name
    const japan = brands.find((b) => b.nameHe === "ג'אפן ג'אפן")!
    expect(japan.branches.map((b) => b.name)).toEqual(["ג'אפן ג'אפן חדרה", "ג'אפן ג'אפן ירושלים"])
    expect(japan.restrictions[0]).toContain('טייק')
    expect(japan.methods).toContain('phone_booking')
  })
  it('skips a brand already covered by a network page, and keys brands stably', () => {
    expect(groupListing(rows, sections, new Map(), new Set(['קפה קפה'])).brands.map((b) => b.nameHe)).not.toContain('קפה קפה')
    expect(brandOfRow({ title: 'קפה קפה - חיפה', sectionId: '93', sid: '21' }).key).toBe('l-s93')
    expect(brandOfRow({ title: 'גרג כפר סבא', sectionId: '15', sid: '5' })).toMatchObject({ key: 'l-greg', nameHe: 'גרג' })
    expect(brandOfRow({ title: 'הרודס תל אביב - ShareSpa', sectionId: '4', sid: '6' }).key).toBe('l-sharespa')
  })
})
