import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LangContext } from '@/lib/i18n/LangProvider'
import { RTL_LANGS, translations, type Lang, type TranslationKey } from '@/lib/i18n/translations'

const nav = vi.hoisted(() => ({ pathname: '/' }))
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }))

import {
  isBubbleDismissed,
  isWidgetHidden,
  rememberBubbleDismissed,
  rememberWidgetHidden,
  showsWhatsAppWidget,
  whatsappChatHref,
  WHATSAPP_BUBBLE_DISMISSED_KEY,
  WHATSAPP_HIDDEN_CLASS,
  WHATSAPP_HIDDEN_SCRIPT,
  WHATSAPP_WIDGET_HIDDEN_KEY,
} from '@/lib/support/whatsapp'
import { bottomCoverage, floatingClearance } from '@/lib/layout/floatingClearance'
const { default: WhatsAppWidget, WhatsAppWidgetView, BUBBLE_DELAY_MS } = await import('@/components/layout/WhatsAppWidget')

const read = (path: string) => readFileSync(path, 'utf8')
// Text as React writes it into markup.
const esc = (text: string) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function withLang(lang: Lang, element: ReturnType<typeof createElement>) {
  const t = (key: TranslationKey) => translations[lang][key]
  const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
  return renderToStaticMarkup(createElement(LangContext.Provider, { value: { lang, setLang: () => {}, t, isRtl } }, element))
}

function view(lang: Lang, bubbleOpen: boolean, lift = 0) {
  const t = (key: TranslationKey) => translations[lang][key]
  return renderToStaticMarkup(
    createElement(WhatsAppWidgetView, { href: whatsappChatHref(t('whatsapp_prefill')), lift, bubbleOpen, onDismiss: () => {}, onHide: () => {}, t, isRtl: lang === 'he' })
  )
}

describe('WhatsApp chat link', () => {
  it('opens the support line with the greeting pre-filled and URL-encoded', () => {
    expect(whatsappChatHref(translations.en.whatsapp_prefill)).toBe(
      'https://wa.me/972552889033?text=Hi%20Landly%20team%2C%20I%20would%20like%20some%20assistance%20regarding%20perks%20and%20services%20on%20the%20website%20%3A)'
    )
    const he = new URL(whatsappChatHref(translations.he.whatsapp_prefill))
    expect(he.origin + he.pathname).toBe('https://wa.me/972552889033')
    expect(he.searchParams.get('text')).toBe('שלום צוות Landly, אשמח לעזרה בנוגע להטבות ולשירות באתר :)')
    expect(whatsappChatHref('   ')).toBe('https://wa.me/972552889033')
  })

  it('has the greeting and labels in every language', () => {
    for (const lang of Object.keys(translations) as Lang[]) {
      for (const key of ['whatsapp_prefill', 'whatsapp_bubble_title', 'whatsapp_bubble_sub', 'whatsapp_bubble_dismiss', 'whatsapp_badge_label', 'whatsapp_widget_close'] as const) {
        expect(translations[lang][key]).toBeTruthy()
      }
    }
    expect(translations.en.whatsapp_bubble_title).toBe('Need help? 💬')
    expect(translations.en.whatsapp_bubble_sub).toBe('Chat with our team directly on WhatsApp')
  })
})

describe('where the widget shows', () => {
  it.each(['/', '/categories', '/offers/abc', '/olim', '/support', '/member', '/profile', '/business'])('shows on %s', (path) => {
    expect(showsWhatsAppWidget(path)).toBe(true)
  })
  it.each(['/admin', '/admin/offers', '/business/dashboard', '/business/dashboard/offers', '/business/login', '/checkout', '/checkout/success', '/login', '/signup', '/forgot-password', '/reset-password', '/verify-email'])(
    'stays off %s',
    (path) => {
      expect(showsWhatsAppWidget(path)).toBe(false)
    }
  )
  it('is in the server HTML as a plain wa.me link, so it opens WhatsApp before (or without) JavaScript', () => {
    nav.pathname = '/'
    const html = withLang('en', createElement(WhatsAppWidget))
    const badge = html.match(/<a [^>]*class="wa-badge[^"]*"[^>]*>/)?.[0] ?? ''
    expect(badge).toContain(`href="${esc(whatsappChatHref(translations.en.whatsapp_prefill))}"`)
    expect(badge).toContain('href="https://wa.me/972552889033?text=')
    expect(badge).toContain('target="_blank"')
    expect(badge).toContain('rel="noopener noreferrer"')
    expect(badge).not.toMatch(/onclick/i)
    nav.pathname = '/checkout'
    expect(withLang('en', createElement(WhatsAppWidget))).toBe('')
    nav.pathname = '/'
    const source = read('components/layout/WhatsAppWidget.tsx')
    expect(source).toContain('const [hidden, setHidden] = useState<boolean | null>(null)')
    expect(source).toContain('const shown = showsWhatsAppWidget(pathname) && hidden !== true')
    expect(source).toContain('setHidden(isWidgetHidden(tabStorage))')
  })
})

// Runs before React with nothing but the browser's globals; here, stand-ins for them.
function runHiddenScript(storage: { getItem: (key: string) => string | null }) {
  const classes = new Set<string>()
  const document = { documentElement: { classList: { add: (name: string) => classes.add(name) } } }
  new Function('sessionStorage', 'document', WHATSAPP_HIDDEN_SCRIPT)(storage, document)
  return classes
}

describe('a tab that closed the widget', () => {
  it('is marked on <html> before the first paint, and globals.css hides the server-rendered widget there', () => {
    expect(runHiddenScript({ getItem: (key) => (key === WHATSAPP_WIDGET_HIDDEN_KEY ? '1' : null) })).toEqual(new Set([WHATSAPP_HIDDEN_CLASS]))
    expect(runHiddenScript({ getItem: () => null }).size).toBe(0)
    expect(read('app/globals.css')).toContain(`html.${WHATSAPP_HIDDEN_CLASS} .wa-widget{display:none;}`)
    expect(read('app/layout.tsx')).toContain('<script dangerouslySetInnerHTML={{ __html: WHATSAPP_HIDDEN_SCRIPT }} />')
  })

  it('never throws when storage is blocked, and is plain ES5', () => {
    expect(() => runHiddenScript({ getItem: () => { throw new Error('SecurityError') } })).not.toThrow()
    expect(WHATSAPP_HIDDEN_SCRIPT).not.toMatch(/=>|\bimport\b|\bconst\b|\blet\b|\?\./)
  })
})

describe('the badge', () => {
  it.each(['en', 'he'] as const)('is a new-tab link to the chat, named for screen readers, bottom right (%s)', (lang) => {
    const html = view(lang, false)
    const t = translations[lang]
    const badge = html.match(/<a [^>]*class="wa-badge[^"]*"[^>]*>/)?.[0] ?? ''
    expect(badge).toContain(`href="${esc(whatsappChatHref(t.whatsapp_prefill))}"`)
    expect(badge).toContain('target="_blank"')
    expect(badge).toContain('rel="noopener noreferrer"')
    expect(badge).toContain(`aria-label="${esc(t.whatsapp_badge_label)}"`)
    expect(badge).toContain('bg-[#25D366]')
    expect(badge).toContain('[@media(hover:hover)]:hover:scale-[1.08] active:scale-95')
    // Pinned to the right in every language, 20px in like the accessibility button on the left, on the shared bottom line.
    expect(html).toMatch(/^<div dir="ltr" class="wa-widget fixed right-5 z-\[890\]/)
    expect(html).toContain('bottom:var(--floating-base)')
    expect(html).toContain('<span aria-hidden="true" class="wa-glow')
  })

  it('rises by the measured clearance', () => {
    expect(view('en', false, 0)).not.toContain('translateY')
    expect(view('en', false, 132)).toContain('transform:translateY(-132px)')
  })

  it('breathes slowly, and keeps still under reduced motion', () => {
    const css = read('app/globals.css')
    expect(css).toContain('.wa-glow{animation:wa-breathe 3.2s ease-in-out infinite;}')
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\{\s*\.wa-widget\{transition:none;\}\s*\.wa-glow\{animation:none;opacity:0;\}\s*\.wa-bubble\{animation:none;\}/)
  })
})

describe('the bubble', () => {
  it('is closed in the first render, then opens after a short delay', () => {
    expect(view('en', false)).not.toContain('wa-bubble')
    expect(BUBBLE_DELAY_MS).toBe(2000)
    expect(read('components/layout/WhatsAppWidget.tsx')).toContain('if (!shown || isBubbleDismissed(tabStorage)) return')
  })

  it.each(['en', 'he'] as const)('says "Need help?", links to the chat and has a labelled X, in a polite live region (%s)', (lang) => {
    const t = translations[lang]
    const html = view(lang, true)
    expect(html).toContain(`<div aria-live="polite" class="flex flex-col items-end"><div dir="${lang === 'he' ? 'rtl' : 'ltr'}" class="wa-bubble`)
    expect(html).toContain(`>${esc(t.whatsapp_bubble_title)}</span>`)
    expect(html).toContain(`>${esc(t.whatsapp_bubble_sub)}</span>`)
    expect(html.match(/target="_blank" rel="noopener noreferrer"/g)).toHaveLength(2)
    expect(html).toMatch(new RegExp(`<button type="button" aria-label="${esc(t.whatsapp_bubble_dismiss)}" class="[^"]*after:-inset-2`))
    expect(html).toContain('max-w-[240px]')
  })

  it('stays dismissed for the tab session, and survives blocked storage', () => {
    const store = new Map<string, string>()
    const session = () => ({ getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) })
    expect(isBubbleDismissed(session)).toBe(false)
    rememberBubbleDismissed(session)
    expect(store.get(WHATSAPP_BUBBLE_DISMISSED_KEY)).toBe('1')
    expect(isBubbleDismissed(session)).toBe(true)
    const blocked = () => {
      throw new Error('SecurityError')
    }
    expect(isBubbleDismissed(blocked)).toBe(false)
    expect(() => rememberBubbleDismissed(blocked)).not.toThrow()
    expect(read('components/layout/WhatsAppWidget.tsx')).toContain('const tabStorage = () => window.sessionStorage')
  })

  it('closes with Escape too', () => {
    expect(read('components/layout/WhatsAppWidget.tsx')).toMatch(/if \(e\.key === 'Escape'\) dismiss\(\)/)
  })
})

describe('hiding the whole widget', () => {
  it.each(['en', 'he'] as const)('puts a labelled X on the badge, at its top left toward the page (%s)', (lang) => {
    const t = translations[lang]
    const html = view(lang, false)
    const close = html.match(/<button type="button" aria-label="([^"]*)" class="(absolute -left-1\.5 -top-1\.5[^"]*)">/)
    expect(close?.[1]).toBe(esc(t.whatsapp_widget_close))
    // A 22px circle with a 34px touch area, so it takes little of the badge's own.
    expect(close?.[2]).toContain('h-[22px] w-[22px]')
    expect(close?.[2]).toContain('after:-inset-1.5')
    // Beside the badge link, never inside it (a button can't sit in a link).
    expect(html).toMatch(/<div class="relative"><a [^>]*class="wa-badge[\s\S]*?<\/a><button type="button" aria-label/)
  })

  it('hides badge and bubble for the tab session, and survives blocked storage', () => {
    const store = new Map<string, string>()
    const session = () => ({ getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) })
    expect(isWidgetHidden(session)).toBe(false)
    rememberWidgetHidden(session)
    expect(store.get(WHATSAPP_WIDGET_HIDDEN_KEY)).toBe('1')
    expect(isWidgetHidden(session)).toBe(true)
    // Separate from the bubble's own X.
    expect(isBubbleDismissed(session)).toBe(false)
    const blocked = () => {
      throw new Error('SecurityError')
    }
    expect(isWidgetHidden(blocked)).toBe(false)
    expect(() => rememberWidgetHidden(blocked)).not.toThrow()
    expect(read('components/layout/WhatsAppWidget.tsx')).toMatch(/const hide = \(\) => \{\s*setHidden\(true\)\s*setBubbleOpen\(false\)\s*rememberWidgetHidden\(tabStorage\)/)
  })
})

describe('lined up with the accessibility button', () => {
  const css = read('app/globals.css')

  it('shares one bottom line, clear of the iPhone home indicator', () => {
    expect(css).toContain(':root{--floating-base:max(1.5rem, calc(env(safe-area-inset-bottom, 0px) + 0.75rem));}')
  })

  it('moves Enable\'s button so its centre is level with the badge\'s, and lifts it with the badge', () => {
    // Enable: bottom edge = -top - 1px. Centred on the 56px badge: base + 8px (40px icon), base + 2px up to 480px (52px).
    expect(css).toContain('body #enable-toolbar-trigger{top:calc(-1 * (var(--floating-base) + var(--floating-lift, 0px) + 9px)) !important;}')
    expect(css).toMatch(/@media screen and \(max-width:480px\)\{\s*body #enable-toolbar-trigger\{top:calc\(-1 \* \(var\(--floating-base\) \+ var\(--floating-lift, 0px\) \+ 3px\)\) !important;\}/)
    const widget = read('components/layout/WhatsAppWidget.tsx')
    expect(widget).toContain("root.style.setProperty('--floating-lift', `${current}px`)")
    expect(widget).toMatch(/return \(\) => \{\s*root\.style\.removeProperty\('--floating-lift'\)\s*\}/)
  })
})

describe('staying clear of bottom bars', () => {
  it('measures how much of the bottom edge an element covers', () => {
    expect(bottomCoverage({ top: 700, bottom: 800 }, 800)).toBe(100)
    expect(bottomCoverage({ top: 700, bottom: 799.4 }, 800)).toBe(100)
    expect(bottomCoverage({ top: 500, bottom: 600 }, 800)).toBe(0)
    expect(bottomCoverage({ top: 900, bottom: 1000 }, 800)).toBe(0)
  })

  it('rises by the tallest marked bar', () => {
    const el = (top: number, bottom: number) => ({ getBoundingClientRect: () => ({ top, bottom }) })
    const root = { querySelectorAll: (selector: string) => (selector === '[data-floating-clearance]' ? [el(720, 800), el(668.4, 800), el(100, 200)] : []) }
    expect(floatingClearance(root as unknown as ParentNode, 800)).toBe(132)
  })

  it('marks the cookie bar and the offer purchase bar', () => {
    expect(read('components/layout/CookieNotice.tsx')).toMatch(/data-floating-clearance=""\s+className="fixed bottom-0 inset-x-0/)
    expect(read('app/offers/[offerId]/page.tsx')).toContain('<div data-floating-clearance="" className="sticky bottom-0')
  })

  it('is mounted site-wide, under the navbar and drawer', () => {
    // Each in its own SectionBoundary, in this order.
    expect(read('app/layout.tsx')).toMatch(/\{children\}\s*<SectionBoundary name="whatsapp-widget"><WhatsAppWidget \/><\/SectionBoundary>\s*<SectionBoundary name="cookie-notice"><CookieNotice \/><\/SectionBoundary>/)
  })
})
