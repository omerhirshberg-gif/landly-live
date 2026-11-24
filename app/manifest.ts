import type { MetadataRoute } from 'next'
import { SITE_DESCRIPTION, SITE_TITLE } from '@/lib/config'

// Install metadata for "Add to Home Screen". The icons are the native app
// icon (landly-mobile/assets/icon.png) resized, plus a dedicated maskable 512
// (scripts/generate-app-icons.mjs): full-bleed background, logo inside the
// maskable safe circle. White splash matches that background.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_TITLE,
    short_name: 'GoLandly',
    description: SITE_DESCRIPTION,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    theme_color: '#0038B8',
    background_color: '#FFFFFF',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
