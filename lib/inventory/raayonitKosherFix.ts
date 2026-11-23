// What a stored Raayonit card needs so its branches' kosher flags match the catalogue (the bundled snapshot, after the listing's kosher flags were
// carried onto the network brands). Pure: scripts/fix-raayonit-kosher-dev.mts reads the cards and writes these fields, nothing else. It only ever
// turns a flag ON (a branch the catalogue does not flag keeps what the card had), never touches a name, address, phone or translation, and calls no translator.
import { branchLabel, type RaayonitBrand } from './raayonitCatalog'

export const KOSHER_SUFFIX = ' · כשר'

export interface KosherCardBranch { name?: string; address?: string; phone?: string; kosher?: boolean; [extra: string]: unknown }
export interface KosherCard { branches?: KosherCardBranch[]; participatingChains?: unknown; kosherBranchCount?: unknown }
export interface KosherFix { branches: KosherCardBranch[]; kosherBranchCount: number; participatingChains: string[]; flagged: number }

const norm = (s: string) => s.normalize('NFC').toLowerCase().replace(/[.‎‏'"׳״,]/g, '').replace(/[\s\-–]+/g, ' ').trim()
const placeKey = (b: { address?: string; name?: string }) => norm(b.address || '') || norm(b.name || '')

/** The fields to write for one card, or null when it already matches. */
export function planKosherFix(card: KosherCard, brand: Pick<RaayonitBrand, 'branches'>): KosherFix | null {
  if (!Array.isArray(card.branches) || card.branches.length === 0) return null
  const kosherPlaces = new Set(brand.branches.filter((b) => b.kosher === true).map(placeKey))
  let flagged = 0
  const branches = card.branches.map((b) => {
    if (b.kosher === true || !kosherPlaces.has(placeKey(b))) return b
    flagged++
    return { ...b, kosher: true }
  })
  const kosherBranchCount = Math.max(brand.branches.filter((b) => b.kosher === true).length, branches.filter((b) => b.kosher === true).length)
  const chains = Array.isArray(card.participatingChains) ? card.participatingChains.filter((x): x is string => typeof x === 'string') : []
  const kosherLabels = new Set(brand.branches.filter((b) => b.kosher === true).map((b) => branchLabel(b)))
  const participatingChains = chains.map((entry) => (!entry.endsWith(KOSHER_SUFFIX) && kosherLabels.has(entry) ? `${entry}${KOSHER_SUFFIX}` : entry))
  const chainsChanged = participatingChains.some((entry, i) => entry !== chains[i])
  if (flagged === 0 && !chainsChanged && card.kosherBranchCount === kosherBranchCount) return null
  return { branches, kosherBranchCount, participatingChains, flagged }
}
