import type { InboxMedia } from '@/lib/whatsapp/adminInbox'
import MediaUnavailable from './MediaUnavailable'
import { fileSize } from './format'

/** A file: its name, type and size, downloaded (never opened in the page). */
export default function DocumentMessage({ media }: { media: InboxMedia }) {
  if (!media.downloadUrl) return <MediaUnavailable kind="document" media={media} />
  const name = media.filename || 'Document'
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toUpperCase().slice(0, 6) : ''
  return (
    <a
      href={media.downloadUrl}
      aria-label={`Download ${name}`}
      className="flex w-72 max-w-full items-center gap-3 rounded-xl bg-adm-sunken px-3 py-2.5 ring-1 ring-adm-line transition-colors hover:bg-adm-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-adm-accent"
    >
      <i className="fa-regular fa-file-lines shrink-0 text-2xl text-adm-accent" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <bdi dir="auto" className="block truncate text-sm font-semibold text-adm-text">
          {name}
        </bdi>
        <span className="block text-[11px] text-adm-muted">{[ext, fileSize(media.size)].filter(Boolean).join(' · ')}</span>
      </span>
      <i className="fa-solid fa-download shrink-0 text-adm-muted" aria-hidden="true" />
    </a>
  )
}
