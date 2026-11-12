import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import BidiText from '@/components/admin/BidiText'
import OfferPrice from '@/components/admin/OfferPrice'
import { ADMIN_INPUT } from '@/components/admin/formStyles'

// The admin cleanup: one way to edit a business, no top-level "Translate
// missing" on Offers, an offers table without a dead gap, and Hebrew names
// that read in their own direction while every column keeps one edge.

const root = join(__dirname, '..', '..')
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('fewer, clearer buttons', () => {
  it('drops "Translate missing" from Offers, and keeps the Businesses refresh', () => {
    expect(read('app/admin/offers/page.tsx')).not.toContain('TranslateMissingButton')
    expect(read('app/admin/businesses/page.tsx')).toContain('endpoint="/api/admin/businesses/refresh"')
  })

  it("leaves the business ⋯ menu with Delete only: editing is the Details tab", () => {
    const page = read('app/admin/businesses/[uid]/page.tsx')
    expect(page).not.toContain("label: 'Edit details'")
    expect(page).toContain("actions={[{ label: t('bizDetail.deleteBusiness'), icon: 'fa-trash', danger: true, onSelect: () => void deleteBusiness() }]}")
  })
})

describe('text direction', () => {
  it('isolates a name in its own direction but lines it up with the column', () => {
    const html = renderToStaticMarkup(createElement(BidiText, { children: 'קפה נדי' }))
    expect(html).toBe('<span class="block min-w-0 text-start truncate "><bdi dir="auto">קפה נדי</bdi></span>')
    expect(renderToStaticMarkup(createElement(BidiText, { lines: 2, children: 'x' }))).toContain('line-clamp-2')
  })

  it('names offers and businesses with BidiText in every list and card', () => {
    for (const path of ['app/admin/offers/page.tsx', 'app/admin/businesses/page.tsx', 'app/admin/users/page.tsx', 'app/admin/search/page.tsx', 'components/admin/OfferShowcaseCard.tsx', 'components/admin/BusinessHero.tsx', 'components/admin/AdminDashboard.tsx']) {
      const source = read(path)
      expect(source, path).toContain('<BidiText')
      // A block that picks its own direction would push Hebrew to the far edge of its column.
      expect(source, path).not.toMatch(/<(?:div|p) [^>]*dir="auto"/)
      expect(source, path).not.toMatch(/className="[^"]*\btruncate\b[^"]*" dir="auto"/)
    }
  })

  it('starts every field at its own start edge, so a Hebrew one lines up on the right', () => {
    expect(ADMIN_INPUT).toContain('text-start')
    for (const [path, id] of [['components/admin/OfferFormFields.tsx', "field('title')"], ['components/admin/BusinessEditForm.tsx', 'edit-biz-name'], ['app/admin/businesses/new/page.tsx', 'biz-name']]) {
      expect(read(path), path).toMatch(new RegExp(`id=\\{?["']?${id.replace(/[()']/g, '\\$&')}["']?\\}?\\s+required\\s+dir="auto"`))
    }
  })

  it('never uses physical sides or ltr:/rtl: variants in the new pieces', () => {
    for (const path of ['components/admin/BidiText.tsx', 'components/admin/OfferThumb.tsx', 'components/admin/OfferPrice.tsx', 'components/admin/DataTable.tsx', 'app/admin/offers/page.tsx']) {
      expect(read(path), path).not.toMatch(/\b(?:ltr|rtl):|\b(?:ml|mr|pl|pr|left|right)-[\d[]|\btext-(?:left|right)\b/)
    }
  })
})

describe('price', () => {
  it('shows "₪15 (-38%)" over a quiet struck-through original, each line isolated LTR', () => {
    const html = renderToStaticMarkup(createElement(OfferPrice, { offerPrice: 15, originalPrice: 24, align: 'end' }))
    expect(html).toContain('items-end')
    expect(html).toMatch(/<bdi dir="ltr" class="whitespace-nowrap"><span class="font-semibold[^"]*">₪15<\/span><span class="ms-1[^"]*">\(-38%\)<\/span><\/bdi>/)
    expect(html).toMatch(/<bdi dir="ltr" class="[^"]*line-through[^"]*">₪24<\/bdi>/)
  })

  it('has no discount or original line when nothing is off', () => {
    const html = renderToStaticMarkup(createElement(OfferPrice, { offerPrice: 20, originalPrice: 20 }))
    expect(html).not.toContain('line-through')
    expect(html).not.toContain('(-')
  })
})

describe('the offers table', () => {
  it('gives every column but the first a width floor, so the title takes the spare width and nothing is squeezed', () => {
    const table = read('components/admin/DataTable.tsx')
    expect(table).toContain("${column.width ?? ''} ${i === 0 ? 'w-full min-w-[240px] break-words align-middle'")
    expect(table).not.toContain('table-fixed')
    const offers = read('app/admin/offers/page.tsx')
    for (const [id, width] of [['status', 'w-[120px]'], ['price', 'w-[120px]'], ['claimed', 'w-[110px]'], ['expires', 'w-[120px]']]) {
      expect(offers, id).toMatch(new RegExp(`id: '${id}',[\\s\\S]{0,120}width: '${width.replace(/[[\]]/g, '\\$&')}`))
    }
    // The title cell: thumbnail with the logo badge, then title over business.
    expect(offers).toContain('<OfferThumb imageUrl={offer.imageUrl} logoUrl={offer.businessLogoUrl} />')
    // Expires on desktop widths, and always on the phone card.
    // Expires is a real column now (the table scrolls sideways instead of hiding it), and always on the phone card.
    expect(offers).not.toContain("className: 'hidden xl:table-cell'")
    expect(offers).toMatch(/expiresPrefix'\)\} <bdi dir="ltr"/)
  })
})
