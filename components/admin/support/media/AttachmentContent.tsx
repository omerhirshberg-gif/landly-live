'use client'

import type { AttachmentKind } from '@/lib/whatsapp/attachments'
import type { InboxMedia } from '@/lib/whatsapp/adminInbox'
import AudioMessage from './AudioMessage'
import DocumentMessage from './DocumentMessage'
import ImageMessage from './ImageMessage'
import MediaUnavailable from './MediaUnavailable'
import VideoMessage from './VideoMessage'

/** A member's attachment inside their bubble (MessageBubble.tsx); the caption follows it there. */
export default function AttachmentContent({ kind, media, caption }: { kind: AttachmentKind; media: InboxMedia; caption: string }) {
  if (media.status !== 'stored') return <MediaUnavailable kind={kind} media={media} />
  if (kind === 'image') return <ImageMessage media={media} caption={caption} />
  if (kind === 'video') return <VideoMessage media={media} />
  if (kind === 'audio') return <AudioMessage media={media} />
  return <DocumentMessage media={media} />
}
