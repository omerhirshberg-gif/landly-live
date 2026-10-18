import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

// The site-wide share card (og:image, and X's fallback), rendered once at
// build time. Uses the built-in font so the build never fetches one. The logo
// PNGs are navy/blue artwork, so they sit on a white pill over the gradient.
export const alt = 'Landly — Live Israel Like a Local'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const asDataUrl = async (file: string) =>
  `data:image/png;base64,${(await readFile(join(process.cwd(), 'public', file))).toString('base64')}`

export default async function Image() {
  const [mark, wordmark] = await Promise.all([asDataUrl('logo-mark.png'), asDataUrl('logo-wordmark.png')])

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: 'linear-gradient(135deg, #0B1B3D 0%, #0B2A6E 45%, #0038B8 100%)',
          color: '#FFFFFF',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            alignSelf: 'flex-start',
            gap: 16,
            padding: '16px 28px 16px 20px',
            borderRadius: 24,
            background: '#FFFFFF',
          }}
        >
          <img src={mark} width={73} height={70} alt="" />
          <img src={wordmark} width={211} height={60} alt="" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1.5 }}>Live Israel Like a Local</div>
          <div style={{ marginTop: 24, fontSize: 34, lineHeight: 1.3, color: '#C7D7FB', maxWidth: 900 }}>
            Real discounts at real places, all across Israel.
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 26, fontWeight: 600, color: '#E0EFFE' }}>golandly.com</div>
      </div>
    ),
    { ...size },
  )
}
