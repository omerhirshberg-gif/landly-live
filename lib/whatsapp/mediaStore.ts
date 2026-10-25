import 'server-only'
import { createHash } from 'node:crypto'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream as WebReadableStream } from 'node:stream/web'
import { maskPhone } from '@/lib/auth/phoneVerification'
import { getAdminBucket } from '@/lib/firebase/admin'
import { MESSAGE_TTL_MS, type LoggedMedia } from './conversationLog'
import { downloadWhatsAppMedia, fetchWhatsAppMediaInfo, WhatsAppApiError } from './graph'
import type { InboundMedia, MediaType } from './webhookPayload'

// A member's photo, video, audio clip, voice note or file, copied from Meta
// (whose download URL lasts minutes) into Storage for the support inbox:
// whatsapp_media/{waId}/{messageId}.{ext} in getAdminBucket(), the bucket
// lib/firebase/envGuard.ts pins with the project (the dev project locally and
// on Preview, production on Production). storage.rules denies every client, so
// the inbox reads it through short-lived signed URLs (lib/whatsapp/mediaUrls.ts).
// Objects go MEDIA_RETENTION_DAYS after upload, with their transcript, by a
// bucket lifecycle rule (scripts/whatsapp-media-lifecycle.mjs).
//
// The bytes stream straight through: never more than one chunk in memory,
// stopped at MEDIA_MAX_BYTES, hashed on the way against Meta's SHA-256.
// Images must really be JPEG, PNG or WebP (no SVG: it can carry script), video
// and Ogg audio must open with their container's signature, nothing but a
// document may open like markup (signatureProblem), and files that run
// (executables, scripts, HTML) are refused.

export const MEDIA_PREFIX = 'whatsapp_media/'
export const MEDIA_MAX_BYTES = 25 * 1024 * 1024
export const MEDIA_RETENTION_DAYS = MESSAGE_TTL_MS / (24 * 60 * 60 * 1000)
/** Fetching the details and the bytes together; the webhook route allows 60 s (maxDuration). */
const MEDIA_TIMEOUT_MS = 45_000
export const MEDIA_CACHE_CONTROL = 'private, max-age=3600'
/** What WhatsApp records voice notes as; some phones report it as plain audio/ogg. */
export const VOICE_NOTE_TYPE = 'audio/ogg; codecs=opus'

const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
const VIDEO_TYPES: Record<string, string> = { 'video/mp4': 'mp4', 'video/3gpp': '3gp', 'video/quicktime': 'mov', 'video/webm': 'webm' }
const AUDIO_TYPES: Record<string, string> = {
  'audio/ogg': 'ogg',
  'audio/opus': 'opus',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/amr': 'amr',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/webm': 'webm',
}
// Documents: anything that only opens in a viewer. These run, or render as a page on our origin's behalf.
// XML only as the whole subtype (text/xml, image/svg+xml): Office's openxmlformats files are fine.
const BLOCKED_DOCUMENT_TYPE = /html|[/+]xml$|svg|javascript|ecmascript|\/x-(sh|csh|bat|msdos-program|msdownload|msi|dosexec|executable|mach-binary|elf|apple-diskimage|ms-shortcut)$|portable-executable|java-archive|android\.package-archive/
const BLOCKED_EXTENSION = /\.(exe|com|bat|cmd|msi|msix|scr|pif|cpl|dll|sys|ps1|psm1|vbs|vbe|js|mjs|cjs|jse|wsf|wsh|hta|jar|apk|aab|app|dmg|pkg|deb|rpm|sh|bash|zsh|command|html?|xhtml|svgz?|xml|lnk|reg)$/i
const DOCUMENT_EXTENSION = /\.([a-z0-9]{1,8})$/i

/** A Storage-safe object name for Meta's message id (wamid.HBg…=, which may carry "=" or "/"). */
export const safeObjectId = (messageId: string) => messageId.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 200)

/** The MIME type without parameters, lowercased. */
const baseType = (mimeType?: string) => mimeType?.split(';')[0].trim().toLowerCase() ?? ''

/** The stored content type and file extension, or null when the type isn't one the inbox keeps. */
export function storedType(type: MediaType, mimeType: string | undefined, media: Pick<InboundMedia, 'filename' | 'voice'>): { contentType: string; ext: string } | null {
  const base = baseType(mimeType)
  if (type === 'image') return IMAGE_TYPES[base] ? { contentType: base, ext: IMAGE_TYPES[base] } : null
  if (type === 'video') return VIDEO_TYPES[base] ? { contentType: base, ext: VIDEO_TYPES[base] } : null
  if (type === 'audio') {
    // Voice notes are Opus in Ogg whatever the phone calls them; the inbox player keys off the codec.
    if (media.voice || base === 'audio/ogg') return { contentType: VOICE_NOTE_TYPE, ext: 'ogg' }
    return AUDIO_TYPES[base] ? { contentType: base, ext: AUDIO_TYPES[base] } : null
  }
  const filename = media.filename ?? ''
  if (BLOCKED_DOCUMENT_TYPE.test(base) || BLOCKED_EXTENSION.test(filename)) return null
  const ext = filename.match(DOCUMENT_EXTENSION)?.[1].toLowerCase() ?? 'bin'
  return { contentType: base && /^[a-z]+\/[a-z0-9.+-]+$/.test(base) ? base : 'application/octet-stream', ext }
}

/** An image's first bytes, checked against what it claims to be. */
export function imageSignatureMatches(contentType: string, head: Uint8Array): boolean {
  const ascii = (from: number, to: number) => String.fromCharCode(...head.subarray(from, to))
  if (contentType === 'image/jpeg') return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff
  if (contentType === 'image/png') return head[0] === 0x89 && ascii(1, 4) === 'PNG'
  if (contentType === 'image/webp') return ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP'
  return false
}

/** How many leading bytes signatureProblem needs to see. */
export const SIGNATURE_BYTES = 16
// ISO media (MP4, MOV, 3GP, M4A) opens with a box; older QuickTime files may lead with one of these instead of ftyp.
const ISO_BOXES = new Set(['ftyp', 'moov', 'mdat', 'wide', 'free', 'skip'])

/**
 * Why a photo, video or audio file's first bytes aren't what its type says,
 * or null when they are. Images must match exactly; video and Ogg audio are
 * checked where their containers have a fixed signature; anything that opens
 * like markup (Meta's HTML error page, an SVG) is refused for every media type.
 * Documents are not checked here (storedType screens them by type and name).
 */
export function signatureProblem(type: MediaType, contentType: string, head: Uint8Array): string | null {
  if (type === 'document') return null
  const ascii = (from: number, to: number) => String.fromCharCode(...head.subarray(from, to))
  if (/^\s*</.test(ascii(0, SIGNATURE_BYTES))) return `bytes look like markup (HTML or XML), not ${contentType}`
  if (type === 'image') return imageSignatureMatches(contentType, head) ? null : `bytes are not ${contentType}`
  const base = baseType(contentType)
  if (base === 'video/mp4' || base === 'video/quicktime' || base === 'video/3gpp' || base === 'audio/mp4') {
    return ISO_BOXES.has(ascii(4, 8)) ? null : `bytes are not an ISO media file (${base})`
  }
  if (base === 'video/webm' || base === 'audio/webm') {
    return head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3 ? null : `bytes are not WebM (${base})`
  }
  if (base === 'audio/ogg' || base === 'audio/opus') return ascii(0, 4) === 'OggS' ? null : `bytes are not Ogg (${base})`
  return null
}

/** Meta sends SHA-256 as hex from the Graph API and as base64 in webhooks. */
export function sha256Matches(expected: string, digest: Buffer): boolean {
  const value = expected.trim()
  return value.toLowerCase() === digest.toString('hex') || value.replace(/=+$/, '') === digest.toString('base64').replace(/=+$/, '')
}

class MediaRefused extends Error {
  constructor(readonly status: 'too_large' | 'failed', message: string) {
    super(message)
  }
}

/**
 * Copies the attachment into Storage. Never throws: whatever happens comes
 * back as the transcript's LoggedMedia, with status saying whether the inbox
 * can show it.
 */
export async function storeInboundMedia(waId: string, messageId: string, media: InboundMedia, now = Date.now()): Promise<LoggedMedia> {
  const who = maskPhone(`+${waId}`)
  const base: LoggedMedia = {
    status: 'failed',
    ...(media.mediaId ? { mediaId: media.mediaId } : {}),
    ...(media.mimeType ? { mimeType: baseType(media.mimeType) } : {}),
    ...(media.filename ? { filename: media.filename } : {}),
    ...(media.voice ? { voice: true } : {}),
  }
  if (!process.env.WHATSAPP_ACCESS_TOKEN) {
    console.info(`[whatsapp-media] ${media.type} from ${who} not fetched: WHATSAPP_ACCESS_TOKEN is not configured`)
    return { ...base, status: 'unavailable' }
  }
  if (!media.mediaId) {
    console.info(`[whatsapp-media] ${media.type} from ${who} not stored: the webhook gave no usable media id`)
    return base
  }
  const mediaId = media.mediaId

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), MEDIA_TIMEOUT_MS)
  const path = `${MEDIA_PREFIX}${waId}/${safeObjectId(messageId)}`
  let objectPath: string | undefined
  let described = base
  try {
    const info = await fetchWhatsAppMediaInfo(mediaId, controller.signal)
    const type = storedType(media.type, info.mimeType ?? media.mimeType, media)
    if (!type) throw new MediaRefused('failed', `type ${baseType(info.mimeType ?? media.mimeType) || 'unknown'} is not kept`)
    described = { ...base, mimeType: type.contentType }
    if (info.size !== undefined && info.size > MEDIA_MAX_BYTES) {
      console.info(`[whatsapp-media] ${media.type} from ${who} not stored: ${info.size} bytes is over the limit`)
      return { ...described, status: 'too_large', size: info.size }
    }

    const res = await downloadWhatsAppMedia(info.url, controller.signal)
    const declared = Number(res.headers.get('content-length'))
    if (Number.isFinite(declared) && declared > MEDIA_MAX_BYTES) {
      await res.body?.cancel().catch(() => {})
      return { ...described, status: 'too_large', size: declared }
    }

    const hash = createHash('sha256')
    let size = 0
    // The first SIGNATURE_BYTES are held back until they can be checked, however the stream splits them.
    let head: Buffer | null = Buffer.alloc(0)
    const release = (guard: Transform, bytes: Buffer): Error | null => {
      const problem = signatureProblem(media.type, type.contentType, bytes)
      if (problem) return new MediaRefused('failed', `${problem} (first bytes ${bytes.subarray(0, 8).toString('hex') || 'none'})`)
      head = null
      hash.update(bytes)
      guard.push(bytes)
      return null
    }
    const guard = new Transform({
      transform(chunk: Buffer, _encoding, done) {
        size += chunk.length
        if (size > MEDIA_MAX_BYTES) return done(new MediaRefused('too_large', `over ${MEDIA_MAX_BYTES} bytes`))
        if (head) {
          head = Buffer.concat([head, chunk])
          return done(head.length >= SIGNATURE_BYTES ? release(this, head) : null)
        }
        hash.update(chunk)
        done(null, chunk)
      },
      flush(done) {
        done(head ? release(this, head) : null)
      },
    })

    objectPath = `${path}.${type.ext}`
    const file = getAdminBucket().file(objectPath)
    await pipeline(
      Readable.fromWeb(res.body as unknown as WebReadableStream<Uint8Array>),
      guard,
      file.createWriteStream({
        resumable: false,
        contentType: type.contentType,
        metadata: {
          cacheControl: MEDIA_CACHE_CONTROL,
          metadata: { waId, messageId, expiresAt: new Date(now + MESSAGE_TTL_MS).toISOString() },
        },
      }),
      { signal: controller.signal }
    )

    const digest = hash.digest()
    const expected = info.sha256 ?? media.sha256
    if (expected && !sha256Matches(expected, digest)) console.warn(`[whatsapp-media] ${media.type} from ${who}: SHA-256 differs from Meta's; stored anyway`)
    console.info(`[whatsapp-media] stored ${media.type} from ${who} (${size} bytes)`)
    return { ...described, status: 'stored', path: objectPath, size }
  } catch (err) {
    // A refused or broken upload leaves nothing half-written behind.
    if (objectPath) await getAdminBucket().file(objectPath).delete({ ignoreNotFound: true }).catch(() => {})
    if (err instanceof MediaRefused) {
      console.info(`[whatsapp-media] ${media.type} from ${who} not stored: ${err.message}`)
      return { ...described, status: err.status }
    }
    const reason = err instanceof WhatsAppApiError ? `${err.code}: ${err.message}` : err instanceof Error ? err.message : String(err)
    console.error(`[whatsapp-media] ${media.type} from ${who} not stored (${reason})`)
    return described
  } finally {
    clearTimeout(timer)
  }
}
