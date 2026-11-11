import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { en } from '@/lib/admin/translations/en'
import { he } from '@/lib/admin/translations/he'
import { clockTime, dayLabel, relativeTime } from '@/components/admin/support/time'

const read = (path: string) => readFileSync(join(__dirname, '..', '..', path), 'utf8')
const NOW = Date.parse('2026-11-11T12:00:00Z')

// Every key a migrated screen uses must exist in both languages, and the screens must read
// their words through useAdminT, so switching language re-renders them in Hebrew.
describe('admin screens use the translation dictionary', () => {
  const screens = [
    'app/admin/businesses/page.tsx', 'app/admin/support/page.tsx', 'app/admin/offers/page.tsx', 'app/admin/inventory/page.tsx',
    'app/admin/users/page.tsx', 'components/admin/inventory/InventoryTable.tsx', 'components/admin/inventory/PerkCombobox.tsx', 'app/admin/orphans/page.tsx', 'app/admin/search/page.tsx', 'components/admin/AdminDashboard.tsx',
    'components/admin/support/ConversationList.tsx', 'components/admin/support/ChatHeader.tsx', 'components/admin/support/ReplyComposer.tsx',
    'components/admin/support/ChatTranscript.tsx', 'components/admin/support/MessageBubble.tsx', 'components/admin/support/ConversationBadges.tsx',
  ]

  it.each(screens)('%s reads useAdminT and only names keys that exist', (file) => {
    const source = read(file)
    expect(source).toContain('useAdminT')
    for (const [, key] of source.matchAll(/\bt\('([a-zA-Z]+\.[A-Za-z_. ]+)'/g)) expect(key in en, `${file}: ${key}`).toBe(true)
    for (const [, key] of source.matchAll(/\btn\('([a-zA-Z.]+)'/g)) expect(`${key}.one` in en && `${key}.other` in en, `${file}: ${key}`).toBe(true)
  })

  it('has authentic Hebrew for the support inbox and the businesses list', () => {
    expect(he['support.searchPlaceholder']).toBe('חיפוש לפי שם או טלפון')
    expect(he['support.awaiting']).toBe('ממתינים למענה')
    expect(he['support.resolved']).toBe('סגורות')
    expect(he['support.nothingHere']).toBe('אין שיחות עדיין')
    expect(he['support.chooseConversation']).toBe('בחרו שיחה מהרשימה')
    expect(he['biz.col.active']).toBe('הטבות פעילות')
    expect(he['route.WhatsApp Support']).toBe('תמיכה בוואטסאפ')
    for (const key of Object.keys(he).filter((k) => /^(support|biz|users|dash|orph|search)\./.test(k))) {
      if (/\.(hint|lang\.|hintTail)/.test(key)) continue
      expect(he[key as keyof typeof he], key).toMatch(/[֐-׿]/)
    }
  })

  it('does not clip the support filter row: tabs keep their width and the row wraps', () => {
    const list = read('components/admin/support/ConversationList.tsx')
    expect(list).toContain('shrink-0')
    expect(list).toContain('whitespace-nowrap')
    expect(list).toContain('min-w-fit')
    expect(list).toContain('flex-wrap')
    expect(list).not.toContain('overflow-x-auto')
    expect(list).not.toContain('grid-cols-3')
    expect(list).not.toContain('truncate">{label}')
  })
})

describe('perk hub wording', () => {
  it('names the two tabs as approved', () => {
    expect([he['nav.offers'], he['nav.inventory']]).toEqual(['ניהול והעלאת הטבות', 'מעקב מלאי וקופונים'])
    expect([en['nav.offers'], en['nav.inventory']]).toEqual(['Perk Management', 'Stock & Vouchers'])
    expect(he['inv.restock']).toBe('הוספת קודים')
    expect(he['inv.uploadMultipass']).toBe('טעינת קודי מולטיפאס באקסל')
    expect(he['inv.pickPerk']).toBe('בחרו לאיזו הטבה להטעין את הקודים')
    expect([he['import.catalog'], he['import.codes']]).toEqual(['קטלוג הטבות חדשות', 'קודי שוברים ממולטיפאס'])
    expect([en['import.catalog'], en['import.codes']]).toEqual(['New perk catalog', 'Multipass voucher codes'])
  })

  it('has no "pool" or "מאגר" in any user-visible string', () => {
    for (const [key, value] of [...Object.entries(en), ...Object.entries(he)]) {
      expect(value, key).not.toMatch(/\bpools?\b|מאגר|wholesale/i)
    }
  })

  it('has no emoji in the admin dictionaries', () => {
    for (const [key, value] of [...Object.entries(en), ...Object.entries(he)]) expect(value, key).not.toMatch(/\p{Extended_Pictographic}/u)
  })

  it('shows every perk in one grid, restocking only Multipass rows', () => {
    const table = read('components/admin/inventory/InventoryTable.tsx')
    expect(table).toContain("row.kind !== 'multipass'")
    expect(table).toContain('<svg')
    const page = read('app/admin/inventory/page.tsx')
    expect(page).not.toContain('role="tablist"')
    expect(page).not.toContain('CreatePool')
  })
})

describe('support times follow the admin language', () => {
  it('words and dates in Hebrew and English', () => {
    expect(relativeTime(new Date(NOW - 30_000).toISOString(), NOW, 'he')).toBe('עכשיו')
    expect(relativeTime(new Date(NOW - 30_000).toISOString(), NOW, 'en')).toBe('now')
    expect(relativeTime(new Date(NOW - 5 * 60_000).toISOString(), NOW)).toBe('5m')
    expect(dayLabel(new Date(NOW).toISOString(), NOW, 'he')).toBe('היום')
    expect(dayLabel(new Date(NOW).toISOString(), NOW)).toBe('Today')
    expect(clockTime('2026-11-11T12:05:00Z', 'en')).toMatch(/^\d\d:\d\d$/)
  })
})

describe('step 1 wording and admin scale', () => {
  it('names step 1 as one card and keeps examples out of the scope fields', () => {
    expect(he['wizard.step1']).toBe('פרטי ההטבה והערוץ')
    expect(en['wizard.step1']).toBe('Perk Details & Channel')
    for (const dict of [en, he]) {
      for (const key of Object.keys(dict).filter((k) => /^wizard\.(scope|brandName|chains|guide)/.test(k))) {
        expect(dict[key as keyof typeof dict], key).not.toMatch(/e\.g\.|BUYME|Fox Home|למשל/)
      }
    }
  })

  it('lifts the admin type scale in one place and no admin text is lighter than slate-500', () => {
    const css = read('app/globals.css')
    expect(css).toContain('.admin-scale .text-xs')
    expect(css).toContain('.admin-scale td{font-weight:500;}')
    expect(read('components/admin/AdminShell.tsx')).toContain('admin-scale')
    expect(read('components/admin/DataTable.tsx')).toContain('text-[13px] font-bold')
  })
})
