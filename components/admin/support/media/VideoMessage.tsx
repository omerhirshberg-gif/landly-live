'use client'

import type { InboxMedia } from '@/lib/whatsapp/adminInbox'
import MediaUnavailable from './MediaUnavailable'
import { useFailedSrc } from './useFailedSrc'
import { useAdminT } from '@/lib/admin/translations'

/** A video, played in the bubble with the browser's controls. */
export default function VideoMessage({ media }: { media: InboxMedia }) {
  const { t } = useAdminT()
  const { broken, onError } = useFailedSrc(media.url)
  if (!media.url || broken) return <MediaUnavailable kind="video" media={media} />
  return (
    <video controls playsInline preload="metadata" src={media.url} onError={onError} aria-label={t('media.video')} className="block max-h-80 w-72 max-w-full rounded-xl bg-black">
      <a href={media.downloadUrl}>{t('media.downloadVideo')}</a>
    </video>
  )
}
