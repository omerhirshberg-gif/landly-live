import { useEffect } from 'react'

// The part of the page the soft keyboard leaves visible, as CSS variables on
// <html>: --vv-height (px) and --vv-top (px from the top of the layout
// viewport). iOS Safari doesn't shrink the layout viewport (or dvh) for the
// keyboard; it shrinks and pans the visual viewport instead, so a fixed
// panel sized by these stays fully above the keyboard. Android Chrome
// reports the same numbers, and resizes dvh too (interactive-widget in
// app/admin/layout.tsx). Without the API (very old webviews) nothing is set,
// so CSS falls back: var(--vv-height, var(--app-dvh)), var(--vv-top, 0px).

interface VisualViewportLike {
  height: number
  offsetTop: number
  addEventListener(type: 'resize' | 'scroll', listener: () => void): void
  removeEventListener(type: 'resize' | 'scroll', listener: () => void): void
}

interface StyleTarget {
  setProperty(name: string, value: string): void
  removeProperty(name: string): void
}

/** Keeps the variables in step with `viewport` until the returned cleanup runs, which also removes them. */
export function trackVisualViewport(viewport: VisualViewportLike | null | undefined, style: StyleTarget): () => void {
  if (!viewport) return () => {}
  const update = () => {
    style.setProperty('--vv-height', `${Math.round(viewport.height)}px`)
    style.setProperty('--vv-top', `${Math.max(0, Math.round(viewport.offsetTop))}px`)
  }
  update()
  viewport.addEventListener('resize', update)
  viewport.addEventListener('scroll', update)
  return () => {
    viewport.removeEventListener('resize', update)
    viewport.removeEventListener('scroll', update)
    style.removeProperty('--vv-height')
    style.removeProperty('--vv-top')
  }
}

/** Sets --vv-height and --vv-top while the calling component is mounted. */
export function useVisualViewport(): void {
  useEffect(() => trackVisualViewport(window.visualViewport, document.documentElement.style), [])
}
