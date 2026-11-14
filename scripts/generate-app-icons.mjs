// Renders the app icons from the vector emblem (lib/brand/emblemPaths.ts), so
// they stay crisp at any size instead of being scaled up from a raster.
//
//   node scripts/generate-app-icons.mjs
//     writes landly-mobile/assets/icon.png (iOS and the default icon),
//     landly-mobile/assets/adaptive-icon.png (Android's adaptive foreground),
//     landly-mobile/assets/play-store-icon.png (the Google Play listing icon,
//     uploaded by hand in the Play Console) and, when the local native project
//     exists, its iOS 1024 app icon
//
//   node scripts/generate-app-icons.mjs --check
//     measures those files against the rules below; exits 1 if any fails
//
// Every icon centres the whole emblem (the Star of David and the arrow), so it
// reads as centred in any launcher mask rather than shifted left by the arrow:
// iOS and Google Play centre its bounding box, Android an optical centre
// between its bounding box and its smallest enclosing circle (OPTICAL_LEAN).
// iOS: the glyph's box fills ICON_FILL of the canvas width, centred
// on an opaque background (iOS rejects transparency); the arrow
// tip keeps CORNER_CLEARANCE inside the home screen's rounded-square mask.
// Android: every launcher mask contains the central 72 of the 108 units
// (Pixel's circle is exactly it), so every glyph pixel stays inside that
// circle; the glyph is as large as fits there, on its optical centre, on a
// transparent foreground over app.json's adaptiveIcon.backgroundColor.
// Google Play: 512x512, 32-bit sRGB PNG, every pixel opaque on white; the
// glyph keeps PLAY_MARGIN of the canvas clear on every side, so Play's rounded mask never touches it.
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { ARCH, ARROW, EMBLEM_VIEWBOX, STAR } from '../lib/brand/emblemPaths.ts'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const SIZE = 1024
const HALF = SIZE / 2
export const ICON_FILL = 0.72
/**
 * The star and arch carry most of the emblem's weight on its left; the arrow
 * only reaches out to the right. Centring the bounding box therefore reads as
 * shifted left, so iOS and Google Play nudge the whole glyph right by this
 * many pixels per 1024 of canvas (box centre lands near X = 536).
 */
export const OPTICAL_SHIFT = 24
export const ICON_BACKGROUND = '#fcfcfc'
/** Radius of Android's 66-of-108 safe circle on the 1024 canvas. */
export const SAFE_RADIUS = Math.floor((SIZE * 66) / 108 / 2)
/**
 * Radius of the visible window every launcher mask contains: the 72-of-108
 * circle (Pixel's circle is exactly it; squircles and rounded squares are
 * larger). Glyph pixels inside it are never clipped by any launcher shape.
 */
export const MASK_RADIUS = Math.floor((SIZE * 72) / 108 / 2)
/**
 * How far Android's centre leans from the glyph's bounding-box centre toward
 * its smallest enclosing circle's centre: 0 is the pure box (the arrow tip and
 * star balanced edge to edge), 1 the pure circle (the most that fits).
 */
export const OPTICAL_LEAN = 0.15
/**
 * The iOS mask, approximated by the superellipse |x|^5 + |y|^5 = 1 over the
 * canvas (Apple's continuous-corner square), and the least distance, in
 * pixels along the line from the centre, the glyph keeps inside it.
 */
const MASK_EXPONENT = 5
export const CORNER_CLEARANCE = 48
export const PLAY_SIZE = 512
export const PLAY_MARGIN = 0.15
export const PLAY_BACKGROUND = '#ffffff'
export const FILES = {
  icon: path.join(ROOT, 'landly-mobile/assets/icon.png'),
  adaptive: path.join(ROOT, 'landly-mobile/assets/adaptive-icon.png'),
  ios: path.join(ROOT, 'landly-mobile/ios/Landly/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png'),
  playStore: path.join(ROOT, 'landly-mobile/assets/play-store-icon.png'),
}
/** Web/PWA/Next metadata icons, resized from icon.png (the favicons keep a transparent background). */
export const WEB_FILES = [
  { file: path.join(ROOT, 'public/icons/icon-192.png'), size: 192 },
  { file: path.join(ROOT, 'public/icons/icon-512.png'), size: 512 },
  { file: path.join(ROOT, 'app/apple-icon.png'), size: 180 },
  { file: path.join(ROOT, 'app/icon1.png'), size: 32, transparent: true },
  { file: path.join(ROOT, 'app/icon0.png'), size: 16, transparent: true },
]

const partPaths = (part) =>
  `<path d="${part.light}" fill="#035bc4" fill-rule="evenodd"/><path d="${part.dark}" fill="#013ba9" fill-rule="evenodd"/>`
const GLYPH = [STAR, ARCH, ARROW].map(partPaths).join('')

/** The paths at `scale` px per viewBox unit, with `center` (viewBox units) at the centre of a `size` canvas. */
function svg({ scale, center, size = SIZE }, background, paths = GLYPH) {
  const tx = size / 2 - center.x * scale
  const ty = size / 2 - center.y * scale
  const fill = background ? `<rect width="${size}" height="${size}" fill="${background}"/>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${fill}<g transform="translate(${tx} ${ty}) scale(${scale})">${paths}</g></svg>`
}

const render = (markup) => sharp(Buffer.from(markup)).png().toBuffer()

// The glyph's pixels are any that differ from the corner pixel (the background).
const isGlyph = (data, i, bg) =>
  Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) + Math.abs(data[i + 3] - bg[3]) > 40

/** How far out a point sits in a rounded-square mask over a `size` canvas: 1 on its edge. */
const maskReach = (x, y, half) => (Math.abs((x - half) / half) ** MASK_EXPONENT + Math.abs((y - half) / half) ** MASK_EXPONENT) ** (1 / MASK_EXPONENT)

export async function measure(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height } = info
  const half = width / 2
  const bg = data.subarray(0, 4)
  let minX = width, minY = height, maxX = -1, maxY = -1, maxRadius = 0, maxReach = 0, opaque = true
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (data[i + 3] !== 255) opaque = false
      if (!isGlyph(data, i, bg)) continue
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y)
      // The pixel's far corner, so the whole pixel counts.
      const fx = x < half ? x : x + 1
      const fy = y < half ? y : y + 1
      maxRadius = Math.max(maxRadius, Math.hypot(fx - half, fy - half))
      maxReach = Math.max(maxReach, maskReach(fx, fy, half))
    }
  }
  return {
    width, height, opaque,
    background: [...bg],
    box: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
    margins: { left: minX, right: width - 1 - maxX, top: minY, bottom: height - 1 - maxY },
    fill: (maxX - minX + 1) / width,
    maxRadius,
    /** Least room left inside a rounded-square mask, in px along the line from the centre. */
    cornerClearance: (1 - maxReach) * half,
  }
}

/**
 * The paths' outline in viewBox units: each pixel row's outermost pixels
 * (corners included), from a render of the whole viewBox that nearly fills
 * the canvas. The convex hull, and so the farthest point from any centre,
 * is always among them.
 */
async function outline(paths = GLYPH) {
  const scale = (SIZE - 16) / Math.max(EMBLEM_VIEWBOX.width, EMBLEM_VIEWBOX.height)
  const center = { x: EMBLEM_VIEWBOX.width / 2, y: EMBLEM_VIEWBOX.height / 2 }
  const { data, info } = await sharp(await render(svg({ scale, center }, null, paths))).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const bg = data.subarray(0, 4)
  const toUnits = (x, y) => ({ x: (x - HALF) / scale + center.x, y: (y - HALF) / scale + center.y })
  const points = []
  for (let y = 0; y < info.height; y++) {
    let first = -1, last = -1
    for (let x = 0; x < info.width; x++) {
      if (!isGlyph(data, (y * info.width + x) * 4, bg)) continue
      if (first < 0) first = x
      last = x
    }
    if (first < 0) continue
    for (const x of [first, last + 1]) points.push(toUnits(x, y), toUnits(x, y + 1))
  }
  return points
}

const boxOf = (points) => {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) }
}

/** Where each icon puts the glyph: px per viewBox unit, and the viewBox point on the canvas centre. */
export async function layouts() {
  const points = await outline()
  const box = boxOf(points)

  const boxCenter = { x: box.x + box.width / 2, y: box.y + box.height / 2 }

  // iOS: the box centred on the canvas.
  const iosScale = (SIZE * ICON_FILL) / box.width
  const ios = { scale: iosScale, center: { x: boxCenter.x - OPTICAL_SHIFT / iosScale, y: boxCenter.y } }

  // Android: the optical centre on the canvas centre, then the scale that puts
  // the farthest glyph point on the launcher-mask circle, three pixels inside
  // for anti-aliasing. The enclosing circle's centre: the farthest distance is convex in the centre,
  // so a nested ternary search finds it.
  const reach = (cx, cy) => Math.max(...points.map((p) => Math.hypot(p.x - cx, p.y - cy)))
  const ternary = (lo, hi, f) => {
    for (let i = 0; i < 40; i++) {
      const a = lo + (hi - lo) / 3
      const b = hi - (hi - lo) / 3
      if (f(a) < f(b)) hi = b
      else lo = a
    }
    return (lo + hi) / 2
  }
  const bestY = (cx) => ternary(box.y, box.y + box.height, (cy) => reach(cx, cy))
  const cx = ternary(box.x, box.x + box.width, (x) => reach(x, bestY(x)))
  const cy = bestY(cx)
  // Optical centre: the box centre leaning OPTICAL_LEAN toward the circle's.
  const ox = boxCenter.x + (cx - boxCenter.x) * OPTICAL_LEAN
  const oy = boxCenter.y + (cy - boxCenter.y) * OPTICAL_LEAN
  const android = { scale: (MASK_RADIUS - 3) / reach(ox, oy), center: { x: ox, y: oy } }

  // Google Play: the box centred, as large as keeps PLAY_MARGIN clear on
  // every side. (A pixel more, so the anti-aliased edge stays outside it too.)
  const room = PLAY_SIZE / 2 - Math.ceil(PLAY_SIZE * PLAY_MARGIN) - 1 - OPTICAL_SHIFT / 2
  const playScale = room / Math.max(box.width, box.height) * 2
  const playStore = { size: PLAY_SIZE, scale: playScale, center: { x: boxCenter.x - (OPTICAL_SHIFT / 2) / playScale, y: boxCenter.y } }

  return { ios, android, playStore }
}

/** Play wants 32-bit sRGB with no transparency: RGBA, every alpha 255, an sRGB profile. */
const playStorePng = async (layout) =>
  sharp(await render(svg(layout, PLAY_BACKGROUND))).flatten({ background: PLAY_BACKGROUND }).ensureAlpha(1).withIccProfile('srgb').png()

async function generate() {
  const { ios, android, playStore } = await layouts()
  await sharp(await render(svg(ios, ICON_BACKGROUND))).removeAlpha().png().toFile(FILES.icon)
  await sharp(await render(svg(android, null))).png().toFile(FILES.adaptive)
  await (await playStorePng(playStore)).toFile(FILES.playStore)
  if (existsSync(path.dirname(FILES.ios))) await sharp(FILES.icon).toFile(FILES.ios)
  for (const { file, size, transparent } of WEB_FILES) {
    const src = transparent ? await render(svg(ios, null)) : FILES.icon
    const img = sharp(src).resize(size, size)
    await (transparent ? img : img.removeAlpha()).png().toFile(file)
  }
}

/** The whole glyph's box centre, as laid out in an icon, in canvas pixels. */
const boxCenter = ({ box }) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 })

/** Each file's failures against the rules; empty when all pass. */
export async function check() {
  const failures = []
  const { ios, android, playStore } = await layouts()

  const icon = await measure(FILES.icon)
  if (icon.width !== SIZE || icon.height !== SIZE) failures.push(`icon.png is ${icon.width}x${icon.height}`)
  if (!icon.opaque) failures.push('icon.png has transparency')
  if (icon.fill < 0.70 || icon.fill > 0.74) failures.push(`icon.png glyph fills ${(icon.fill * 100).toFixed(1)}%`)
  if (Math.abs(icon.margins.top - icon.margins.bottom) > 2) failures.push(`icon.png margins ${icon.margins.top}/${icon.margins.bottom}`)
  if (Math.abs(icon.margins.left - icon.margins.right - 2 * OPTICAL_SHIFT) > 3) failures.push(`icon.png margins ${icon.margins.left}/${icon.margins.right}`)
  if (icon.cornerClearance < CORNER_CLEARANCE) failures.push(`icon.png keeps only ${icon.cornerClearance.toFixed(0)}px inside the mask`)

  const adaptive = await measure(FILES.adaptive)
  if (adaptive.width !== SIZE || adaptive.height !== SIZE) failures.push(`adaptive-icon.png is ${adaptive.width}x${adaptive.height}`)
  if (adaptive.background[3] !== 0) failures.push('adaptive-icon.png background is not transparent')
  if (adaptive.maxRadius > MASK_RADIUS) failures.push(`adaptive-icon.png reaches ${adaptive.maxRadius.toFixed(0)}px from centre (mask circle: ${MASK_RADIUS})`)
  // As large as fits: the glyph reaches the mask circle.
  if (adaptive.maxRadius < MASK_RADIUS - 6) failures.push(`adaptive-icon.png stops ${(MASK_RADIUS - adaptive.maxRadius).toFixed(0)}px short of the mask circle`)

  const play = await measure(FILES.playStore)
  const playMeta = await sharp(FILES.playStore).metadata()
  const playMargin = Math.min(...Object.values(play.margins)) / PLAY_SIZE
  if (play.width !== PLAY_SIZE || play.height !== PLAY_SIZE) failures.push(`play-store-icon.png is ${play.width}x${play.height}`)
  if (playMeta.format !== 'png' || playMeta.channels !== 4 || playMeta.depth !== 'uchar') failures.push('play-store-icon.png is not a 32-bit PNG')
  if (playMeta.space !== 'srgb' || !playMeta.icc) failures.push('play-store-icon.png has no sRGB profile')
  if (!play.opaque) failures.push('play-store-icon.png has transparency')
  if (play.background.join() !== '255,255,255,255') failures.push(`play-store-icon.png background is ${play.background}`)
  if (playMargin < PLAY_MARGIN) failures.push(`play-store-icon.png keeps only ${(playMargin * 100).toFixed(1)}% clear`)
  if (Math.abs(play.margins.top - play.margins.bottom) > 2) failures.push(`play-store-icon.png margins ${play.margins.top}/${play.margins.bottom}`)
  if (Math.abs(play.margins.left - play.margins.right - OPTICAL_SHIFT) > 3) failures.push(`play-store-icon.png margins ${play.margins.left}/${play.margins.right}`)

  for (const [file, layout, background] of [[FILES.icon, ios, ICON_BACKGROUND], [FILES.adaptive, android, null]]) {
    let expected = sharp(await render(svg(layout, background)))
    if (background) expected = expected.removeAlpha()
    const [a, b] = await Promise.all([sharp(file).ensureAlpha().raw().toBuffer(), expected.ensureAlpha().raw().toBuffer()])
    if (!a.equals(b)) failures.push(`${path.basename(file)} is stale: run node scripts/generate-app-icons.mjs`)
  }
  const [playFile, playExpected] = await Promise.all([
    sharp(FILES.playStore).raw().toBuffer(),
    playStorePng(playStore).then((png) => png.toBuffer()).then((buf) => sharp(buf).raw().toBuffer()),
  ])
  if (!playFile.equals(playExpected)) failures.push('play-store-icon.png is stale: run node scripts/generate-app-icons.mjs')

  if (existsSync(FILES.ios)) {
    const [a, b] = await Promise.all([sharp(FILES.icon).raw().toBuffer(), sharp(FILES.ios).raw().toBuffer()])
    if (!a.equals(b)) failures.push('the iOS app icon differs from icon.png')
  }
  for (const { file, size } of WEB_FILES) {
    const meta = await sharp(file).metadata()
    if (meta.width !== size || meta.height !== size) failures.push(`${path.basename(file)} is ${meta.width}x${meta.height}, expected ${size}`)
  }
  return { failures, icon, adaptive, play: { ...play, minMargin: playMargin, meta: playMeta } }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!process.argv.includes('--check')) await generate()
  const { failures, icon, adaptive, play } = await check()
  console.log(`icon.png          ${(icon.fill * 100).toFixed(1)}% wide, margins ${icon.margins.left}/${icon.margins.right} x ${icon.margins.top}/${icon.margins.bottom}, ${icon.cornerClearance.toFixed(0)}px inside the mask, opaque: ${icon.opaque}`)
  console.log(`adaptive-icon.png ${(adaptive.fill * 100).toFixed(1)}% wide, box centre ${boxCenter(adaptive).x},${boxCenter(adaptive).y}, furthest pixel ${adaptive.maxRadius.toFixed(0)}px from centre (mask circle ${MASK_RADIUS}px)`)
  console.log(`play-store-icon   ${play.width}x${play.height} ${play.meta.channels * 8}-bit ${play.meta.space}${play.meta.icc ? ' (ICC)' : ''}, margins ${play.margins.left}/${play.margins.right} x ${play.margins.top}/${play.margins.bottom} (min ${(play.minMargin * 100).toFixed(1)}%), opaque: ${play.opaque}`)
  for (const failure of failures) console.error(`FAIL ${failure}`)
  process.exit(failures.length ? 1 : 0)
}
