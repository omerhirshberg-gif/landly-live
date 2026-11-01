import { ImageResponse } from 'next/og'
import sharp from 'sharp'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ARCH, ARROW, EMBLEM_VIEWBOX, STAR } from '@/lib/brand/emblemPaths'
import { WORDMARK_PATH, WORDMARK_VIEWBOX } from '@/lib/brand/wordmarkPath'
import { visualHebrewLine } from '@/lib/seo/ogText'
import { PRELAUNCH_COPY, type PrelaunchLang } from './copy'

// The link preview for a shared /join link, built at build time like
// app/opengraph-image.tsx: this is what friends see in WhatsApp. Hebrew goes
// through visualHebrewLine because the renderer has no right-to-left layout, and
// the render is re-encoded as a light JPEG for chat apps' scrapers. The fonts are
// bundled, so the build never fetches one: Heebo for Hebrew, Manrope for Latin
// accents and Cyrillic, which Heebo's subset lacks.
export const shareCardSize = { width: 1200, height: 630 }
export const shareCardType = 'image/jpeg'

const font = (file: string) => readFile(join(process.cwd(), 'lib/brand/fonts', file))

export async function renderShareCard(lang: PrelaunchLang): Promise<Response> {
  const copy = PRELAUNCH_COPY[lang]
  const hebrew = lang === 'he'
  const line = (text: string) => (hebrew ? visualHebrewLine(text) : text)
  const [heeboBold, heeboMedium, heeboLatin, manropeLatin, manropeCyrillic] = await Promise.all([
    font('Heebo-ExtraBold-Hebrew.woff'),
    font('Heebo-Medium-Hebrew.woff'),
    font('Heebo-ExtraBold-Latin.woff'),
    font('Manrope-ExtraBold-Latin.woff'),
    font('Manrope-ExtraBold-Cyrillic.woff'),
  ])

  const card = new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: hebrew ? 'flex-end' : 'flex-start', padding: '0 84px', fontFamily: hebrew ? 'Heebo' : 'Manrope, ManropeCyrillic', color: '#FFFFFF', background: 'linear-gradient(135deg, #0B1B3D 0%, #002A8A 55%, #0038B8 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <svg viewBox={`0 0 ${EMBLEM_VIEWBOX.width} ${EMBLEM_VIEWBOX.height}`} height={56} width={(56 * EMBLEM_VIEWBOX.width) / EMBLEM_VIEWBOX.height} fill="#FFFFFF">
            {[STAR, ARCH, ARROW].map((part, i) => (
              <g key={i}>
                <path d={part.light} />
                <path d={part.dark} opacity={0.75} />
              </g>
            ))}
          </svg>
          <svg viewBox={`${WORDMARK_VIEWBOX.x} ${WORDMARK_VIEWBOX.y} ${WORDMARK_VIEWBOX.width} ${WORDMARK_VIEWBOX.height}`} height={36} width={(36 * WORDMARK_VIEWBOX.width) / WORDMARK_VIEWBOX.height} fill="#FFFFFF">
            <path d={WORDMARK_PATH} />
          </svg>
        </div>
        <div style={{ display: 'flex', marginTop: 36, padding: '8px 24px', borderRadius: 999, fontSize: 24, fontWeight: 800, color: '#0B1B3D', background: '#FFFFFF' }}>{line(copy.launchDate)}</div>
        <div style={{ display: 'flex', marginTop: 28, fontSize: 60, fontWeight: 800, lineHeight: 1.15 }}>{line(copy.cardLines[0])}</div>
        <div style={{ display: 'flex', fontSize: 60, fontWeight: 800, lineHeight: 1.15, color: '#C7D7FB' }}>{line(copy.cardLines[1])}</div>
      </div>
    ),
    {
      ...shareCardSize,
      fonts: [
        { name: 'Heebo', data: heeboBold, weight: 800, style: 'normal' },
        { name: 'Heebo', data: heeboMedium, weight: 500, style: 'normal' },
        { name: 'Heebo', data: heeboLatin, weight: 800, style: 'normal' },
        { name: 'Manrope', data: manropeLatin, weight: 800, style: 'normal' },
        // Its own family name: two files sharing a name and weight, the renderer reads only the first.
        { name: 'ManropeCyrillic', data: manropeCyrillic, weight: 800, style: 'normal' },
      ],
    },
  )
  const jpeg = await sharp(Buffer.from(await card.arrayBuffer())).jpeg({ quality: 82, mozjpeg: true }).toBuffer()
  return new Response(new Uint8Array(jpeg), { headers: { 'Content-Type': shareCardType } })
}
