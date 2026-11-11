import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(__dirname, '..', '..')
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('admin table layout', () => {
  const table = read('components/admin/DataTable.tsx')

  it('no longer squeezes the first column to zero width', () => {
    expect(table).not.toContain('max-w-0')
    expect(table).not.toContain('table-fixed')
  })

  it('fills the page and scrolls sideways inside its own frame', () => {
    expect(table).toContain('overflow-x-auto overscroll-x-contain')
    expect(table).toContain('w-full min-w-[960px]')
    expect(table).toContain('admin-table-scroll')
    expect(read('app/globals.css')).toContain('.admin-table-scroll')
  })

  it('gives the title column room and wraps its text instead of cutting it', () => {
    expect(table).toContain('min-w-[240px]')
    expect(table).toContain('break-words')
    const bidi = read('components/admin/BidiText.tsx')
    expect(bidi).toContain("'line-clamp-2 break-words'")
    // Aligned on the page's start edge, not the name's own (match-parent breaks on dir=auto in Chrome).
    expect(bidi).toContain('block min-w-0 text-start')
    expect(bidi).not.toContain('[text-align:match-parent]')
  })

  it('aligns headers and cells on the same logical edge', () => {
    expect(table).toContain("column.align === 'end' ? 'text-end' : 'text-start'")
    expect(table).not.toMatch(/text-(left|right)\b/)
  })

  it('keeps the row menu out of the scroll frame so it is never clipped', () => {
    const menu = read('components/admin/RowActionsMenu.tsx')
    expect(menu).toContain('fixed z-50')
    expect(menu).not.toContain('absolute end-0 top-full')
  })

  it('does not cut essential metadata in the list pages with truncate', () => {
    for (const path of ['app/admin/offers/page.tsx', 'app/admin/inventory/page.tsx']) {
      expect(read(path), path).not.toMatch(/\btruncate\b/)
    }
  })
})

describe('admin shell width', () => {
  const shell = read('components/admin/AdminShell.tsx')
  it('uses the 1600px canvas instead of the old 6xl cap', () => {
    expect(shell).not.toContain('max-w-6xl')
    expect(shell).toContain('max-w-[1600px]')
    expect(shell).toContain('xl:px-10')
  })
  it('takes its direction from the admin language, not a fixed ltr', () => {
    expect(shell).not.toContain('dir="ltr"')
    expect(shell).toContain('dir={dir}')
  })
  it('never relies on rtl: variants in the sidebar (they match the public site’s direction)', () => {
    // Comments may name the variants; classes may not.
    const code = read('components/admin/Sidebar.tsx').replace(/\/\/.*$/gm, '')
    expect(code).not.toMatch(/\brtl:|\bltr:/)
  })
})
