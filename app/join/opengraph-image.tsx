import { PRELAUNCH_COPY } from '@/lib/prelaunch/copy'
import { renderShareCard, shareCardSize, shareCardType } from '@/lib/prelaunch/shareCard'

export const alt = PRELAUNCH_COPY.en.metaTitle
export const size = shareCardSize
export const contentType = shareCardType

export default function Image() {
  return renderShareCard('en')
}
