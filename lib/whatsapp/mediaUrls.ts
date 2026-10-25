import 'server-only'
import { getAdminBucket } from '@/lib/firebase/admin'
import type { AttachmentKind, LoggedMedia } from './conversationLog'
import { MEDIA_PREFIX } from './mediaStore'

// Read access to a stored attachment (lib/whatsapp/mediaStore.ts) for the
// support inbox, which polls the open chat every few seconds: V4 signed URLs
// from getAdminBucket(), signed as of the start of the current half hour and
// good for two hours after it. Every poll in the same half hour gets the very
// same URL, so the browser keeps its copy (Cache-Control private, an hour)
// and a playing voice note or video is never reloaded; any URL handed out
// still has at least 90 minutes left. Signing is local (the service
// account's key), and the inbox never sees the object path.

export const SIGNING_STEP_MS = 30 * 60 * 1000
export const SIGNED_URL_TTL_MS = 2 * 60 * 60 * 1000

/** The signing window `now` falls in: the same for every call in a half hour. */
export function signingWindow(now: number) {
  const accessibleAt = Math.floor(now / SIGNING_STEP_MS) * SIGNING_STEP_MS
  return { accessibleAt, expires: accessibleAt + SIGNED_URL_TTL_MS }
}

/** A filename safe in a Content-Disposition header: no quotes, slashes or control characters. */
export function dispositionFilename(filename: string | undefined, fallback: string): string {
  // eslint-disable-next-line no-control-regex
  const cleaned = (filename ?? '').replace(/[\u0000-\u001f\u007f"\\/]/g, '').trim().slice(0, 200)
  return cleaned || fallback
}

/** `attachment; filename="…"; filename*=UTF-8''…`: an ASCII name for old browsers, the real one (Hebrew included) for the rest. */
export function attachmentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_')
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

// One window's URLs, so a poll re-signs nothing it signed a moment ago.
const cache = { window: 0, urls: new Map<string, string>() }

async function signed(path: string, disposition: string | undefined, now: number): Promise<string> {
  const { accessibleAt, expires } = signingWindow(now)
  if (cache.window !== accessibleAt) cache.urls = new Map()
  cache.window = accessibleAt
  const key = `${path}\n${disposition ?? ''}`
  const hit = cache.urls.get(key)
  if (hit) return hit
  const [url] = await getAdminBucket()
    .file(path)
    .getSignedUrl({ version: 'v4', action: 'read', accessibleAt, expires, ...(disposition ? { responseDisposition: disposition } : {}) })
  cache.urls.set(key, url)
  return url
}

/**
 * The inbox's URLs for a stored attachment: `url` to show or play it in the
 * page (not for documents, which only download), `downloadUrl` to save it
 * under its name. Nothing for media that wasn't stored, or that can't be signed.
 */
export async function mediaUrls(kind: AttachmentKind, media: LoggedMedia, at: number, now = Date.now()): Promise<{ url?: string; downloadUrl?: string }> {
  const path = media.path
  if (media.status !== 'stored' || !path || !path.startsWith(MEDIA_PREFIX)) return {}
  const ext = path.slice(path.lastIndexOf('.') + 1)
  const filename = dispositionFilename(media.filename, `whatsapp-${kind}-${new Date(at).toISOString().slice(0, 10)}.${ext}`)
  try {
    const [url, downloadUrl] = await Promise.all([
      kind === 'document' ? undefined : signed(path, undefined, now),
      signed(path, attachmentDisposition(filename), now),
    ])
    return { ...(url ? { url } : {}), downloadUrl }
  } catch (err) {
    console.error(`[whatsapp-media] could not sign ${kind} URL:`, err instanceof Error ? err.message : err)
    return {}
  }
}
