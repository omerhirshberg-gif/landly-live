'use client'

import { useState } from 'react'

/**
 * Whether the current `src` failed to load. A signed URL that expired fails
 * once; the next poll brings a new URL, and a new `src` is a fresh try.
 */
export function useFailedSrc(src: string | undefined) {
  const [failed, setFailed] = useState<string | null>(null)
  return { broken: !!src && failed === src, onError: () => setFailed(src ?? null) }
}
