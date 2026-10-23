import 'server-only'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

export interface PageCursor { value: string | null; id: string; scope: string }

export function parsePageParams(request: Request, scope: string): { limit: number; cursor: PageCursor | null } {
  const params = new URL(request.url).searchParams
  const rawLimit = params.get('limit')
  const limit = rawLimit === null ? DEFAULT_LIMIT : Number(rawLimit)
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) throw new Error(`limit must be an integer between 1 and ${MAX_LIMIT}.`)
  const rawCursor = params.get('cursor')
  if (!rawCursor) return { limit, cursor: null }
  if (rawCursor.length > 2048) throw new Error('cursor is too large.')
  try {
    const decoded = JSON.parse(Buffer.from(rawCursor, 'base64url').toString('utf8')) as PageCursor
    if (!decoded || typeof decoded.id !== 'string' || decoded.id.length === 0 || decoded.id.includes('/')
      || typeof decoded.scope !== 'string' || decoded.scope !== scope
      || (decoded.value !== null && typeof decoded.value !== 'string')) throw new Error('invalid')
    return { limit, cursor: decoded }
  } catch { throw new Error('cursor is invalid.') }
}

function encodeCursor(value: string | null, id: string, scope: string): string {
  return Buffer.from(JSON.stringify({ value, id, scope })).toString('base64url')
}

// A cursor that carries no document id, for lists whose ids must not reach
// the client (/api/business/vouchers: a voucher id is `${customerUid}_${offerId}`).
// It holds the last row's sort value at full Timestamp precision (null for a
// row without one) and how many rows with exactly that value were already
// returned; the next page starts at that value and skips them. The query's
// own tiebreak (orderBy __name__) keeps rows with an equal value in a stable
// order, so the skip lands on the right row.
export interface TimeCursor { at: { s: number; n: number } | null; skip: number; scope: string }

export function parseTimePageParams(request: Request, scope: string): { limit: number; cursor: TimeCursor | null } {
  const params = new URL(request.url).searchParams
  const rawLimit = params.get('limit')
  const limit = rawLimit === null ? DEFAULT_LIMIT : Number(rawLimit)
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) throw new Error(`limit must be an integer between 1 and ${MAX_LIMIT}.`)
  const rawCursor = params.get('cursor')
  if (!rawCursor) return { limit, cursor: null }
  if (rawCursor.length > 512) throw new Error('cursor is too large.')
  try {
    const decoded = JSON.parse(Buffer.from(rawCursor, 'base64url').toString('utf8')) as TimeCursor
    const at = decoded?.at
    if (!decoded || decoded.scope !== scope || !Number.isSafeInteger(decoded.skip) || decoded.skip < 1 || decoded.skip > 10_000
      || (at !== null && (typeof at !== 'object' || !Number.isSafeInteger(at.s) || !Number.isInteger(at.n) || at.n < 0 || at.n > 999_999_999))) {
      throw new Error('invalid')
    }
    return { limit, cursor: { at: at === null ? null : { s: at.s, n: at.n }, skip: decoded.skip, scope } }
  } catch { throw new Error('cursor is invalid.') }
}

export function encodeTimeCursor(cursor: TimeCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url')
}

export function pageResponse<T>(body: T, hasMore: boolean, lastDoc: { id: string; data: () => Record<string, unknown> } | undefined, scope: string, cursorValue: (doc: { id: string; data: () => Record<string, unknown> }) => [string | null, string]): Response {
  const cursor = hasMore && lastDoc ? encodeCursor(...cursorValue(lastDoc), scope) : null
  return Response.json({ ...body as object, nextCursor: cursor })
}
