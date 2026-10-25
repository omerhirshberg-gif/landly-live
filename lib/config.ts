export const SUPPORT_EMAIL = 'contact@golandly.com'
// The WhatsApp Cloud API line the support bot answers
// (app/api/webhooks/whatsapp/route.ts): the web widget, /support, the
// business dashboard's support page, the privacy policy's contact details and
// the app's Help screen all open it. There is no separate voice line: support
// is on WhatsApp or by email.
export const SUPPORT_WHATSAPP_NUMBER = '972552889033'
export const SUPPORT_WHATSAPP_DISPLAY = '+972 55-288-9033'
export const SUPPORT_WHATSAPP_LINK = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}`

// Shown in the drawer's About & Legal row; matches landly-mobile/app.json.
export const APP_VERSION = '1.0.0'

// Canonical public origin for SEO (sitemap, robots, metadataBase). The apex
// golandly.com redirects here, so crawlers and share cards use www.
export const SITE_URL = 'https://www.golandly.com'
export const SITE_TITLE = 'Landly — Live Israel Like a Local'
export const SITE_DESCRIPTION =
  'Real discounts at real places, all across Israel. Member perks, rights and community for olim and locals, in one place.'
