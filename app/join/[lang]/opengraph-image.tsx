import { isPrelaunchLang, LOCALIZED_LANGS, PRELAUNCH_COPY, type PrelaunchLang } from '@/lib/prelaunch/copy'
import { renderShareCard, shareCardSize, shareCardType } from '@/lib/prelaunch/shareCard'

export const alt = PRELAUNCH_COPY.en.metaTitle
export const size = shareCardSize
export const contentType = shareCardType

// Built ahead with the pages: a chat app's scraper never waits on a render.
export function generateStaticParams() {
  return LOCALIZED_LANGS.map((lang) => ({ lang }))
}

export default async function Image({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return renderShareCard((isPrelaunchLang(lang) ? lang : 'en') as PrelaunchLang)
}
