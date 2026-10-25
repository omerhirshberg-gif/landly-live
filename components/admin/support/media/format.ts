import type { AttachmentKind } from '@/lib/whatsapp/attachments'
import type { InboxMedia } from '@/lib/whatsapp/adminInbox'

// Words for attachments in the support inbox (English, like the rest of the admin UI).

/** "840 KB", "3.2 MB". */
export function fileSize(bytes?: number): string {
  if (bytes === undefined || !Number.isFinite(bytes)) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** "photo", "voice note", "file": what the member sent, for sentences. */
export function attachmentNoun(kind: AttachmentKind, media?: Pick<InboxMedia, 'voice'>): string {
  if (kind === 'image') return 'photo'
  if (kind === 'video') return 'video'
  if (kind === 'audio') return media?.voice ? 'voice note' : 'audio clip'
  return 'file'
}
