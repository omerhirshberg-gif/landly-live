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

export function pageResponse<T>(body: T, hasMore: boolean, lastDoc: { id: string; data: () => Record<string, unknown> } | undefined, scope: string, cursorValue: (doc: { id: string; data: () => Record<string, unknown> }) => [string | null, string]): Response {
  const cursor = hasMore && lastDoc ? encodeCursor(...cursorValue(lastDoc), scope) : null
  return Response.json({ ...body as object, nextCursor: cursor })
}
