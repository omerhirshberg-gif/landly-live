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
      className="flex w-72 max-w-full items-center gap-3 rounded-xl bg-[#F8FAFC] px-3 py-2.5 ring-1 ring-[#E2E8F0] transition-colors hover:bg-[#F1F5F9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0038B8]"
    >
      <i className="fa-regular fa-file-lines shrink-0 text-2xl text-[#0038B8]" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <bdi dir="auto" className="block truncate text-sm font-semibold text-[#0F172A]">
          {name}
        </bdi>
        <span className="block text-[11px] text-[#64748B]">{[ext, fileSize(media.size)].filter(Boolean).join(' · ')}</span>
      </span>
      <i className="fa-solid fa-download shrink-0 text-[#64748B]" aria-hidden="true" />
    </a>
  )
}
