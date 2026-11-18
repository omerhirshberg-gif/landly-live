// Cleans Raayonit's catalogue before it becomes offers: no suspended or junk branches, one brand per business (the network
// pages and the full listing overlap), and an explicit category for each brand. Pure and idempotent, so the sync, the dev
// cleanup and the tests share it.
import type { RaayonitBranch, RaayonitBrand } from './raayonitCatalog'
import { inferMethods, knownCategory } from './raayonitCatalog'

/** Notices and table furniture that mark a row as not a working branch. */
const JUNK = /לא מכבד תווים|עד להודעה חדשה|עמכם הסליחה|סגור לרגל שיפוצים|סגור זמנית|סגור באופן זמני|לפירוט לחץ|שם האתר|^\s*(כתובת|טלפון|כשרות|מיקום)\s*$/
export const isJunkText = (text: string): boolean => JUNK.test(text)

/** A branch name without the "take-away only" or "closed" tail Raayonit appends to it. */
export function cleanBranchName(name: string): string {
  return name
    .replace(/\s+[-–]\s+התו תקף[^|]*$/, '')
    .replace(/\s+[-–]\s+(?:ה?אתר|המלון)[^|]*$/, '')
    .replace(/\*+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The takeaway or delivery rule a branch name carried, to move into the brand's terms. */
export function branchNotice(name: string): string {
  return name.match(/\s[-–]\s+(התו תקף[^|]*)$/)?.[1]?.replace(/\s+/g, ' ').replace('אווי', 'אוויי').trim() ?? ''
}

/** Drops junk and suspended rows, strips noisy tails, removes duplicates (same name and address). */
export function sanitizeBranches(branches: readonly RaayonitBranch[]): RaayonitBranch[] {
  const seen = new Set<string>()
  const out: RaayonitBranch[] = []
  for (const b of branches) {
    if (isJunkText(b.name) || isJunkText(b.address)) continue
    const name = cleanBranchName(b.name)
    if (!name) continue
    const key = `${name}|${b.address.replace(/\s+/g, ' ').trim()}`.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ ...b, name })
  }
  return out
}

// The brand-to-category table lives in raayonitCatalog.ts (CATEGORY_RULES: whole-name patterns for every Raayonit business), so the importers' fallback and the
// sync can never disagree. A business the table does not list keeps the category it already has.
export { CATEGORY_RULES } from './raayonitCatalog'
export const categoryFor = (b: Pick<RaayonitBrand, 'nameHe' | 'nameEn' | 'category'>): string => knownCategory(b.nameHe, b.nameEn) ?? b.category

// One business can be on a network page and in the listing under another spelling: these collapse such names.
const ALIASES: [string, RegExp][] = [
  ['cafe-cafe', /^קפה ?קפה$|^Caf[eé] ?Caf[eé]$/i], ['pizza-agvania', /פיצה עגבני/], ['pizza-story', /פיצה סטורי/], ['biscotti', /BISCOTTI|ביסקוטי/i],
  ['pretzels', /Pretzels/i], ['japan', /JAPAN JAPAN|ג'אפן ג'אפן|ג'פאן/i], ['mexicana', /MEXICANA|מקסיקנה/i], ['frangelico', /frangelico|פרנג'ליקו/i],
  ['siciliano', /סיציליאנו/], ['max-brenner', /MAX BRENNER|מקס ברנר/i], ['sharespa', /ShareSpa/i], ['tilia', /טיליה|Tilia/i], ['mila', /MILA SPA|מילה ספא/i],
  ['joya', /^joya|^ג'ויה/i], ['la-borse', /לה בורסה|La Bourse|LA-BORSA/i], ['hasushia', /^הסושיה/], ['avazi', /^אווזי/], ['mandarin', /^MANDARIN|^מנדרין/i],
  ['4chef', /^4Chef/i], ['holmes', /HoLMES|הולמס/i], ['greg', /^גרג(?:\s|$)|Greg Cafe/i], ['bleecker', /BLEECKER|בליקר/i], ['roasters', /קפה רוסטרס|Cafe Roasters/i],
  ['leonardo', /^לאונרדו$|Leonardo Hotels/], ['brown', /^BROWN$|^בראון$|Brown Hotels/], ['just-music', /ג'אסט מיוזיק/],
]
export const aliasOf = (b: Pick<RaayonitBrand, 'nameHe' | 'nameEn'>): string | null => ALIASES.find(([, re]) => re.test(b.nameHe) || (b.nameEn && re.test(b.nameEn)))?.[0] ?? null

/**
 * The catalogue ready to sync: junk branches gone, the same business merged into one brand (the one with its own image and
 * restrictions leads, branches are united), the takeaway notices turned into restrictions, categories set, and a brand
 * whose every branch was junk dropped.
 */
export function finalizeCatalog<T extends RaayonitBrand>(brands: readonly T[]): T[] {
  const groups = new Map<string, T[]>()
  for (const b of brands) {
    const key = aliasOf(b) ?? `own:${b.key}`
    groups.set(key, [...(groups.get(key) ?? []), b])
  }
  const out: T[] = []
  for (const list of groups.values()) {
    const lead = [...list].sort((a, b) => Number(!!b.logoUrl) - Number(!!a.logoUrl) || Number(a.key.startsWith('l-')) - Number(b.key.startsWith('l-')))[0]!
    const notices = list.flatMap((b) => b.branches.map((r) => branchNotice(r.name))).filter(Boolean)
    const branches = sanitizeBranches(list.flatMap((b) => b.branches))
    if (list.some((b) => b.branches.length > 0) && branches.length === 0) continue
    const restrictions = [...new Set([...list.flatMap((b) => b.restrictions), ...notices])].filter((r) => !isJunkText(r))
    const merged = { ...lead, branches, restrictions, methods: [...new Set([...lead.methods, ...inferMethods(restrictions)])] } as T
    out.push({ ...merged, category: categoryFor(merged) })
  }
  return out
}
