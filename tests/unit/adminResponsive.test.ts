import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { getAdminPageTitle } from '@/lib/admin/pageTitle'
import { trackVisualViewport } from '@/lib/admin/useVisualViewport'

// Static checks that keep the admin portal usable on a phone: no iOS zoom on
// focus, no 100vh, every tappable control at least 44px, a title for every
// page in the mobile header, and the viewport settings the keyboard handling
// relies on. Rendering is never measured here (no browser in unit tests).

vi.mock('@/components/admin/AdminShell', () => ({ default: () => null }))
vi.mock('next/navigation', () => ({ usePathname: () => '/admin/support' }))

const root = join(__dirname, '..', '..')
const read = (path: string) => readFileSync(join(root, path), 'utf8')

function sourceFiles(dir: string): string[] {
  return readdirSync(join(root, dir)).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(join(root, path)).isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(name) ? [path] : []
  })
}

const adminFiles = [...sourceFiles('app/admin'), ...sourceFiles('components/admin')]
const tsxFiles = adminFiles.filter((path) => path.endsWith('.tsx'))

/** Each `<tag …>` opening element in a file, attributes included (braces and strings respected). */
function openingTags(source: string, tag: string): { attrs: string; body: string }[] {
  const tags: { attrs: string; body: string }[] = []
  const pattern = new RegExp(`<${tag}[\\s>]`, 'g')
  for (const match of source.matchAll(pattern)) {
    let depth = 0
    let quote: string | null = null
    let i = match.index! + tag.length + 1
    for (; i < source.length; i++) {
      const ch = source[i]
      if (quote) {
        if (ch === quote && source[i - 1] !== '\\') quote = null
      } else if (ch === '"' || ch === "'" || ch === '`') quote = ch
      else if (ch === '{') depth++
      else if (ch === '}') depth--
      else if (ch === '>' && depth === 0) break
    }
    const attrs = source.slice(match.index!, i + 1)
    const close = attrs.endsWith('/>') ? -1 : source.indexOf(`</${tag}>`, i)
    tags.push({ attrs, body: close === -1 ? '' : source.slice(i + 1, close) })
  }
  return tags
}

const SIZE = /\b(?:min-)?h-(?:11|12|14|16)\b/
/** A height class, a shared *_BUTTON style (each checked below), or a control filling its 48px field's height (the password eye). */
const TOUCH_SIZE = new RegExp(`${SIZE.source}|\\b[A-Z_]+_BUTTON\\b|\\binset-y-0\\b.*\\bw-12\\b`)

describe('admin portal on phones', () => {
  it('finds the admin sources', () => {
    expect(tsxFiles).toEqual(expect.arrayContaining(['components/admin/AdminShell.tsx', 'app/admin/support/page.tsx']))
  })

  it.each(tsxFiles)('%s: every text field uses 16px text, so iOS Safari never zooms on focus', (path) => {
    for (const element of ['input', 'select', 'textarea']) {
      for (const { attrs } of openingTags(read(path), element)) {
        if (/type="(?:checkbox|radio|file|hidden)"/.test(attrs)) continue
        expect(attrs, attrs).toMatch(/\bADMIN_INPUT\b|\btext-base\b/)
      }
    }
  })

  it.each(adminFiles)('%s: sizes screens by --app-dvh, never 100vh or a bare dvh class', (path) => {
    expect(read(path)).not.toMatch(/\b100vh\b|\bh-screen\b|\bmin-h-screen\b|\b(?:min-)?h-dvh\b/)
  })

  it('falls back from dvh to vh in webviews without it', () => {
    const css = read('app/globals.css')
    expect(css).toContain(':root{--app-dvh:100dvh;}')
    expect(css).toContain('@supports not (height:100dvh){:root{--app-dvh:100vh;}}')
  })

  it.each(tsxFiles)('%s: every button is at least 44px tall', (path) => {
    for (const { attrs } of openingTags(read(path), 'button')) {
      expect(attrs, attrs).toMatch(TOUCH_SIZE)
    }
  })

  it.each(adminFiles)('%s: every shared button style is at least 44px tall', (path) => {
    // A style built on BUTTON_BASE (formStyles.ts) gets its height from there.
    for (const [, name, value] of read(path).matchAll(/const ([A-Z_]+_(?:BUTTON|BASE)) =\s*([^\n]+(?:\n\s+['`+][^\n]*)*)/g)) {
      expect(value.replace('${BUTTON_BASE}', read(path).match(/const BUTTON_BASE =([\s\S]*?)\n\n/)?.[1] ?? ''), name).toMatch(SIZE)
    }
  })

  // Font Awesome's CDN CSS overrides not-sr-only, so a label shown from a
  // breakpoint up would stay hidden; plain sr-only (live regions, radios) is fine.
  it.each(tsxFiles)('%s: every icon-only button has an aria-label, and nothing relies on not-sr-only', (path) => {
    const source = read(path)
    expect(source).not.toMatch(/not-sr-only/)
    for (const { attrs, body } of openingTags(source, 'button')) {
      const text = body.replace(/<[^>]*>/g, '').trim()
      if (!text) expect(attrs, attrs).toMatch(/aria-label=/)
    }
  })

  it('gives every admin page its own title in the mobile header', () => {
    const pages = sourceFiles('app/admin')
      .filter((path) => path.endsWith('page.tsx'))
      .map((path) => `/${relative('app', path).replace(/\/?page\.tsx$/, '').replace(/\[[^\]]+\]/g, 'x')}`)
    expect(pages).toEqual(expect.arrayContaining(['/admin', '/admin/support', '/admin/businesses/new']))
    for (const route of pages) expect(getAdminPageTitle(route), route).not.toBe('Admin')
    expect(getAdminPageTitle('/admin/support')).toBe('WhatsApp Support')
  })

  it('links the drawer only to pages that exist, WhatsApp Support right after Dashboard', () => {
    const hrefs = [...read('components/admin/Sidebar.tsx').matchAll(/href: '([^']+)'/g)].map(([, href]) => href)
    expect(hrefs.slice(0, 2)).toEqual(['/admin', '/admin/support'])
    for (const href of hrefs) expect(sourceFiles('app/admin').includes(`app${href}/page.tsx`), href).toBe(true)
  })

  it('lets the keyboard resize the layout on Android and reports the notch', async () => {
    const { viewport } = await import('@/app/admin/layout')
    expect(viewport).toMatchObject({ width: 'device-width', viewportFit: 'cover', interactiveWidget: 'resizes-content' })
  })

  it('keeps an open chat above the keyboard on phones, and the page behind it still', () => {
    const page = read('app/admin/support/page.tsx')
    expect(page).toContain('useVisualViewport()')
    expect(page).toContain('fixed inset-x-0 top-[var(--vv-top,0px)] z-40 flex h-[var(--vv-height,var(--app-dvh))]')
    expect(page).toContain('usePhoneScrollLock(!!selected)')
    // Its own header clears the notch and leads back to the list; the reply box clears the home indicator.
    expect(read('components/admin/support/ChatHeader.tsx')).toMatch(/pt-\[max\(0\.5rem,env\(safe-area-inset-top\)\)\][\s\S]*All chats/)
    expect(read('components/admin/support/ReplyComposer.tsx')).toContain('env(safe-area-inset-bottom)')
  })

  it('keeps the inbox filter tabs in three equal columns that never shift or overflow', () => {
    const list = read('components/admin/support/ConversationList.tsx')
    expect(list).toContain('role="tablist" aria-label="Filter conversations" className="grid grid-cols-3 gap-1')
    // Each tab may shrink below its label (which truncates); the count badge keeps one width from the first paint.
    expect(list).toMatch(/className=\{`flex min-h-11 min-w-0 items-center justify-center/)
    expect(list).toContain('<span className="min-w-0 truncate">{label}</span>')
    expect(list).toContain('min-w-[1.5rem] shrink-0 rounded-full px-1.5 text-center text-[11px] tabular-nums')
    expect(list).toContain("conversations ? conversations.filter((c) => matchesFilter(c, id)).length : '–'")
    expect(list).not.toMatch(/role="tablist"[^>]*\bflex\b/)
    // The panes never grow past the viewport on a phone: the column is minmax(0,1fr), the list min-w-0.
    const page = read('app/admin/support/page.tsx')
    expect(page).toContain('grid-cols-[minmax(0,1fr)]')
    expect(page).toContain('md:grid-cols-[22rem_minmax(0,1fr)]')
    expect(page).toMatch(/aria-label="Conversations" className=\{`min-h-0 min-w-0 flex-col/)
  })

  it('only shows hover styles on devices that can hover', () => {
    expect(read('tailwind.config.js')).toMatch(/future:\s*{\s*hoverOnlyWhenSupported: true,?\s*}/)
  })
})

describe('trackVisualViewport', () => {
  function fakeViewport(height: number, offsetTop = 0) {
    const listeners = new Map<string, Set<() => void>>()
    return {
      height,
      offsetTop,
      addEventListener: (type: string, listener: () => void) => {
        if (!listeners.has(type)) listeners.set(type, new Set())
        listeners.get(type)!.add(listener)
      },
      removeEventListener: (type: string, listener: () => void) => listeners.get(type)?.delete(listener),
      emit: (type: string) => listeners.get(type)?.forEach((listener) => listener()),
      count: () => [...listeners.values()].reduce((n, set) => n + set.size, 0),
    }
  }
  function fakeStyle() {
    const values = new Map<string, string>()
    return { values, setProperty: (name: string, value: string) => values.set(name, value), removeProperty: (name: string) => values.delete(name) }
  }

  it('publishes the visible height and offset at once', () => {
    const style = fakeStyle()
    trackVisualViewport(fakeViewport(812.4, 0), style)
    expect(Object.fromEntries(style.values)).toEqual({ '--vv-height': '812px', '--vv-top': '0px' })
  })

  it('follows the keyboard opening (resize) and Safari panning the page (scroll)', () => {
    const viewport = fakeViewport(812)
    const style = fakeStyle()
    trackVisualViewport(viewport, style)
    viewport.height = 476
    viewport.emit('resize')
    expect(style.values.get('--vv-height')).toBe('476px')
    viewport.offsetTop = 120.6
    viewport.emit('scroll')
    expect(style.values.get('--vv-top')).toBe('121px')
    // Rubber-banding past the top never pushes the panel down.
    viewport.offsetTop = -30
    viewport.emit('scroll')
    expect(style.values.get('--vv-top')).toBe('0px')
  })

  it('removes its listeners and the variables on cleanup', () => {
    const viewport = fakeViewport(700)
    const style = fakeStyle()
    const stop = trackVisualViewport(viewport, style)
    expect(viewport.count()).toBe(2)
    stop()
    expect(viewport.count()).toBe(0)
    expect(style.values.size).toBe(0)
  })

  it('does nothing without the API, leaving the CSS fallbacks in force', () => {
    const style = fakeStyle()
    const stop = trackVisualViewport(undefined, style)
    expect(style.values.size).toBe(0)
    expect(stop).not.toThrow()
  })
})

describe('admin navigation: sidebar on desktop, drawer on phones', () => {
  const noop = () => {}
  const classOf = (html: string, marker: string) => html.match(new RegExp(`<[^>]*${marker}[^>]*class="([^"]*)"`))?.[1] ?? html.match(new RegExp(`<[^>]*class="([^"]*)"[^>]*${marker}`))?.[1] ?? ''

  it.each(adminFiles)('%s: uses no ltr:/rtl: variants (they also match under a Hebrew <html dir="rtl">)', (path) => {
    expect(read(path)).not.toMatch(/\b(?:ltr|rtl):[a-z-[]/)
  })

  it('renders the inline sidebar only from md', async () => {
    const { DesktopSidebar } = await import('@/components/admin/Sidebar')
    const html = renderToStaticMarkup(createElement(DesktopSidebar, { onLogout: noop, needsReply: 0 }))
    const classes = classOf(html, 'aria-label="Admin navigation"').split(' ')
    expect(classes).toEqual(expect.arrayContaining(['hidden', 'md:flex', 'w-64', 'shrink-0', 'sticky']))
    expect(html).toContain('aria-current="page"')
    expect(html).not.toContain('Close menu')
  })

  it('keeps a closed drawer off-screen, invisible and inert', async () => {
    const { MobileDrawer } = await import('@/components/admin/Sidebar')
    const html = renderToStaticMarkup(createElement(MobileDrawer, { open: false, onClose: noop, onNavigate: noop, onLogout: noop, needsReply: 0 }))
    const root = classOf(html, 'id="admin-drawer"').split(' ')
    expect(root).toEqual(expect.arrayContaining(['fixed', 'inset-0', 'z-50', 'flex', 'md:hidden', 'invisible']))
    expect(html).toMatch(/id="admin-drawer"[^>]*inert=""|inert=""[^>]*id="admin-drawer"/)
    expect(html).toContain('-translate-x-full')
    expect(html).toContain('opacity-0')
  })

  it('slides an open drawer in over a blurred backdrop, with a 48px close button', async () => {
    const { MobileDrawer } = await import('@/components/admin/Sidebar')
    const html = renderToStaticMarkup(createElement(MobileDrawer, { open: true, onClose: noop, onNavigate: noop, onLogout: noop, needsReply: 0 }))
    expect(html).not.toMatch(/inert=/)
    expect(classOf(html, 'id="admin-drawer"').split(' ')).toContain('visible')
    expect(html).toMatch(/class="[^"]*fixed inset-0 bg-slate-900\/40 backdrop-blur-sm[^"]*opacity-100/)
    expect(html).toMatch(/class="[^"]*w-72 max-w-\[85vw\][^"]*translate-x-0/)
    expect(html).toMatch(/class="[^"]*h-12 w-12[^"]*"[^>]*aria-label="Close menu"/)
    expect(html).toContain('pt-[env(safe-area-inset-top)]')
    expect(html).toContain('env(safe-area-inset-bottom)')
    for (const label of ['Dashboard', 'WhatsApp Support', 'Businesses', 'Offers']) expect(html).toContain(label)
  })

  it('locks the page, closes on Escape, on growing past md and on navigation', () => {
    const sidebar = read('components/admin/Sidebar.tsx')
    expect(sidebar).toContain("document.body.style.overflow = 'hidden'")
    expect(sidebar).toContain("event.key === 'Escape'")
    expect(sidebar).toMatch(/media\.addEventListener\('change', onWiden\)/)
    const shell = read('components/admin/AdminShell.tsx')
    expect(shell).toMatch(/useEffect\(\(\) => {\s*setIsMobileOpen\(false\)\s*}, \[pathname\]\)/)
  })

  it('gives the page the full width on phones, with the ☰ wired to the drawer', () => {
    const shell = read('components/admin/AdminShell.tsx')
    expect(shell).not.toContain('md:ps-64')
    expect(shell).toContain('w-full min-w-0 flex-1 flex-col')
    const header = read('components/admin/AdminHeader.tsx')
    expect(header).toMatch(/h-12 w-12[^"]*md:hidden"\s*aria-label=\{[^\n]*'Open menu'\}\s*aria-controls="admin-drawer"/)
  })
})

describe('swipe back', () => {
  it.each(adminFiles)('%s: never contains sideways overscroll or blocks touch, so Chrome\'s back gesture works from any pane', (path) => {
    const source = read(path)
    expect(source).not.toMatch(/\boverscroll-(?:contain|none|x-contain|x-none)\b/)
    expect(source).not.toMatch(/\btouch-none\b|touch-action:\s*none/)
  })

  it('gives an opened chat its own history entry, so back and the edge swipe return to the list', () => {
    const page = read('app/admin/support/page.tsx')
    const open = page.slice(page.indexOf('const open = '), page.indexOf('const closeChat'))
    // From the list: a new entry. Between chats: replaced, so back doesn't walk every chat viewed.
    expect(open).toMatch(/if \(selected\) {\s*router\.replace\(href[\s\S]*} else {\s*pushedRef\.current = true\s*router\.push\(href/)
    const close = page.slice(page.indexOf('const closeChat'), page.indexOf('const appendMessage'))
    expect(close).toMatch(/if \(pushedRef\.current\) router\.back\(\)\s*else router\.replace\(pathname/)
    expect(page).not.toContain('open(null)')
  })
})

describe('back buttons and forward chevrons', () => {
  it('draws back as a 44px chevron-left button with its label', async () => {
    const { default: BackButton } = await import('@/components/admin/BackButton')
    for (const props of [{ href: '/admin/businesses' }, { onClick: () => {} }]) {
      const html = renderToStaticMarkup(createElement(BackButton, { ...props, children: 'All chats' } as Parameters<typeof BackButton>[0]))
      expect(html).toContain('fa-chevron-left')
      expect(html).toContain('>All chats<')
      for (const token of ['min-h-11', 'min-w-11', 'px-3', 'py-2', 'rounded-xl', 'text-slate-700', 'hover:text-slate-900', 'active:bg-slate-100']) expect(html).toContain(token)
    }
  })

  it.each(adminFiles.filter((path) => path !== 'components/admin/BackButton.tsx'))('%s: goes back only through BackButton, and points chevrons forward', (path) => {
    expect(read(path)).not.toMatch(/fa-(?:arrow|chevron)-left/)
  })
})

describe('no duplicate page titles', () => {
  it('keeps PageHeader\'s h1 for screen readers only, since the header shows the title', async () => {
    const { default: PageHeader } = await import('@/components/admin/PageHeader')
    const html = renderToStaticMarkup(createElement(PageHeader, { title: 'Offers', subtitle: 'All perks across every business.' }))
    expect(html).toContain('<h1 class="sr-only">Offers</h1>')
    expect(html).toContain('All perks across every business.')
  })

  it.each(tsxFiles)('%s: shows no visible h1 the header already shows', (path) => {
    // The exceptions say something the header doesn't: a success state, and the login page (no header).
    const allowed = ['>Offer created</h1>', '>Business created</h1>', '>Sign In</h1>']
    for (const { attrs, body } of openingTags(read(path), 'h1')) {
      if (allowed.includes(`>${body}</h1>`)) continue
      expect(attrs, `${attrs}${body}`).toContain('sr-only')
    }
  })
})

describe('needs-reply badge', () => {
  const noop = () => {}

  it('caps the count at 99+', async () => {
    const { formatBadgeCount } = await import('@/lib/admin/needsReply')
    expect([1, 99, 100, 1234].map(formatBadgeCount)).toEqual(['1', '99', '99+', '99+'])
  })

  it('renders nothing at zero, and a WhatsApp-green pill otherwise', async () => {
    const { default: WhatsAppBadge } = await import('@/components/admin/WhatsAppBadge')
    expect(renderToStaticMarkup(createElement(WhatsAppBadge, { count: 0 }))).toBe('')
    const html = renderToStaticMarkup(createElement(WhatsAppBadge, { count: 150 }))
    expect(html).toContain('<span aria-hidden="true">99+</span>')
    expect(html).toContain('150 need a reply')
    for (const token of ['bg-[#16A34A]', 'text-white', 'text-[11px]', 'font-bold', 'leading-none', 'tracking-tight', 'min-w-[18px]', 'h-[18px]', 'px-1.5', 'rounded-full', 'shadow-sm', 'items-center', 'justify-center']) {
      expect(html).toContain(token)
    }
  })

  it('badges the ☰ at its top-end corner and says so to screen readers', async () => {
    const { default: AdminHeader } = await import('@/components/admin/AdminHeader')
    const props = { menuOpen: false, onOpenMenu: noop, menuButtonRef: null }
    const html = renderToStaticMarkup(createElement(AdminHeader, { ...props, needsReply: 3 }))
    expect(html).toContain('aria-label="Open menu, 3 WhatsApp chats need a reply"')
    expect(html).toMatch(/absolute -end-1 -top-1[^"]*"><span aria-hidden="true">3</)
    const quiet = renderToStaticMarkup(createElement(AdminHeader, { ...props, needsReply: 0 }))
    expect(quiet).toContain('aria-label="Open menu"')
    expect(quiet).not.toContain('bg-[#16A34A]')
  })

  it('lays the phone top bar out in three zones, the title centred between equal sides', async () => {
    const { default: AdminHeader } = await import('@/components/admin/AdminHeader')
    const html = renderToStaticMarkup(createElement(AdminHeader, { menuOpen: false, onOpenMenu: noop, menuButtonRef: null, needsReply: 0 }))
    const header = html.match(/<header class="([^"]*)"/)![1].split(' ')
    for (const token of ['sticky', 'top-0', 'z-40', 'overflow-x-clip', 'bg-white/95', 'backdrop-blur-md', 'border-slate-200/80', 'pt-[max(env(safe-area-inset-top),0.75rem)]', 'pb-3', 'md:pt-[env(safe-area-inset-top)]', 'md:pb-0']) {
      expect(header, token).toContain(token)
    }
    const row = html.match(/<header[^>]*><div class="([^"]*)"/)![1].split(' ')
    for (const token of ['grid', 'h-12', 'grid-cols-[4.5rem_minmax(0,1fr)_4.5rem]', 'px-4', 'sm:px-6', 'md:flex', 'md:h-16']) expect(row, token).toContain(token)
    expect(html).toMatch(/<span class="[^"]*\btruncate text-center text-base font-semibold text-slate-900 sm:text-lg md:hidden">WhatsApp Support<\/span>/)
    // The ☰ keeps its 48px target with tap feedback, and nothing sits outside the gutter.
    expect(html).toMatch(/class="relative flex h-12 w-12 [^"]*active:bg-slate-100/)
    expect(html).not.toMatch(/-m[se]-\d/)
  })

  it('keeps the clock out of the phone top bar below 640px, and muted up to md', () => {
    const header = read('components/admin/AdminHeader.tsx')
    expect(header).toMatch(/<div className="hidden sm:block md:hidden">\s*<LiveClock compact muted \/>/)
    expect(header).toMatch(/<div className="hidden lg:block">\s*<LiveClock \/>/)
    expect(read('components/admin/LiveClock.tsx')).toContain("muted ? 'text-xs font-medium text-slate-400'")
  })

  it('tells full-screen pages the header\'s height on phones and from md', () => {
    const shell = read('components/admin/AdminShell.tsx')
    expect(shell).toContain("'--admin-header-h': 'calc(max(env(safe-area-inset-top, 0px), 0.75rem) + 3.75rem)'")
    expect(shell).toContain("'--admin-header-h-md': 'calc(4rem + env(safe-area-inset-top, 0px))'")
    const page = read('app/admin/support/page.tsx')
    expect(page).toContain("'--panes-h': 'calc(var(--vv-height, var(--app-dvh)) - var(--admin-header-h))'")
    expect(page).toContain('var(--admin-header-h-md) - 2rem')
  })

  it('badges "WhatsApp Support" at the trailing edge, in the drawer and the sidebar', async () => {
    const { DesktopSidebar, MobileDrawer } = await import('@/components/admin/Sidebar')
    const drawer = renderToStaticMarkup(createElement(MobileDrawer, { open: true, onClose: noop, onNavigate: noop, onLogout: noop, needsReply: 5 }))
    const sidebar = renderToStaticMarkup(createElement(DesktopSidebar, { onLogout: noop, needsReply: 5 }))
    for (const html of [drawer, sidebar]) {
      expect(html).toMatch(/href="\/admin\/support"[^>]*>(?:(?!<\/a>).)*WhatsApp Support<span class="[^"]*bg-\[#16A34A\][^"]*\bms-auto"><span aria-hidden="true">5</)
      expect(html.match(/bg-\[#16A34A\]/g)).toHaveLength(1)
    }
  })

  it('polls every 30 seconds only while the tab is visible and someone is signed in', () => {
    const hook = read('lib/admin/needsReply.ts')
    expect(hook).toContain('export const POLL_MS = 30_000')
    expect(hook).toContain('if (follow || document.hidden || !getStoredToken()) return')
    expect(hook).toContain("document.addEventListener('visibilitychange', load)")
    expect(hook).toContain("'/api/admin/whatsapp/conversations?summary=1'")
    expect(read('components/admin/AdminShell.tsx')).toContain("useNeedsReplyCount(pathname !== '/admin/login', { follow: pathname.startsWith('/admin/support') })")
  })

  it('only follows the inbox\'s announcements while it is open, so a stale summary never brings the old count back', () => {
    const hook = read('lib/admin/needsReply.ts')
    expect(hook).toContain('const timer = follow ? undefined : setInterval(load, POLL_MS)')
    expect(hook).toContain('}, [enabled, follow])')
    const page = read('app/admin/support/page.tsx')
    expect(page).toContain('const LIST_POLL_MS = 4_000')
    expect(page).toContain('const CHAT_POLL_MS = 4_000')
    expect(page).toContain('if (listLoaded) announceNeedsReply(awaiting)')
  })
})
