import { createContext, useContext, useState, type ReactNode } from 'react'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

// Coordinates the launch sequence between the splash overlay and the auth
// screen underneath it:
//  'splash'   — splash is showing; the login screen reports where its hero sits
//              (or the app lock where its header lockup sits)
//  'settling' — the splash logo glides to that spot while the screen rises in
//  'done'     — splash is gone; the screen shows its own logo
type Phase = 'splash' | 'settling' | 'done'

const EntranceContext = createContext<{
  phase: Phase
  setPhase: (phase: Phase) => void
  heroRect: Rect | null
  setHeroRect: (rect: Rect) => void
  lockRect: Rect | null
  setLockRect: (rect: Rect) => void
} | null>(null)

export function EntranceProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>('splash')
  const [heroRect, setHeroRect] = useState<Rect | null>(null)
  const [lockRect, setLockRect] = useState<Rect | null>(null)
  return (
    <EntranceContext.Provider value={{ phase, setPhase, heroRect, setHeroRect, lockRect, setLockRect }}>{children}</EntranceContext.Provider>
  )
}

export function useEntrance() {
  const ctx = useContext(EntranceContext)
  if (!ctx) throw new Error('useEntrance must be used within an EntranceProvider')
  return ctx
}

// One spring for everything that moves in the entrance (shared with the web login page).
export { ENTRANCE_SPRING } from '@shared/brand/entranceTimeline'
