import type { Metadata } from 'next'
import JsonLd from '@/components/seo/JsonLd'
import { olimServiceJsonLd } from '@/lib/seo/jsonLd'
import { OLIM_DESCRIPTION, OLIM_TITLE, pageMetadata } from '@/lib/seo/site'

// /olim is a client component, so its tab title, search metadata and
// structured data (the Aliyah and lone soldier help as a Service) live here.
export const metadata: Metadata = pageMetadata({ title: OLIM_TITLE, description: OLIM_DESCRIPTION, path: '/olim' })

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={olimServiceJsonLd()} />
      {children}
    </>
  )
}
