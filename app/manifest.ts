import type { MetadataRoute } from 'next'
import { SITE_DESCRIPTION, SITE_TITLE } from '@/lib/config'

// Install metadata for "Add to Home Screen". The icons are the native app
// icon (landly-mobile/assets/icon.png) resized; its white background is
// full-bleed and the logo sits inside the maskable safe zone, so the 512 doubles
// as the maskable icon. White splash matches that background.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_TITLE,
    short_name: 'Landly',
    description: SITE_DESCRIPTION,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    theme_color: '#0038B8',
    background_color: '#FFFFFF',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
