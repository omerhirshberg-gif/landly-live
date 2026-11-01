import type { Metadata } from 'next'
import PrelaunchPage from '@/components/prelaunch/PrelaunchPage'
import { PRELAUNCH_COPY, PRELAUNCH_PATHS } from '@/lib/prelaunch/copy'
import { prelaunchLangScript } from '@/lib/prelaunch/langScript'
import { pageMetadata } from '@/lib/seo/site'

const copy = PRELAUNCH_COPY.en

export const metadata: Metadata = pageMetadata({ title: copy.metaTitle, description: copy.metaDescription, path: PRELAUNCH_PATHS.en, absoluteTitle: true })

// English, for every visitor and ad. Static, so traffic is answered from the
// CDN; query strings are read in the browser (PrelaunchPage), and ?lang= is a
// redirect in next.config.js.
export default function Page() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: prelaunchLangScript('en') }} />
      <PrelaunchPage lang="en" />
    </>
  )
}
