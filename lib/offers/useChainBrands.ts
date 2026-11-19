'use client'

import { useMemo } from 'react'
import type { BrandIndexEntry } from './branches'
import { resolveChainBrands, type ChainBrandSubject } from './resolveChainBrand'
import { useOffers } from './useOffers'

/** The brand tiles of a bought multi-chain voucher (see resolveChainBrand.ts): empty for any other perk, or while the live offers load. */
export function useChainBrands(subject: ChainBrandSubject | null | undefined): BrandIndexEntry[] {
  const { offers } = useOffers()
  const multi = subject?.perkScope === 'multi_chain'
  return useMemo(() => (multi && subject && offers ? resolveChainBrands(subject, offers) : []), [multi, subject, offers])
}
