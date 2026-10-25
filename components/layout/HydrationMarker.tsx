'use client'

import { useEffect } from 'react'
import { HYDRATED_ATTRIBUTE } from '@/lib/debug/clientErrorScript'

// Marks <html> once React is running in the browser, for ?debug=1's status
// bar (lib/debug/clientErrorScript.ts): a page whose scripts never ran stays
// unmarked, which tells a dead page apart from a slow one.
export default function HydrationMarker() {
  useEffect(() => {
    document.documentElement.setAttribute(HYDRATED_ATTRIBUTE, 'true')
  }, [])
  return null
}
