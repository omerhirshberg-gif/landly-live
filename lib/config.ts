export const SUPPORT_EMAIL = 'contact@golandly.com'
// The WhatsApp Cloud API line the support bot answers
// (app/api/webhooks/whatsapp/route.ts): the web widget, /support, the
// business dashboard's support page and the app's Help screen all open it.
export const SUPPORT_WHATSAPP_DISPLAY = '+972 55-288-9033'
export const SUPPORT_WHATSAPP_LINK = 'https://wa.me/972552889033'
// The phone line for calling (the privacy policy's contact details). A Cloud
// API number can't be used from the WhatsApp app, so calls stay on this one.
export const SUPPORT_PHONE_DISPLAY = '+972 55-720-6711'
export const SUPPORT_PHONE_TEL = 'tel:+972557206711'

// Shown in the drawer's About & Legal row; matches landly-mobile/app.json.
export const APP_VERSION = '1.0.0'

// Canonical public origin for SEO (sitemap, robots, metadataBase). The apex
// golandly.com redirects here, so crawlers and share cards use www.
export const SITE_URL = 'https://www.golandly.com'
export const SITE_TITLE = 'Landly — Live Israel Like a Local'
export const SITE_DESCRIPTION =
  'Real discounts at real places, all across Israel. Member perks, rights and community for olim and locals, in one place.'
