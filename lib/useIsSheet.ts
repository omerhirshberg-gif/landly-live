'use client'

import { useSyncExternalStore } from 'react'

const SHEET_QUERY = '(max-width: 767px)'

/** Phones (under 768px) get a bottom sheet where wider windows get a popover. */
export function useIsSheet(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(SHEET_QUERY)
      media.addEventListener('change', onChange)
      return () => media.removeEventListener('change', onChange)
    },
    () => window.matchMedia(SHEET_QUERY).matches,
    () => false
  )
}
