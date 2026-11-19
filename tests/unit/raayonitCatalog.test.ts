import { describe, expect, it } from 'vitest'
import { branchLabel, brandInstructions, brandsSheetTemplate, inferCategory, inferMethods, parseBrandsSheet, parseNetworkIndex, parseNetworkPage } from '@/lib/inventory/raayonitCatalog'

const PAGE = `<div id="trace-block"> <div class="current"><a href="x">HoLMES PLACE</a></div></div>
<table><tr><td style="width:1px;"><div><img src="https://raayonit.blob.core.windows.net/website/VouchersImg/a.jpg" /></div></td>
<td style="color:#3b2301"><div>- יש לציין בעת ביצוע ההזמנה שמשלמים עם שוברי גלובל תו.<br />- ניתן לממש גם ברכישת אונליין באתר.</div>
<a href="http://www.holmesplace.co.il/" target="_blank" class="network_link"> לאתר הרשת </a></td></tr></table>
<div class="row" id="summary_row_1" rtype="summary"><div class="title"><b>הולמס פלייס חיפה</b></div><div class="address phone-hide">גרנד קניון, חיפה&nbsp;</div><div class="phones phone-hide">076-5993435&nbsp;</div></div>
<div class="row" id="summary_row_2" rtype="summary"><div class="title"><b>הולמס פלייס רעננה</b></div><div class="address phone-hide">תדהר 1, רעננה</div><div class="phones phone-hide"></div></div>`

describe('raayonit catalog', () => {
  it('reads a network page: name, logo, fine print, site, branches', () => {
    const b = parseNetworkPage(PAGE, '4')!
    expect(b.nameHe).toBe('HoLMES PLACE')
    expect(b.nameEn).toBe('HoLMES PLACE')
    expect(b.logoUrl).toContain('VouchersImg/a.jpg')
    expect(b.siteUrl).toBe('http://www.holmesplace.co.il/')
    expect(b.restrictions).toHaveLength(2)
    expect(b.restrictions[0]).not.toMatch(/^-/)
    expect(b.methods).toEqual(['in_store', 'online'])
    expect(b.branches).toEqual([{ name: 'הולמס פלייס חיפה', address: 'גרנד קניון, חיפה', phone: '076-5993435' }, { name: 'הולמס פלייס רעננה', address: 'תדהר 1, רעננה', phone: '' }])
  })
  it('returns null for a page with no network', () => expect(parseNetworkPage('<html></html>', '1')).toBeNull())
  it('lists networks once each, with their logo', () => {
    const html = '<a href="x?NetworkNum=22"><img src="https://x/y.jpg"></a><a href="x?NetworkNum=4"><img src="https://x/z.jpg"></a><a href="x?NetworkNum=22"><img src="https://x/y.jpg"></a>'
    expect(parseNetworkIndex(html)).toEqual([{ key: '4', logoUrl: 'https://x/z.jpg' }, { key: '22', logoUrl: 'https://x/y.jpg' }])
  })
  it('infers a category and methods', () => {
    expect(inferCategory('קפה קפה', ['התו אינו תקף לארוחות עסקיות'])).toBe('Restaurants and Cafes')
    expect(inferCategory('ShareSpa', ['יש לציין שמשלמים עם שוברי גלובל תו'])).toBe('Pampering Bundles')
    expect(inferCategory('MANGO', ['אין כפל מבצעים'])).toBe('Fashion and Shopping')
    expect(inferMethods(['הזמנה טלפונית'])).toEqual(['in_store', 'phone_booking'])
  })
  it('labels a branch with its address, capped', () => {
    expect(branchLabel({ name: 'סניף א', address: 'רחוב 1, חיפה', phone: '' })).toBe('סניף א — רחוב 1, חיפה')
    expect(branchLabel({ name: 'x'.repeat(200), address: '', phone: '' }).length).toBeLessThanOrEqual(100)
  })
  it('writes steps in both languages, adding online and phone when honoured', () => {
    expect(brandInstructions({ methods: ['in_store'] }, 'en').split('\n')).toHaveLength(1)
    expect(brandInstructions({ methods: ['in_store', 'online', 'phone_booking'] }, 'he').split('\n')).toHaveLength(3)
  })
  it('parses the supplier sheet, merging branch rows per brand', () => {
    const matrix = [...brandsSheetTemplate(), ['הולמס פלייס', '', '', '', '', '', '', 'הולמס פלייס חיפה', 'גרנד קניון', '04-1'], ['', '', '', '', '', '', '', 'stray', '', '']]
    const r = parseBrandsSheet(matrix)
    expect(r.brands).toHaveLength(1)
    expect(r.brands[0]!.branches).toHaveLength(2)
    expect(r.brands[0]!.restrictions).toHaveLength(2)
    expect(r.brands[0]!.category).toBe('Sport and Fitness')
  })
  it('reports a sheet with no brand column', () => expect(parseBrandsSheet([['a', 'b'], ['1', '2']]).missingColumns).toEqual(['brand_he']))
})
