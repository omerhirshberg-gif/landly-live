// Member attachments in the support transcript, shared by the server
// (lib/whatsapp/conversationLog.ts, mediaStore.ts) and the inbox UI
// (components/admin/support/media/). No server-only imports.

export type AttachmentKind = 'image' | 'video' | 'audio' | 'document'

export const ATTACHMENT_KINDS: readonly AttachmentKind[] = ['image', 'video', 'audio', 'document']
export const isAttachmentKind = (kind: unknown): kind is AttachmentKind => (ATTACHMENT_KINDS as readonly unknown[]).includes(kind)

/** stored: in Storage. too_large: over 25 MB. failed: Meta, the type check or Storage refused it. unavailable: no token to fetch it with. */
export type MediaStatus = 'stored' | 'too_large' | 'failed' | 'unavailable'

/** How the inbox list names an attachment: "🎤 Voice note", "📷 Photo", "📄 menu.pdf". */
export function attachmentLabel(kind: AttachmentKind, media?: { filename?: string; voice?: boolean }): string {
  if (kind === 'image') return '📷 Photo'
  if (kind === 'video') return '🎥 Video'
  if (kind === 'audio') return media?.voice ? '🎤 Voice note' : '🎵 Audio'
  return `📄 ${media?.filename || 'Document'}`
}
