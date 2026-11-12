'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { usePerksUrlState } from './usePerksUrlState'

type PerksUrlState = ReturnType<typeof usePerksUrlState>
const PerksUrlStateContext = createContext<PerksUrlState | null>(null)

// /categories holds its search, sort and filter state in the URL once, here,
// so the persistent search bar (in the page shell) and the results below it
// read and write the same thing. Needs a <Suspense> boundary above it
// (useSearchParams). Anywhere else there is no provider, and the bar navigates.
export function PerksUrlStateProvider({ children }: { children: ReactNode }) {
  const state = usePerksUrlState()
  return <PerksUrlStateContext.Provider value={state}>{children}</PerksUrlStateContext.Provider>
}

export function usePerksUrlContext(): PerksUrlState | null {
  return useContext(PerksUrlStateContext)
}
