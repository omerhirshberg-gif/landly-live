'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { matchAdminRoute } from '@/lib/admin/routes'
import { useAdminT } from '@/lib/admin/translations'

// The browser tab's title in the admin's language, e.g. "בתי עסק | GoLandly Admin". The
// server-rendered titles (the layouts' metadata) are English and static, so this sets
// the title after them, on every page change and every language switch.
export const ADMIN_TITLE_SUFFIX = 'GoLandly Admin'

export function adminDocumentTitle(route: (label: string) => string, pathname: string): string {
  const match = matchAdminRoute(pathname)
  return match ? `${route(match.title)} | ${ADMIN_TITLE_SUFFIX}` : ADMIN_TITLE_SUFFIX
}

export default function AdminDocumentTitle() {
  const { route, locale } = useAdminT()
  const pathname = usePathname()
  useEffect(() => {
    const title = adminDocumentTitle(route, pathname)
    document.title = title
    // Next writes its own (English) title just after navigation; set ours again once it has.
    const frame = requestAnimationFrame(() => {
      document.title = title
    })
    const timer = window.setTimeout(() => {
      document.title = title
    }, 250)
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, pathname])
  return null
}
