'use client'

import { useEffect, useState } from 'react'

// Trigger band starts right below the fixed navbar (64px = its h-16 height)
// and ends 60% down the viewport — a section counts as "active" once its top
// scrolls into that band, not merely once any pixel of it is visible.
const ROOT_MARGIN = '-64px 0px -60% 0px'

export function useScrollSpy(sectionIds: readonly string[], enabled: boolean): string | null {
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) {
      setActiveId(null)
      return
    }

    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null)

    if (elements.length === 0) {
      setActiveId(null)
      return
    }

    const intersecting = new Set<string>()

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) intersecting.add(entry.target.id)
          else intersecting.delete(entry.target.id)
        }
        // Prefer the section furthest down the page among those currently
        // crossing the trigger band, so simultaneous overlaps resolve to
        // whichever one the user has actually scrolled to.
        const active = sectionIds.filter((id) => intersecting.has(id)).pop() ?? null
        setActiveId(active)
      },
      { rootMargin: ROOT_MARGIN, threshold: 0 }
    )

    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [sectionIds, enabled])

  return activeId
}
