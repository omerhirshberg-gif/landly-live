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
