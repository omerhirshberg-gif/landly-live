import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import PrelaunchPage from '@/components/prelaunch/PrelaunchPage'
import { LOCALIZED_LANGS, PRELAUNCH_COPY, PRELAUNCH_PATHS, type PrelaunchLang } from '@/lib/prelaunch/copy'
import { countryLabels } from '@/lib/prelaunch/countryLabels'
import { prelaunchLangScript } from '@/lib/prelaunch/langScript'
import { pageMetadata } from '@/lib/seo/site'

const OG_LOCALES: Partial<Record<PrelaunchLang, string>> = { he: 'he_IL', ru: 'ru_RU', fr: 'fr_FR', es: 'es_ES' }

// One static page per language, built ahead; any other path is a 404. English
// is /join itself.
export const dynamicParams = false

export function generateStaticParams() {
  return LOCALIZED_LANGS.map((lang) => ({ lang }))
}

function localized(lang: string): PrelaunchLang | null {
  return (LOCALIZED_LANGS as readonly string[]).includes(lang) ? (lang as PrelaunchLang) : null
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const lang = localized((await params).lang)
  if (!lang) return {}
  const copy = PRELAUNCH_COPY[lang]
  const base = pageMetadata({ title: copy.metaTitle, description: copy.metaDescription, path: PRELAUNCH_PATHS[lang], absoluteTitle: true })
  return { ...base, openGraph: { ...base.openGraph, locale: OG_LOCALES[lang] } }
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const lang = localized((await params).lang)
  if (!lang) notFound()
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: prelaunchLangScript(lang) }} />
      <PrelaunchPage lang={lang} countryLabels={countryLabels(lang)} />
    </>
  )
}
