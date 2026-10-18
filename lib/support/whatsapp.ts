import { SUPPORT_WHATSAPP_LINK } from '@/lib/config'

// The floating WhatsApp support widget's rules (components/layout/WhatsAppWidget.tsx):
// the chat link with its pre-filled message, and the pages it stays off. Pure,
// so both are tested on their own.

/** wa.me with the greeting pre-filled in the member's language (the text is URL-encoded). */
export function whatsappChatHref(message: string): string {
  const text = message.trim()
  return text ? `${SUPPORT_WHATSAPP_LINK}?text=${encodeURIComponent(text)}` : SUPPORT_WHATSAPP_LINK
}

// Admin and the business dashboard (staff tools), checkout (the payment
// step needs nothing floating over it), and the sign-in and account-recovery
// screens. Everywhere else -- public browsing, perks, /support, member pages
// -- shows it.
const HIDDEN_PATHS = [
  '/admin',
  '/business/dashboard',
  '/business/login',
  '/checkout',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
]

export function showsWhatsAppWidget(pathname: string | null): boolean {
  if (!pathname) return false
  return !HIDDEN_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

// sessionStorage keys: each X holds for the rest of the tab session. The
// bubble's closes only the bubble; the badge's hides the whole widget.
export const WHATSAPP_BUBBLE_DISMISSED_KEY = 'landly_whatsapp_bubble_dismissed'
export const WHATSAPP_WIDGET_HIDDEN_KEY = 'landly_whatsapp_widget_hidden'

type KeyStore = Pick<Storage, 'getItem' | 'setItem'>

// Blocked storage (private mode, previews) reads as "not yet" and forgets
// the choice, so the widget just returns on the next load.
function readFlag(storage: () => KeyStore, key: string): boolean {
  try {
    return storage().getItem(key) === '1'
  } catch {
    return false
  }
}

function writeFlag(storage: () => KeyStore, key: string): void {
  try {
    storage().setItem(key, '1')
  } catch {
    // Storage blocked.
  }
}

/** Whether this tab already closed the bubble. */
export const isBubbleDismissed = (storage: () => KeyStore) => readFlag(storage, WHATSAPP_BUBBLE_DISMISSED_KEY)
export const rememberBubbleDismissed = (storage: () => KeyStore) => writeFlag(storage, WHATSAPP_BUBBLE_DISMISSED_KEY)

/** Whether this tab hid the whole widget (the badge's X). */
export const isWidgetHidden = (storage: () => KeyStore) => readFlag(storage, WHATSAPP_WIDGET_HIDDEN_KEY)
export const rememberWidgetHidden = (storage: () => KeyStore) => writeFlag(storage, WHATSAPP_WIDGET_HIDDEN_KEY)
