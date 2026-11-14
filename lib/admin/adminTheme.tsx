'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

// The admin's background theme. Gemini dark is the default; the settings menu
// can switch the whole admin to light. The choice lives in this browser's
// localStorage only (never the server), and anything unreadable means dark.
// The colours themselves are the --adm-* tokens in app/globals.css, switched by
// the .adm-light class AdminShell puts on the wrapper.

export type AdminTheme = 'dark' | 'light'

export const ADMIN_THEME_KEY = 'admin-theme'
export const ADMIN_THEME_COLORS: Record<AdminTheme, string> = { dark: '#131314', light: '#F8FAFC' }

export function parseAdminTheme(value: string | null | undefined): AdminTheme {
  return value === 'light' ? 'light' : 'dark'
}

interface ThemeValue {
  theme: AdminTheme
  setTheme: (theme: AdminTheme) => void
}

const ThemeContext = createContext<ThemeValue>({ theme: 'dark', setTheme: () => {} })

export function AdminThemeProvider({ children }: { children: React.ReactNode }) {
  // The server and the first client render are both dark, so hydration agrees;
  // a stored "light" is applied right after.
  const [theme, setThemeState] = useState<AdminTheme>('dark')

  useEffect(() => {
    try {
      setThemeState(parseAdminTheme(window.localStorage.getItem(ADMIN_THEME_KEY)))
    } catch {
      // Storage blocked: stay dark.
    }
  }, [])

  // The browser's address bar and status bar follow the theme.
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    const previous = meta?.content
    if (meta) meta.content = ADMIN_THEME_COLORS[theme]
    return () => {
      if (meta && previous) meta.content = previous
    }
  }, [theme])

  const setTheme = useCallback((next: AdminTheme) => {
    setThemeState(next)
    try {
      window.localStorage.setItem(ADMIN_THEME_KEY, next)
    } catch {
      // Not persisted; applies for this visit.
    }
  }, [])

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useAdminTheme(): ThemeValue {
  return useContext(ThemeContext)
}
