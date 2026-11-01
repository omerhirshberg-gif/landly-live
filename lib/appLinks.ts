// The app's store links, in one place, for the landing's badges, the /download
// redirect (for printed QR codes and campaigns) and the Smart App Banner. Neither listing exists
// yet: set NEXT_PUBLIC_APP_STORE_ID to the app's numeric App Store id, and
// NEXT_PUBLIC_GOOGLE_PLAY_LIVE to 1 once the Play listing is public. Until
// then a badge opens signup, so no visitor lands on a store's 404 page. The
// same variables go in the dev and production deployments.

export const ANDROID_PACKAGE = 'com.amitbd.landlyapp'
export const DOWNLOAD_PATH = '/download'
/** Where a badge goes while its store has no listing. */
export const STORE_FALLBACK_PATH = '/signup'

export const APP_STORE_ID = /^\d+$/.test(process.env.NEXT_PUBLIC_APP_STORE_ID ?? '') ? process.env.NEXT_PUBLIC_APP_STORE_ID! : null
const googlePlayLive = process.env.NEXT_PUBLIC_GOOGLE_PLAY_LIVE === '1'

export const APP_STORE_HREF = APP_STORE_ID ? `https://apps.apple.com/app/id${APP_STORE_ID}` : STORE_FALLBACK_PATH
export const GOOGLE_PLAY_HREF = googlePlayLive ? `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}` : STORE_FALLBACK_PATH

/** Where /download sends a phone: its own store. A desktop browser goes to Home's badges. */
export function downloadTarget(userAgent: string): string {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return APP_STORE_HREF
  if (/Android/i.test(userAgent)) return GOOGLE_PLAY_HREF
  return '/'
}
