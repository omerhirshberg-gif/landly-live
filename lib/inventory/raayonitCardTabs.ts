// Which tab of Admin > Inventory > Raayonit cards a card belongs to. Pure and client-safe: the list, the API and the tests share it.
//   active   live on the site (published !== false)
//   pending  a new partner the daily sync staged for review (raayonitSyncPending)
//   archive  Raayonit stopped listing it and the daily sync archived it (archivedReason removed_from_raayonit_catalog)
//   hidden   everything else that is not live: drafts, cards an admin removed from the site, partners rejected in review
// Every card is in exactly one tab, so none can disappear from the admin's view.
export const ARCHIVED_REASON = 'removed_from_raayonit_catalog'
export type CardTab = 'active' | 'pending' | 'archive' | 'hidden'
export const CARD_TABS: readonly CardTab[] = ['active', 'pending', 'archive', 'hidden']

export interface TabbableCard { published: boolean; pending?: boolean; archivedReason?: string | null }

export function tabOf(card: TabbableCard): CardTab {
  if (card.pending) return 'pending'
  if (card.archivedReason === ARCHIVED_REASON && !card.published) return 'archive'
  return card.published ? 'active' : 'hidden'
}
