import { Readable } from 'node:stream'
import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { getAdminBucket, getAdminDb } from '@/lib/firebase/admin'
import { WA_ID } from '@/lib/whatsapp/adminInbox'
import { isAttachmentKind } from '@/lib/whatsapp/attachments'
import { MEDIA_CACHE_CONTROL, MEDIA_PREFIX } from '@/lib/whatsapp/mediaStore'

// One stored member attachment's bytes, from our own origin, for the support
// inbox to decode where the browser can't play the format itself (a voice
// note in Safari on iPhone: components/admin/support/media/decodeOggOpus.ts).
// The message is looked up by conversation and id, so only files the
// transcript points at, under that member's whatsapp_media/{waId}/, are served.

// Meta's wamid… ids are base64 with "=" padding; generated ids are alphanumeric.
const MESSAGE_ID = /^[A-Za-z0-9._=+-]{1,200}$/
const CONTENT_TYPE = /^[a-z]+\/[a-z0-9.+-]+(; ?codecs=[a-z0-9.]+)?$/

export async function GET(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError

  const params = new URL(request.url).searchParams
  const waId = params.get('waId') ?? ''
  const id = params.get('id') ?? ''
  if (!WA_ID.test(waId) || !MESSAGE_ID.test(id)) return NextResponse.json({ error: 'Invalid attachment.' }, { status: 400 })

  const snapshot = await getAdminDb().collection('whatsappConversations').doc(waId).collection('messages').doc(id).get()
  const data = snapshot.data()
  const path = data?.media?.path
  if (!data || !isAttachmentKind(data.kind) || data.media?.status !== 'stored' || typeof path !== 'string' || !path.startsWith(`${MEDIA_PREFIX}${waId}/`)) {
    return NextResponse.json({ error: 'Attachment not found.' }, { status: 404 })
  }

  const file = getAdminBucket().file(path)
  const [exists] = await file.exists()
  if (!exists) return NextResponse.json({ error: 'Attachment not found.' }, { status: 404 })
  const mimeType = typeof data.media.mimeType === 'string' && CONTENT_TYPE.test(data.media.mimeType) ? data.media.mimeType : 'application/octet-stream'
  return new Response(Readable.toWeb(file.createReadStream()) as ReadableStream<Uint8Array>, {
    headers: {
      'Content-Type': mimeType,
      'Cache-Control': MEDIA_CACHE_CONTROL,
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'attachment',
      ...(typeof data.media.size === 'number' ? { 'Content-Length': String(data.media.size) } : {}),
    },
  })
}
