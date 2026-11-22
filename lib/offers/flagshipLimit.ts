import { isolateLtr, type ShowcaseCard } from '@/lib/home/superShowcase'

// The Raayonit Card is sold one voucher per value. When the member already owns some (or all) of them the details step says so,
// instead of leaving the faded tiles unexplained. Pure, shared by the website and the Expo app.
export interface FlagshipLimitNotice {
  /** 'some': a value is owned, others are still free. 'all': every value is owned, nothing can be bought. */
  kind: 'some' | 'all'
  /** The owned values, "₪100, ₪200", each isolated left to right so Hebrew keeps them in reading order. */
  values: string
}

export function flagshipLimitNotice(cards: readonly ShowcaseCard[], ownedPools: readonly string[]): FlagshipLimitNotice | null {
  const owned = cards.filter((c) => ownedPools.includes(c.pool))
  if (owned.length === 0) return null
  return {
    kind: owned.length === cards.length ? 'all' : 'some',
    values: owned.map((c) => isolateLtr(`₪${c.value}`)).join(', '),
  }
}
