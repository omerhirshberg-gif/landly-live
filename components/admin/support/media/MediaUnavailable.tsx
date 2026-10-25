import type { AttachmentKind } from '@/lib/whatsapp/attachments'
import type { InboxMedia } from '@/lib/whatsapp/adminInbox'
import { attachmentNoun } from './format'

const ICON: Record<AttachmentKind, string> = { image: 'fa-image', video: 'fa-film', audio: 'fa-microphone', document: 'fa-file' }

/** Why an attachment can't be shown: over 25 MB, refused, not fetched here, or its link didn't load. */
export function unavailableReason(kind: AttachmentKind, media: InboxMedia): string {
  const noun = attachmentNoun(kind, media)
  if (media.status === 'too_large') return `This ${noun} is over 25 MB, so it wasn't saved. Ask the member to send it another way.`
  if (media.status === 'unavailable') return `This ${noun} wasn't downloaded: WhatsApp isn't connected in this environment.`
  if (media.status === 'failed') return `This ${noun} couldn't be saved (an unsupported or unsafe file, or WhatsApp didn't send it).`
  return `This ${noun} didn't load. It will try again in a moment.`
}

/** The stand-in for an attachment the inbox can't show. */
export default function MediaUnavailable({ kind, media }: { kind: AttachmentKind; media: InboxMedia }) {
  return (
    <div className="flex w-72 max-w-full items-start gap-2.5 rounded-xl bg-[#F8FAFC] px-3 py-2.5 text-sm ring-1 ring-[#E2E8F0]">
      <i className={`fa-regular ${ICON[kind]} mt-0.5 shrink-0 text-[#94A3B8]`} aria-hidden="true" />
      <p className="min-w-0 text-[13px] leading-snug text-[#64748B]">
        {media.filename && (
          <bdi dir="auto" className="block truncate font-medium text-[#334155]">
            {media.filename}
          </bdi>
        )}
        {unavailableReason(kind, media)}
      </p>
    </div>
  )
}
