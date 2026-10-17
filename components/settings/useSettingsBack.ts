'use client'

import { usePathname, useRouter } from 'next/navigation'
import { previousPath, willReplace } from '@/lib/navigation/previousPath'
import { settingsBackAction, settingsParent } from '@/lib/navigation/settingsBack'

// Back for the settings pages (the header's button, the swipe, and Delete
// Account's Cancel and Done): it climbs the settings hierarchy
// (lib/navigation/settingsBack.ts), using the browser's back when the parent
// is the page below this one in history and replacing this page with the
// parent otherwise. `parent` overrides the hierarchy for a page outside
// /settings that was opened from it (BackToSettings.tsx: Support, Terms,
// Privacy).
export function useSettingsBack(parent?: string): () => void {
  const router = useRouter()
  const pathname = usePathname()
  return () => {
    const action = settingsBackAction(parent ?? settingsParent(pathname ?? ''), previousPath())
    if (action.kind === 'back') router.back()
    else if (action.kind === 'replace') {
      willReplace()
      router.replace(action.href)
    } else router.push(action.href)
  }
}
