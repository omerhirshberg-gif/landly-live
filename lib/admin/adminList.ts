import 'server-only'
import { encodeCursor, parsePageParams, type PageCursor } from '@/lib/business/pagination'

// The admin list routes (businesses, offers, pools) used to read a whole
// collection per request. They now read at most ADMIN_LIST_CAP documents, in
// id order, and take an optional `limit` (1-100) and `cursor` to walk further.
// Called without either, they return the first ADMIN_LIST_CAP, which is every
// document at the scale the catalog is built for (hundreds); `nextCursor` says
// when there is more.
export const ADMIN_LIST_CAP = 500

export function adminListParams(request: Request, scope: string): { limit: number; cursor: PageCursor | null } {
  const params = new URL(request.url).searchParams
  if (!params.has('limit') && !params.has('cursor')) return { limit: ADMIN_LIST_CAP, cursor: null }
  return parsePageParams(request, scope)
}

/** The cursor to continue after `lastId`, or null when this was the last page. */
export function adminNextCursor(hasMore: boolean, lastId: string | undefined, scope: string): string | null {
  return hasMore && lastId ? encodeCursor(null, lastId, scope) : null
}
