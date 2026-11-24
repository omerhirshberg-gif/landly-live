// Regenerates lib/wallet/assets/ (the Apple Wallet pass's icon and logo) from
// public/icons/icon-512.png: node scripts/generate-wallet-assets.mjs
//   icon -- 29pt, the mark on white, shown on lock-screen notices
//   logo -- up to 160x50pt, the mark in white, on the pass's dark navy front
import sharp from 'sharp'

const SOURCE = 'public/icons/icon-512.png'
const OUT = 'lib/wallet/assets'
const SCALES = [['', 1], ['@2x', 2], ['@3x', 3]]
const ICON = 29
const LOGO = 50

for (const [suffix, scale] of SCALES) {
  await sharp(SOURCE).resize(ICON * scale, ICON * scale).flatten({ background: '#ffffff' }).png().toFile(`${OUT}/icon${suffix}.png`)
}

// The mark's shape from how far each pixel is from the white background.
const { data, info } = await sharp(SOURCE).flatten({ background: '#ffffff' }).grayscale().raw().toBuffer({ resolveWithObject: true })
const alpha = Buffer.from(data.map((value) => Math.min(255, Math.max(0, (245 - value) * 2.2))))
const white = sharp({ create: { width: info.width, height: info.height, channels: 3, background: '#ffffff' } })
  .joinChannel(alpha, { raw: { width: info.width, height: info.height, channels: 1 } })
const trimmed = await white.png().toBuffer().then((png) => sharp(png).trim({ background: { r: 255, g: 255, b: 255, alpha: 0 } }).toBuffer())

for (const [suffix, scale] of SCALES) {
  await sharp(trimmed).resize({ height: LOGO * scale, fit: 'inside' }).png().toFile(`${OUT}/logo${suffix}.png`)
}

// ---------------------------------------------------------------------------
// Google Wallet (lib/wallet/googlePass.ts): the pass's logo and hero, and the "Add to Google Wallet" badges as PNGs.
//   public/wallet/google/logo.png  660x660, the brand-coloured mark centred on white (Wallet crops the logo to a white circle on the navy card)
//   public/wallet/google/hero.png  1032x336, the navy brand banner (#0B1B3D) with the mark, no text
//   <lang>.png                     Google's official badge artwork, unmodified, rasterised from the SVGs at 3x: the website's <img>
//   landly-mobile/assets/wallet/google-<lang>(@2x|@3x).png  the same for the app (Android draws a bitmap crisply where the
//                                  Fabric SVG renderer drew the badge's fill and hairline outline twice)
// ---------------------------------------------------------------------------
import { readFileSync, writeFileSync } from 'node:fs'

const NAVY = { r: 0x0b, g: 0x1b, b: 0x3d }
const WALLET_DIR = 'public/wallet/google'
const markPng = await sharp(trimmed).png().toBuffer()

// Wallet draws the logo in a white circle, so the mark is the brand's own colours on white (a white mark would vanish).
const iconTrimmed = await sharp(SOURCE).flatten({ background: '#ffffff' }).trim({ background: '#ffffff', threshold: 12 }).png().toBuffer()
// The source's "white" is a hair off pure white: lift it so no faint square shows around the mark inside the circle.
const logoMark = await sharp(iconTrimmed).resize({ width: 380, height: 380, fit: 'inside' }).linear(1.05, 0).png().toBuffer()
await sharp({ create: { width: 660, height: 660, channels: 3, background: '#ffffff' } })
  .composite([{ input: logoMark, gravity: 'centre' }])
  .png({ compressionLevel: 9 })
  .toFile(`${WALLET_DIR}/logo.png`)

const HERO_W = 1032
const HERO_H = 336
const glow = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${HERO_W}" height="${HERO_H}">
  <defs>
    <linearGradient id="base" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0B1B3D"/><stop offset="1" stop-color="#102A5C"/></linearGradient>
    <radialGradient id="glowA" cx="0.82" cy="0.1" r="0.7"><stop offset="0" stop-color="#2F5FD0" stop-opacity="0.55"/><stop offset="1" stop-color="#2F5FD0" stop-opacity="0"/></radialGradient>
    <radialGradient id="glowB" cx="0.1" cy="1" r="0.6"><stop offset="0" stop-color="#4C7DF0" stop-opacity="0.28"/><stop offset="1" stop-color="#4C7DF0" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#base)"/>
  <rect width="100%" height="100%" fill="url(#glowA)"/>
  <rect width="100%" height="100%" fill="url(#glowB)"/>
  <g fill="none" stroke="#FFFFFF" stroke-opacity="0.10" stroke-width="1.5">
    <circle cx="516" cy="168" r="210"/><circle cx="516" cy="168" r="290"/><circle cx="516" cy="168" r="370"/>
  </g>
</svg>`)
const heroMark = await sharp(markPng).resize({ height: 150, fit: 'inside' }).png().toBuffer()
await sharp(glow).composite([{ input: heroMark, gravity: 'centre' }]).png({ compressionLevel: 9 }).toFile(`${WALLET_DIR}/hero.png`)

// The badges: rasterised from the unmodified SVGs (their own width per language), 3x for the site, 1x/2x/3x for the app.
const LANGS = ['en', 'he', 'ru', 'fr', 'es']
const sizes = {}
for (const lang of LANGS) {
  const svg = readFileSync(`${WALLET_DIR}/${lang}.svg`)
  const meta = await sharp(svg).metadata()
  const w = Math.round(meta.width)
  const h = Math.round(meta.height)
  sizes[lang] = { width: w, height: h }
  const render = (scale) => sharp(svg, { density: 72 * scale }).resize(w * scale, h * scale).png({ compressionLevel: 9 })
  await render(3).toFile(`${WALLET_DIR}/${lang}.png`)
  await render(1).toFile(`landly-mobile/assets/wallet/google-${lang}.png`)
  await render(2).toFile(`landly-mobile/assets/wallet/google-${lang}@2x.png`)
  await render(3).toFile(`landly-mobile/assets/wallet/google-${lang}@3x.png`)
}
const entries = LANGS.map((lang) => `  ${lang}: { source: require('../../assets/wallet/google-${lang}.png'), width: ${sizes[lang].width}, height: ${sizes[lang].height} },`).join('\n')
writeFileSync('landly-mobile/src/lib/googleWalletBadges.ts', `// Generated by scripts/generate-wallet-assets.mjs from Google's official "Add to Google Wallet" badges (assets/wallet/google-<lang>.svg), unmodified.
// Bitmaps (1x/2x/3x), not SVG: Android's Fabric SVG renderer drew the badge's fill and its hairline outline twice, which doubled the label.
// Regenerate when Google updates the artwork (see public/wallet/google/README.txt). Each language's badge has its own width.
import type { ImageSourcePropType } from 'react-native'

export const GOOGLE_WALLET_BADGES: Record<'en' | 'he' | 'ru' | 'fr' | 'es', { source: ImageSourcePropType; width: number; height: number }> = {
${entries}
}
`)
console.log('Google Wallet assets written', sizes)
