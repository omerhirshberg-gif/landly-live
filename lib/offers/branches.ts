// A participating branch as the offer carries it (Raayonit): a clean name, where it is, and whether it is kosher.
export type BranchText = { name: string; city: string; address: string }
/** A branch's name, city and street per reader language (Hebrew is the base text); written by the Raayonit sync. */
export type BranchI18n = Partial<Record<'en' | 'ru' | 'fr' | 'es', BranchText>>
export interface OfferBranch { name: string; city: string; address: string; phone: string; kosher: boolean; i18n?: BranchI18n }

/** The branch's text in the reader's language, falling back to the Hebrew base when no translation exists. */
export function localizedBranch(branch: OfferBranch, lang: string): BranchText {
  const own = (branch.i18n as Record<string, BranchText | undefined> | undefined)?.[lang]
  return own?.name ? own : { name: branch.name, city: branch.city, address: branch.address }
}

/** One line for a branch: its name, and where it is when the name doesn't already say. */
export function branchLine(branch: OfferBranch, lang: string): string {
  const t = localizedBranch(branch, lang)
  return `${t.name}${t.address && !t.name.includes(t.address) ? ` — ${t.address}` : ''}`.replace(/\s+/g, ' ').trim()
}
/** One tile of the multi-chain card's brand strip: a brand's own offer, its name and how many branches honour the voucher. */
export interface BrandIndexEntry { offerId: string; name: string; nameTranslations?: unknown; logoUrl: string; branchCount: number; photo?: boolean }

export const MAX_OFFER_BRANCHES = 150
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

function parseBranchI18n(raw: unknown): BranchI18n | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const out: BranchI18n = {}
  for (const lang of ['en', 'ru', 'fr', 'es'] as const) {
    const t = (raw as Record<string, Record<string, unknown> | undefined>)[lang]
    if (t && str(t.name)) out[lang] = { name: str(t.name), city: str(t.city), address: str(t.address) }
  }
  return Object.keys(out).length > 0 ? out : undefined
}

export function parseBranches(raw: unknown): OfferBranch[] {
  if (!Array.isArray(raw)) return []
  const out: OfferBranch[] = []
  for (const r of raw.slice(0, MAX_OFFER_BRANCHES)) {
    const b = r as Record<string, unknown> | null
    const name = str(b?.name)
    if (!name) continue
    const i18n = parseBranchI18n(b?.i18n)
    out.push({ name, city: str(b?.city), address: str(b?.address), phone: str(b?.phone), kosher: b?.kosher === true, ...(i18n ? { i18n } : {}) })
  }
  return out
}

export function parseBrandIndex(raw: unknown): BrandIndexEntry[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((r) => {
    const b = r as Record<string, unknown> | null
    const offerId = str(b?.offerId), name = str(b?.name)
    return offerId && name ? [{ offerId, name, nameTranslations: b?.nameTranslations, logoUrl: str(b?.logoUrl), branchCount: Number(b?.branchCount) || 0, ...(b?.photo === true ? { photo: true } : {}) }] : []
  })
}
