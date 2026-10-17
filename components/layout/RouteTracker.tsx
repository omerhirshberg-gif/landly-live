'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { recordPath } from '@/lib/navigation/previousPath'

// Records every route change for lib/navigation/previousPath.ts. Renders nothing.
export default function RouteTracker() {
  const pathname = usePathname()
  useEffect(() => {
    if (pathname) recordPath(pathname)
  }, [pathname])
  return null
}
