import { ImageResponse } from 'next/og'
import QRCode from 'qrcode'
import sharp from 'sharp'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ARCH, ARROW, EMBLEM_VIEWBOX, STAR } from '@/lib/brand/emblemPaths'
import { WORDMARK_PATH, WORDMARK_VIEWBOX } from '@/lib/brand/wordmarkPath'
import { SITE_URL } from '@/lib/config'
import { visualHebrewLine as he } from '@/lib/seo/ogText'

// The site-wide share card (og:image, and X's fallback), rendered once at
// build time, so it shows no live merchant or deal that could go stale. The
// beach photo under a brand wash, the Hebrew pitch on the reading side, and
// the member pass on the other (the same demo card as components/home/
// PassShowcase.tsx, its QR real). The logo is drawn from its vector paths, so
// it stays sharp at any size; Heebo is bundled (lib/brand/fonts, SIL OFL), so
// the build never fetches a font. The renderer has no right-to-left layout:
// Hebrew goes through visualHebrewLine, one line per element, right-aligned.
// The render is a PNG of nearly 900 KB, heavy for chat apps' link scrapers, so
// it's re-encoded as a JPEG of under 200 KB.
export const alt = 'GoLandly — המועדון שלכם לחיים בישראל'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/jpeg'

function Emblem({ height }: { height: number }) {
  return (
    <svg viewBox={`0 0 ${EMBLEM_VIEWBOX.width} ${EMBLEM_VIEWBOX.height}`} height={height} width={(height * EMBLEM_VIEWBOX.width) / EMBLEM_VIEWBOX.height} fill="#FFFFFF">
      {[STAR, ARCH, ARROW].map((part, i) => (
        <g key={i}>
          <path d={part.light} />
          <path d={part.dark} opacity={0.75} />
        </g>
      ))}
    </svg>
  )
}

function Wordmark({ height }: { height: number }) {
  return (
    <svg viewBox={`${WORDMARK_VIEWBOX.x} ${WORDMARK_VIEWBOX.y} ${WORDMARK_VIEWBOX.width} ${WORDMARK_VIEWBOX.height}`} height={height} width={(height * WORDMARK_VIEWBOX.width) / WORDMARK_VIEWBOX.height} fill="#FFFFFF">
      <path d={WORDMARK_PATH} />
    </svg>
  )
}

export default async function Image() {
  const [photo, extraBold, medium, latin, qr] = await Promise.all([
    readFile(join(process.cwd(), 'public/hero-poster.jpg')),
    readFile(join(process.cwd(), 'lib/brand/fonts/Heebo-ExtraBold-Hebrew.woff')),
    readFile(join(process.cwd(), 'lib/brand/fonts/Heebo-Medium-Hebrew.woff')),
    readFile(join(process.cwd(), 'lib/brand/fonts/Heebo-ExtraBold-Latin.woff')),
    QRCode.toDataURL(`${SITE_URL}/signup`, { margin: 1, width: 280, color: { dark: '#0B1B3D', light: '#FFFFFF' } }),
  ])

  const card = new ImageResponse(
    (
      <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', fontFamily: 'Heebo', color: '#FFFFFF', background: '#0B1B3D' }}>
        <img src={`data:image/jpeg;base64,${photo.toString('base64')}`} width={1200} height={759} alt="" style={{ position: 'absolute', top: -60, left: 0 }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', background: 'linear-gradient(270deg, rgba(11,27,61,.97) 0%, rgba(0,42,138,.9) 52%, rgba(0,56,184,.28) 100%)' }} />

        <div style={{ position: 'absolute', left: 84, top: 74, width: 322, display: 'flex', flexDirection: 'column', padding: 28, borderRadius: 32, border: '1px solid rgba(255,255,255,.25)', background: 'linear-gradient(135deg, #0038B8 0%, #002A8A 100%)', boxShadow: '0 30px 60px rgba(11,27,61,.55)', transform: 'rotate(-5deg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Emblem height={40} />
            <Wordmark height={26} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16, fontSize: 32, fontWeight: 800 }}>{he('ישראל ישראלי')}</div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
            <div style={{ display: 'flex', padding: 12, borderRadius: 20, background: '#FFFFFF' }}>
              <img src={qr} width={196} height={196} alt="" />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16, fontSize: 22, fontWeight: 500, color: '#C7D7FB' }}>{he('הכרטיס שלכם פעיל')}</div>
        </div>

        <div style={{ position: 'absolute', right: 72, top: 0, bottom: 0, width: 660, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', fontSize: 76, fontWeight: 800, lineHeight: 1.08 }}>{he('המועדון שלכם')}</div>
          <div style={{ display: 'flex', fontSize: 76, fontWeight: 800, lineHeight: 1.08 }}>{he('לחיים בישראל')}</div>
          <div style={{ display: 'flex', marginTop: 22, fontSize: 34, fontWeight: 500, color: '#E0EFFE' }}>{he('הנחות אמיתיות בעסקים אמיתיים')}</div>
          <div style={{ display: 'flex', marginTop: 28, padding: '10px 26px', borderRadius: 999, fontSize: 28, fontWeight: 800, color: '#0B1B3D', background: '#FFFFFF' }}>{he('הצטרפות בחינם')}</div>
          <div style={{ display: 'flex', marginTop: 30, fontSize: 28, fontWeight: 800, color: '#E0EFFE' }}>www.golandly.com</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Heebo', data: extraBold, weight: 800, style: 'normal' },
        { name: 'Heebo', data: medium, weight: 500, style: 'normal' },
        { name: 'Heebo', data: latin, weight: 800, style: 'normal' },
      ],
    },
  )
  const jpeg = await sharp(Buffer.from(await card.arrayBuffer())).jpeg({ quality: 82, mozjpeg: true }).toBuffer()
  return new Response(new Uint8Array(jpeg), { headers: { 'Content-Type': contentType } })
}
