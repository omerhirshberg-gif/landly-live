import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ADMIN_THEME_COLORS, ADMIN_THEME_KEY, parseAdminTheme } from '@/lib/admin/adminTheme'

// The admin is Gemini dark by default and may be switched to light, all through
// the --adm-* tokens. These checks keep the theme from leaking into /business
// and the public site, and keep light-theme literals out of the admin.

const root = join(__dirname, '..', '..')
const read = (path: string) => readFileSync(join(root, path), 'utf8')
function sourceFiles(dir: string): string[] {
  return readdirSync(join(root, dir)).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(join(root, path)).isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx)$/.test(name) ? [path] : []
  })
}

describe('admin theme', () => {
  it('defaults to dark and accepts only "light" as the other choice', () => {
    expect(parseAdminTheme(null)).toBe('dark')
    expect(parseAdminTheme(undefined)).toBe('dark')
    expect(parseAdminTheme('')).toBe('dark')
    expect(parseAdminTheme('blue')).toBe('dark')
    expect(parseAdminTheme('dark')).toBe('dark')
    expect(parseAdminTheme('light')).toBe('light')
    expect(ADMIN_THEME_KEY).toBe('admin-theme')
  })

  it('paints the browser chrome the same as the canvas', async () => {
    expect(ADMIN_THEME_COLORS).toEqual({ dark: '#131314', light: '#F8FAFC' })
    const { viewport } = await import('@/app/admin/layout')
    expect(viewport.themeColor).toBe('#131314')
    expect(viewport.viewportFit).toBe('cover')
  })

  it('defines the exact Gemini dark tokens, and keeps the light ones as the default outside the admin', () => {
    const css = read('app/globals.css')
    const dark = css.match(/\.admin-scale:not\(\.adm-light\)\{([^}]*)\}/)![1]
    const light = css.match(/:root,\.admin-scale\.adm-light\{([^}]*)\}/)![1]
    const channels: Record<string, string> = {
      canvas: '19 19 20', // #131314
      surface: '30 31 32', // #1E1F20
      raised: '40 42 44', // #282A2C
      line: '51 53 55', // #333537
      text: '227 227 227', // #E3E3E3
      'text-2': '196 199 197', // #C4C7C5
      muted: '142 145 143', // #8E918F
      accent: '168 199 250', // #A8C7FA
      'on-accent': '6 46 111', // #062E6F
      'nav-active': '8 66 160', // #0842A0
      'nav-active-text': '211 227 253', // #D3E3FD
    }
    for (const [name, value] of Object.entries(channels)) expect(dark, name).toContain(`--adm-${name}:${value}`)
    expect(dark).toContain('color-scheme:dark')
    // The original light palette, which /business's Card still gets.
    expect(light).toContain('--adm-surface:255 255 255')
    expect(light).toContain('--adm-line:226 232 240')
    expect(light).toContain('--adm-accent:0 56 184')
  })

  it('keeps the dark tokens inside .admin-scale, which only the admin shell applies', () => {
    expect(read('components/admin/AdminShell.tsx')).toContain('admin-scale')
    const users = [...sourceFiles('app'), ...sourceFiles('components'), ...sourceFiles('lib')].filter(
      (path) => !/^(app\/admin|components\/admin|lib\/admin)\//.test(path) && /admin-scale/.test(read(path)),
    )
    expect(users).toEqual([])
  })
})

describe('the /business dashboard and the public site stay as they were', () => {
  const outside = [...sourceFiles('app'), ...sourceFiles('components'), ...sourceFiles('lib')].filter(
    (path) => !/^(app\/admin|components\/admin|lib\/admin|app\/api\/admin)\//.test(path),
  )

  it.each(outside)('%s: uses no admin theme token, switch or provider', (path) => {
    const source = read(path)
    expect(source).not.toMatch(/-adm-|--adm-|adm-light|AdminTheme|useAdminTheme/)
  })

  it('leaves SidebarShell untouched by the theme', () => {
    expect(read('components/layout/SidebarShell.tsx')).not.toMatch(/adm-|admin-scale/)
  })

  it('gives the shared Card the light values outside the admin (tokens fall back to :root)', () => {
    const card = read('components/admin/Card.tsx')
    expect(card).toContain('bg-adm-surface')
    expect(read('app/globals.css')).toMatch(/:root,\.admin-scale\.adm-light\{[^}]*--adm-surface:255 255 255/)
  })
})

describe('no light-theme literals left in the admin', () => {
  const admin = [...sourceFiles('app/admin'), ...sourceFiles('components/admin')]
  // White or pale surfaces and the old navy/slate text: all of these are tokens now.
  const LIGHT = /(?<![\w-])(?:hover:|focus:|active:|focus-visible:|disabled:|placeholder:|group-hover:)*(?:bg-white(?!\/(?:5|10|15|20|25|30)\b)|bg-\[#(?:F8FAFC|F1F5F9|F0F7FF|F4F6F9|FEF2F2|FFFBEB|ECFDF5|EFF6FF|E2E8F0)\](?:\/\d+)?|bg-slate-(?:50|100|200)\b|text-\[#0B1B3D\]|text-slate-(?:500|600|700|800|900)\b|border-slate-(?:100|200|300)\b|border-\[#(?:E2E8F0|CBD5E1)\])/g

  it.each(admin)('%s', (path) => {
    expect([...read(path).matchAll(LIGHT)].map((m) => m[0])).toEqual([])
  })
})
