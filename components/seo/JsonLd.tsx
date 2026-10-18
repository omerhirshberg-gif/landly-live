import { serializeJsonLd } from '@/lib/seo/jsonLd'

// A schema.org JSON-LD block (lib/seo/jsonLd.ts builds them). Rendered on the
// server in a layout or page, as the Next.js JSON-LD guide recommends; the
// payload is escaped so no value can close the script. Nothing for null.
export default function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] | null }) {
  if (!data) return null
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />
}
