import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { AVATAR_SIZE, fullSizeAvatarUrl, sizedAvatarUrl } from '@/lib/avatar/avatar'
import { NATIVE_ZOOM_MAX, WEB_ZOOM_MAX, clampZoom, renderScale, touchDistance, zoomProgress } from '@/lib/avatar/zoom'

describe('avatar zoom limits', () => {
  it('grows to 4.5× on the web and 5× in the app, with no screen bound', () => {
    expect(WEB_ZOOM_MAX).toBe(4.5)
    expect(NATIVE_ZOOM_MAX).toBe(5)
    expect(clampZoom(9, WEB_ZOOM_MAX)).toBe(4.5)
    expect(clampZoom(9, NATIVE_ZOOM_MAX)).toBe(5)
    expect(clampZoom(3.2, WEB_ZOOM_MAX)).toBe(3.2)
  })

  it('never shrinks below the resting circle', () => {
    expect(clampZoom(0.4, WEB_ZOOM_MAX)).toBe(1)
  })

  it('scales by the ratio of finger distances', () => {
    const start = touchDistance({ x: 0, y: 0 }, { x: 30, y: 40 })
    const now = touchDistance({ x: 0, y: 0 }, { x: 90, y: 120 })
    expect(start).toBe(50)
    expect(clampZoom(now / start, WEB_ZOOM_MAX)).toBe(3)
  })

  it('dims the backdrop from 0 at rest to 1 fully grown', () => {
    expect(zoomProgress(1, 5)).toBe(0)
    expect(zoomProgress(3, 5)).toBe(0.5)
    expect(zoomProgress(6, 5)).toBe(1)
  })
})

describe('avatar sharpness', () => {
  it('lays the circle out big enough to draw every pixel of the 1024px photo', () => {
    // A 300pt circle on a 3× phone is 900px: laid out at ~1.14× it draws 1024px.
    expect(300 * renderScale(300, 3, NATIVE_ZOOM_MAX) * 3).toBeCloseTo(AVATAR_SIZE)
    // A 360px circle on a 2× desktop screen.
    expect(360 * renderScale(360, 2, WEB_ZOOM_MAX) * 2).toBeCloseTo(AVATAR_SIZE)
  })

  it('never lays it out smaller than it rests, or past the zoom limit', () => {
    expect(renderScale(800, 3, WEB_ZOOM_MAX)).toBe(1)
    expect(renderScale(10, 1, WEB_ZOOM_MAX)).toBe(WEB_ZOOM_MAX)
    expect(renderScale(0, 3, WEB_ZOOM_MAX)).toBe(1)
  })

  it('asks Google for the photo at the size it is drawn, up to 1024px', () => {
    const google = 'https://lh3.googleusercontent.com/a/ACg8ocK=s96-c'
    expect(sizedAvatarUrl(google, 216)).toBe('https://lh3.googleusercontent.com/a/ACg8ocK=s216-c')
    expect(sizedAvatarUrl(google, 4000)).toBe('https://lh3.googleusercontent.com/a/ACg8ocK=s1024-c')
    expect(fullSizeAvatarUrl(google)).toBe('https://lh3.googleusercontent.com/a/ACg8ocK=s1024-c')
    const storage = 'https://firebasestorage.googleapis.com/v0/b/x/o/avatars%2Fu1?alt=media&v=1'
    expect(sizedAvatarUrl(storage, 144)).toBe(storage)
  })

  it('uses the sized photo in the small avatars on both platforms', () => {
    expect(readFileSync('components/ui/Avatar.tsx', 'utf8')).toContain('src={sizedAvatarUrl(src, size * 3)}')
    expect(readFileSync('landly-mobile/src/components/Avatar.tsx', 'utf8')).toContain('sizedAvatarUrl(uri, size * PixelRatio.get())')
  })
})

describe('web avatar preview', () => {
  const source = readFileSync('components/ui/AvatarLightbox.tsx', 'utf8')
  const css = readFileSync('app/globals.css', 'utf8')

  it('pinches with native touch events on the document, cancelling page zoom', () => {
    for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) expect(source).toContain(`document.addEventListener('${type}'`)
    expect(source).toContain('pinch.from.scale * (spread(e.touches) / pinch.distance)')
    expect(source).toContain("document.addEventListener('wheel', onWheel, active)")
    expect(css).toMatch(/\.avatar-lightbox,\.avatar-peek\{[^}]*overflow:visible;[^}]*touch-action:none;/)
  })

  it('has a frosted backdrop and no visible close button over the photo', () => {
    expect(css).toMatch(/\.avatar-lightbox,\.avatar-peek\{[^}]*background:rgba\(0,0,0,\.45\);-webkit-backdrop-filter:blur\(12px\);backdrop-filter:blur\(12px\);/)
    expect(css).toMatch(/\.avatar-lightbox-close\{[^}]*clip-path:inset\(50%\);opacity:0;\}/)
    expect(css).toContain('.avatar-lightbox-close:focus-visible{clip-path:none;opacity:1;')
    expect(source).not.toContain('fa-xmark')
  })

  it('eases the whole round circle back on release, without a bounce', () => {
    expect(css).toMatch(/\.avatar-lightbox-frame\{[^}]*border-radius:9999px;overflow:hidden;[^}]*will-change:transform;/)
    expect(css).toContain('.avatar-lightbox-frame.is-settle,.avatar-lightbox-dim.is-settle{transition:transform 320ms cubic-bezier(.16,1,.3,1),opacity 200ms ease;}')
    // No overshooting curve (a y control point above 1), and opening is a plain fade, not a scale-up.
    const avatarCss = css.slice(css.indexOf('/* ── Avatar preview'), css.indexOf('@keyframes avatar-lightbox-pop') + 200)
    expect(avatarCss).not.toMatch(/cubic-bezier\([^)]*,\s*1\.\d*[1-9]\d*\s*\)/)
    expect(css).toContain('@keyframes avatar-lightbox-pop{from{opacity:0}to{opacity:1}}')
    expect(source).toContain('transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale / render})`')
  })

  it('peeks on a long press or click-and-hold from the profile avatar, without also clicking it', () => {
    expect(source).toContain('const PEEK_DELAY_MS = 180')
    expect(source).toContain('createPortal(<PeekLayer')
    const uploader = readFileSync('components/profile/AvatarUploader.tsx', 'utf8')
    expect(uploader).toContain('const peek = useAvatarPeek(photoSrc)')
    expect(uploader).toContain('{...peek.trigger}')
    expect(uploader).toContain('{peek.layer}')
  })
})

describe('app avatar preview', () => {
  const source = readFileSync('landly-mobile/src/components/AvatarViewer.tsx', 'utf8')

  it('peeks on a 180ms long press with pinch and pan together', () => {
    expect(source).toContain('const PEEK_DELAY_MS = 180')
    expect(source).toContain('Gesture.LongPress().enabled(enabled).minDuration(PEEK_DELAY_MS)')
    expect(source).toContain('Gesture.Simultaneous(touches, hold, pinch, pan)')
  })

  it('eases back without a bounce and fades the blur out', () => {
    expect(source).toContain('const SETTLE = { duration: 320, easing: Easing.bezier(0.16, 1, 0.3, 1) }')
    expect(source).toContain('scale.value = withTiming(1, SETTLE)')
    expect(source).not.toContain('withSpring')
    expect(source).toContain('fade.value = withDelay(')
    expect(source).toContain("import { BlurView } from 'expo-blur'")
  })

  it('scales the clipped circle freely, up to 5×, with nothing over the view', () => {
    expect(source).toContain('Math.min(NATIVE_ZOOM_MAX, Math.max(1, pinchFrom.value * e.scale))')
    expect(source).toMatch(/stage: \{[^}]*overflow: 'visible' \}/)
    expect(source).toMatch(/frame: \{\s*overflow: 'hidden',/)
    expect(source).not.toContain('name="close"')
    expect(source).toContain('onRequestClose={onClose}')
  })

  it('draws the peek above every screen from the root layout', () => {
    const layout = readFileSync('landly-mobile/src/app/_layout.tsx', 'utf8')
    expect(layout).toContain('<GestureHandlerRootView style={styles.root}>')
    expect(layout).toContain('<AvatarPeekProvider>')
    for (const screen of ['landly-mobile/src/components/AvatarPicker.tsx', 'landly-mobile/src/app/(tabs)/index.tsx']) {
      expect(readFileSync(screen, 'utf8')).toContain('<GestureDetector gesture={peek.gesture}>')
    }
  })
})
