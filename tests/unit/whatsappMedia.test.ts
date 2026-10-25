import { createHash } from 'node:crypto'
import { Writable } from 'node:stream'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryFirestore } from '../helpers/memoryFirestore'

type Upload = { path: string; options: Record<string, unknown>; bytes: Buffer }
const mocks = vi.hoisted(() => ({
  store: null as unknown as MemoryFirestore,
  uploads: [] as Upload[],
  deleted: [] as string[],
  signed: [] as { path: string; options: Record<string, unknown> }[],
}))
const fakeBucket = {
  file: (path: string) => ({
    createWriteStream: (options: Record<string, unknown>) => {
      const chunks: Buffer[] = []
      return new Writable({
        write(chunk: Buffer, _encoding, done) {
          chunks.push(chunk)
          done()
        },
        final(done) {
          mocks.uploads.push({ path, options, bytes: Buffer.concat(chunks) })
          done()
        },
      })
    },
    delete: async () => {
      mocks.deleted.push(path)
    },
    getSignedUrl: async (options: Record<string, unknown>) => {
      mocks.signed.push({ path, options })
      return [`https://storage.googleapis.com/landly-dev/${path}?d=${options.accessibleAt}&x=${options.expires}&rd=${encodeURIComponent(String(options.responseDisposition ?? ''))}`]
    },
  }),
}
vi.mock('@/lib/firebase/admin', () => ({ getAdminDb: () => mocks.store.db, getAdminBucket: () => fakeBucket }))

import MessageBubble from '@/components/admin/support/MessageBubble'
import type { TranscriptMessage } from '@/components/admin/support/transcript'
import { snippetOf, type LoggedMessage } from '@/lib/whatsapp/conversationLog'
import { getConversation } from '@/lib/whatsapp/adminInbox'
import {
  imageSignatureMatches,
  MEDIA_CACHE_CONTROL,
  MEDIA_MAX_BYTES,
  safeObjectId,
  sha256Matches,
  storedType,
  storeInboundMedia,
  VOICE_NOTE_TYPE,
} from '@/lib/whatsapp/mediaStore'
import { attachmentDisposition, mediaUrls, SIGNED_URL_TTL_MS, SIGNING_STEP_MS, signingWindow } from '@/lib/whatsapp/mediaUrls'
import { decide, type BotContext } from '@/lib/whatsapp/supportBot'
import { handleInboundEvent } from '@/lib/whatsapp/supportBotHandler'
import { parseWebhookPayload, type InboundEvent, type InboundMedia } from '@/lib/whatsapp/webhookPayload'

const WA_ID = '972501234567'
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 7)])
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
const OGG = Buffer.concat([Buffer.from('OggS'), Buffer.alloc(200, 1)])

function payload(messages: unknown[]) {
  return {
    object: 'whatsapp_business_account',
    entry: [{ changes: [{ field: 'messages', value: { metadata: { phone_number_id: '42' }, contacts: [{ profile: { name: 'Dana' }, wa_id: WA_ID }], messages } }] }],
  }
}
const message = (id: string, type: string, body: Record<string, unknown>) => ({ from: WA_ID, id, timestamp: '1761300000', type, [type]: body })

/** Meta's two calls: the media's details, then its bytes from the CDN. */
function stubMeta(bytes: Buffer, info: Record<string, unknown> = {}, { contentLength = true } = {}) {
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer token')
    if (url.startsWith('https://graph.facebook.com/')) {
      return Response.json({ url: 'https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=1', mime_type: 'image/png', file_size: bytes.length, ...info })
    }
    const half = Math.ceil(bytes.length / 2)
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(bytes.subarray(0, half)))
        controller.enqueue(new Uint8Array(bytes.subarray(half)))
        controller.close()
      },
    })
    return new Response(body, { headers: contentLength ? { 'content-length': String(bytes.length) } : {} })
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}

const image: InboundMedia = { type: 'image', mediaId: 'MEDIA1', mimeType: 'image/png' }

beforeEach(() => {
  mocks.store = new MemoryFirestore()
  mocks.uploads = []
  mocks.deleted = []
  mocks.signed = []
  vi.stubEnv('WHATSAPP_ACCESS_TOKEN', 'token')
  vi.stubEnv('APP_URL', 'https://landly.test/')
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('webhook attachments', () => {
  it('reads photos, videos, voice notes and files, with their captions and names', () => {
    const events = parseWebhookPayload(
      payload([
        message('a', 'image', { id: 'IMG', mime_type: 'image/jpeg', sha256: 'abc=', caption: 'The voucher won’t scan' }),
        message('b', 'audio', { id: 'VOICE', mime_type: 'audio/ogg; codecs=opus', voice: true }),
        message('c', 'document', { id: 'DOC', mime_type: 'application/pdf', filename: 'קבלה.pdf', caption: 'receipt' }),
        message('d', 'video', { id: 'VID', mime_type: 'video/mp4' }),
      ])
    )
    expect(events.map((e) => e.kind)).toEqual(['media', 'media', 'media', 'media'])
    expect(events[0]).toMatchObject({ media: { type: 'image', mediaId: 'IMG', mimeType: 'image/jpeg', sha256: 'abc=', caption: 'The voucher won’t scan' } })
    expect(events[1]).toMatchObject({ media: { type: 'audio', mediaId: 'VOICE', voice: true } })
    expect(events[2]).toMatchObject({ media: { type: 'document', filename: 'קבלה.pdf', caption: 'receipt' } })
    expect(events[3]).toMatchObject({ media: { type: 'video', mediaId: 'VID' } })
  })

  it('leaves stickers, locations and attachments without a usable id as other', () => {
    const events = parseWebhookPayload(
      payload([message('a', 'sticker', { id: 'STK' }), message('b', 'location', { latitude: 1 }), message('c', 'image', {}), message('d', 'image', { id: '../../me' })])
    )
    expect(events.map((e) => [e.kind, e.kind === 'other' ? e.media : null])).toEqual([
      ['other', 'sticker'],
      ['other', 'location'],
      ['other', 'image'],
      ['other', 'image'],
    ])
  })

  it('answers an attachment exactly as it answered any other message', () => {
    const base = { messageId: 'm', waId: WA_ID, at: 0 }
    const asMedia = { ...base, kind: 'media', media: image } as InboundEvent
    const asOther = { ...base, kind: 'other', media: 'image' } as InboundEvent
    const contexts: Partial<BotContext>[] = [{ needsLanguage: true }, {}, { status: 'awaiting_user_inquiry', inquiryPromptedAt: 0 }, { status: 'escalated', escalatedAt: 0 }]
    for (const ctx of contexts) {
      const full = { lang: 'en', origin: 'https://landly.test', isMember: false, needsLanguage: false, now: 1000, ...ctx } as BotContext
      expect(decide(asMedia, full)).toEqual(decide(asOther, full))
    }
  })
})

describe('what the inbox keeps', () => {
  it('keeps only real JPEG, PNG and WebP images, never SVG', () => {
    expect(storedType('image', 'image/png', {})).toEqual({ contentType: 'image/png', ext: 'png' })
    expect(storedType('image', 'image/svg+xml', {})).toBeNull()
    expect(storedType('image', 'image/gif', {})).toBeNull()
    expect(imageSignatureMatches('image/png', PNG)).toBe(true)
    expect(imageSignatureMatches('image/png', SVG)).toBe(false)
    expect(imageSignatureMatches('image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(true)
    expect(imageSignatureMatches('image/webp', Buffer.from('RIFF\0\0\0\0WEBPVP8 '))).toBe(true)
  })

  it('stores every voice note as Opus in Ogg', () => {
    expect(VOICE_NOTE_TYPE).toBe('audio/ogg; codecs=opus')
    expect(storedType('audio', 'audio/ogg', {})).toEqual({ contentType: VOICE_NOTE_TYPE, ext: 'ogg' })
    expect(storedType('audio', 'audio/mpeg', { voice: true })).toEqual({ contentType: VOICE_NOTE_TYPE, ext: 'ogg' })
    expect(storedType('audio', 'audio/mpeg', {})).toEqual({ contentType: 'audio/mpeg', ext: 'mp3' })
  })

  it('refuses files that run or render as a page, and keeps the rest', () => {
    expect(storedType('document', 'application/pdf', { filename: 'Receipt.PDF' })).toEqual({ contentType: 'application/pdf', ext: 'pdf' })
    expect(storedType('document', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', { filename: 'a.docx' })?.ext).toBe('docx')
    for (const [mime, filename] of [
      ['application/x-msdownload', 'setup.exe'],
      ['application/pdf', 'invoice.pdf.exe'],
      ['text/html', 'page.html'],
      ['image/svg+xml', 'logo.svg'],
      ['application/javascript', 'x.js'],
      ['application/vnd.android.package-archive', 'app.apk'],
      ['application/octet-stream', 'run.sh'],
      ['text/xml', 'feed.xml'],
      ['application/x-msdos-program', 'x.com'],
    ]) {
      expect(storedType('document', mime, { filename }), filename).toBeNull()
    }
  })

  it('names objects safely and checks Meta’s hash in either encoding', () => {
    expect(safeObjectId('wamid.HBgM/OTcy+NTA=')).toBe('wamid.HBgM_OTcy_NTA_')
    const digest = createHash('sha256').update(PNG).digest()
    expect(sha256Matches(digest.toString('hex'), digest)).toBe(true)
    expect(sha256Matches(digest.toString('base64'), digest)).toBe(true)
    expect(sha256Matches('00', digest)).toBe(false)
  })
})

describe('storeInboundMedia', () => {
  it('streams the file into whatsapp_media/{waId}/ with a private hour of caching and its expiry', async () => {
    const fetch = stubMeta(PNG, { sha256: createHash('sha256').update(PNG).digest('hex') })
    const now = Date.UTC(2026, 9, 25, 10)
    const media = await storeInboundMedia(WA_ID, 'wamid.HB/1=', image, now)
    expect(media).toEqual({ status: 'stored', path: `whatsapp_media/${WA_ID}/wamid.HB_1_.png`, mimeType: 'image/png', size: PNG.length })
    expect(fetch.mock.calls[0][0]).toBe('https://graph.facebook.com/v21.0/MEDIA1')
    const [upload] = mocks.uploads
    expect(upload.bytes.equals(PNG)).toBe(true)
    expect(upload.options).toMatchObject({
      resumable: false,
      contentType: 'image/png',
      metadata: { cacheControl: MEDIA_CACHE_CONTROL, metadata: { waId: WA_ID, messageId: 'wamid.HB/1=', expiresAt: '2027-04-23T10:00:00.000Z' } },
    })
    expect(MEDIA_CACHE_CONTROL).toBe('private, max-age=3600')
    expect(console.warn).not.toHaveBeenCalled()
  })

  it('logs a hash that doesn’t match, and keeps the file', async () => {
    stubMeta(PNG, { sha256: 'ffff' })
    expect((await storeInboundMedia(WA_ID, 'w1', image)).status).toBe('stored')
    expect(String(vi.mocked(console.warn).mock.calls[0][0])).toContain('SHA-256 differs')
  })

  it('stores a voice note as Opus in Ogg', async () => {
    stubMeta(OGG, { mime_type: 'audio/ogg' })
    const media = await storeInboundMedia(WA_ID, 'w2', { type: 'audio', mediaId: 'V', voice: true })
    expect(media).toMatchObject({ status: 'stored', mimeType: VOICE_NOTE_TYPE, voice: true, path: `whatsapp_media/${WA_ID}/w2.ogg` })
    expect(mocks.uploads[0].options.contentType).toBe(VOICE_NOTE_TYPE)
  })

  it('skips a file Meta says is over 25 MB without downloading it', async () => {
    const fetch = stubMeta(PNG, { file_size: MEDIA_MAX_BYTES + 1 })
    expect(await storeInboundMedia(WA_ID, 'w3', image)).toMatchObject({ status: 'too_large', size: MEDIA_MAX_BYTES + 1 })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(mocks.uploads).toHaveLength(0)
  })

  it('stops a download that runs past 25 MB, leaving nothing behind', async () => {
    stubMeta(Buffer.concat([PNG, Buffer.alloc(MEDIA_MAX_BYTES)]), { file_size: undefined }, { contentLength: false })
    expect((await storeInboundMedia(WA_ID, 'w4', image)).status).toBe('too_large')
    expect(mocks.uploads).toHaveLength(0)
    expect(mocks.deleted).toEqual([`whatsapp_media/${WA_ID}/w4.png`])
  })

  it('refuses an SVG passed off as a PNG', async () => {
    stubMeta(SVG)
    expect((await storeInboundMedia(WA_ID, 'w5', image)).status).toBe('failed')
    expect(mocks.uploads).toHaveLength(0)
  })

  it('refuses an executable sent as a file, before downloading it', async () => {
    const fetch = stubMeta(Buffer.from('MZ'), { mime_type: 'application/x-msdownload' })
    expect(await storeInboundMedia(WA_ID, 'w6', { type: 'document', mediaId: 'D', filename: 'setup.exe' })).toMatchObject({ status: 'failed', filename: 'setup.exe' })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('sends the token only to Meta’s own hosts', async () => {
    stubMeta(PNG, { url: 'https://evil.example/steal' })
    expect((await storeInboundMedia(WA_ID, 'w7', image)).status).toBe('failed')
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)
  })

  it('reports Meta’s refusals as failed, and a missing token as unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: { code: 100, message: 'Invalid media id' } }, { status: 400 })))
    expect((await storeInboundMedia(WA_ID, 'w8', image)).status).toBe('failed')
    vi.stubEnv('WHATSAPP_ACCESS_TOKEN', '')
    expect((await storeInboundMedia(WA_ID, 'w9', image)).status).toBe('unavailable')
  })
})

describe('the transcript and the inbox list', () => {
  const entry = (over: Partial<LoggedMessage>): LoggedMessage => ({ direction: 'in', author: 'member', kind: 'text', text: '', at: 0, ...over })

  it('names attachments in the snippet, with the caption after', () => {
    expect(snippetOf(entry({ kind: 'audio', media: { status: 'stored', voice: true } })).text).toBe('🎤 Voice note')
    expect(snippetOf(entry({ kind: 'audio', media: { status: 'stored' } })).text).toBe('🎵 Audio')
    expect(snippetOf(entry({ kind: 'image', text: 'broken QR' })).text).toBe('📷 Photo · broken QR')
    expect(snippetOf(entry({ kind: 'video' })).text).toBe('🎥 Video')
    expect(snippetOf(entry({ kind: 'document', media: { status: 'stored', filename: 'receipt.pdf' } })).text).toBe('📄 receipt.pdf')
    expect(snippetOf(entry({ kind: 'media', text: '(sticker)' })).text).toBe('(sticker)')
  })

  it('logs the attachment once it’s stored, while the bot answers as before', async () => {
    stubMeta(PNG)
    const now = Date.now()
    const event = { messageId: 'wamid.photo', waId: WA_ID, at: now, kind: 'media', media: { ...image, caption: 'QR' } } as InboundEvent
    await handleInboundEvent(event, now)
    const messages = mocks.store.list(`whatsappConversations/${WA_ID}/messages`)
    expect(messages['wamid.photo']).toMatchObject({ kind: 'image', text: 'QR', media: { status: 'stored', path: `whatsapp_media/${WA_ID}/wamid.photo.png`, mimeType: 'image/png' } })
    expect(Object.keys(messages).length).toBeGreaterThan(1)
    expect(mocks.store.read(`whatsappConversations/${WA_ID}`)?.lastSnippet).toMatchObject({ text: '📷 Photo · QR', direction: 'in' })
  })
})

describe('signed URLs', () => {
  it('signs as of the half hour, for two hours, so every poll in it gets the same URL', () => {
    const start = Date.UTC(2026, 9, 25, 10, 30)
    expect(signingWindow(start)).toEqual({ accessibleAt: start, expires: start + SIGNED_URL_TTL_MS })
    expect(signingWindow(start + SIGNING_STEP_MS - 1)).toEqual(signingWindow(start))
    expect(signingWindow(start + SIGNING_STEP_MS).accessibleAt).toBe(start + SIGNING_STEP_MS)
    // Handed out at the window's last moment, a URL still has 90 minutes.
    expect(signingWindow(start + SIGNING_STEP_MS - 1).expires - (start + SIGNING_STEP_MS)).toBe(90 * 60 * 1000)
  })

  it('gives media a page URL and a download, and documents only the download, under their name', async () => {
    const now = Date.UTC(2026, 9, 25, 10, 40)
    const photo = await mediaUrls('image', { status: 'stored', path: `whatsapp_media/${WA_ID}/a.jpg` }, now, now)
    const again = await mediaUrls('image', { status: 'stored', path: `whatsapp_media/${WA_ID}/a.jpg` }, now, now + 60_000)
    expect(again).toEqual(photo)
    expect(photo.url).toContain(`d=${Date.UTC(2026, 9, 25, 10, 30)}`)
    expect(photo.downloadUrl).toContain(encodeURIComponent('attachment; filename="whatsapp-image-2026-10-25.jpg"'))
    const pdf = await mediaUrls('document', { status: 'stored', path: `whatsapp_media/${WA_ID}/b.pdf`, filename: 'קבלה "1".pdf' }, now, now)
    expect(pdf.url).toBeUndefined()
    expect(pdf.downloadUrl).toContain(encodeURIComponent(attachmentDisposition('קבלה 1.pdf')))
    expect(attachmentDisposition('קבלה.pdf')).toBe(`attachment; filename="____.pdf"; filename*=UTF-8''${encodeURIComponent('קבלה.pdf')}`)
    for (const { options } of mocks.signed) expect(options).toMatchObject({ version: 'v4', action: 'read' })
  })

  it('signs nothing for media that wasn’t stored, or outside whatsapp_media/', async () => {
    expect(await mediaUrls('image', { status: 'too_large' }, 0)).toEqual({})
    expect(await mediaUrls('image', { status: 'stored', path: 'users/x/avatar.png' }, 0)).toEqual({})
    expect(mocks.signed).toHaveLength(0)
  })

  it('hands the inbox URLs, never the Storage path', async () => {
    const now = Date.now()
    const at = (await import('firebase-admin/firestore')).Timestamp.fromMillis(now)
    mocks.store.seed(`whatsappConversations/${WA_ID}`, { lastInboundAt: at })
    mocks.store.seed(`whatsappConversations/${WA_ID}/messages/w1`, {
      direction: 'in',
      author: 'member',
      kind: 'audio',
      text: '',
      at,
      media: { status: 'stored', path: `whatsapp_media/${WA_ID}/w1.ogg`, mimeType: VOICE_NOTE_TYPE, voice: true, size: 9000 },
    })
    const chat = await getConversation(WA_ID, now)
    const [voice] = chat!.messages
    expect(voice.media).toMatchObject({ status: 'stored', voice: true, mimeType: VOICE_NOTE_TYPE, size: 9000 })
    expect(voice.media?.url).toMatch(/^https:\/\/storage\.googleapis\.com\//)
    expect(JSON.stringify(voice)).not.toContain('"path"')
  })
})

describe('attachment bubbles', () => {
  const bubble = (over: Partial<TranscriptMessage>) =>
    renderToStaticMarkup(createElement(MessageBubble, { message: { id: 'm', direction: 'in', author: 'member', kind: 'image', text: '', at: '2026-10-25T10:00:00.000Z', ...over } }))

  it('shows a photo that opens full screen, with its caption kept as the member wrote it', () => {
    const html = bubble({ text: '[Not a button] הקוד לא עובד', media: { status: 'stored', url: 'https://s/photo', downloadUrl: 'https://s/dl' } })
    expect(html).toContain('<img src="https://s/photo"')
    expect(html).toContain('aria-label="Open photo"')
    expect(html).toMatch(/<p dir="auto"[^>]*>\[Not a button\] הקוד לא עובד<\/p>/)
  })

  it('plays voice notes and video in the bubble', () => {
    const voice = bubble({ kind: 'audio', media: { status: 'stored', voice: true, mimeType: VOICE_NOTE_TYPE, url: 'https://s/v', downloadUrl: 'https://s/vd', size: 20480 } })
    expect(voice).toContain('<audio controls="" preload="metadata" src="https://s/v"')
    expect(voice).toContain('Voice note')
    expect(voice).toContain('20 KB')
    expect(bubble({ kind: 'video', media: { status: 'stored', url: 'https://s/vid' } })).toContain('<video controls="" playsInline="" preload="metadata" src="https://s/vid"')
  })

  it('offers a file as a download under its name', () => {
    const html = bubble({ kind: 'document', media: { status: 'stored', filename: 'receipt.pdf', size: 3 * 1024 * 1024, downloadUrl: 'https://s/doc' } })
    expect(html).toContain('href="https://s/doc"')
    expect(html).toContain('aria-label="Download receipt.pdf"')
    expect(html).toContain('PDF · 3.0 MB')
  })

  it('explains an attachment the inbox couldn’t keep', () => {
    expect(bubble({ media: { status: 'too_large' } })).toContain('over 25 MB')
    expect(bubble({ kind: 'audio', media: { status: 'unavailable', voice: true } })).toContain('voice note wasn&#x27;t downloaded')
    expect(bubble({ kind: 'document', media: { status: 'failed', filename: 'setup.exe' } })).toContain('unsupported or unsafe file')
    expect(bubble({ media: { status: 'stored' } })).toContain('didn&#x27;t load')
  })
})
