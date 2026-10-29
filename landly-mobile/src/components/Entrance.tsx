import { createContext, useContext, useState, type ReactNode } from 'react'
import { useSharedValue, type SharedValue } from 'react-native-reanimated'

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

// Two shared values carry the hand-over on the UI thread, so nothing in it
// waits on a React render:
//  `glide`  — the splash glide's progress `p` (0 -> 1, SplashScreen.tsx). The
//            lock screen's hub, greeting and actions rise in off it, frame
//            for frame with the logo.
//  `landed` — 1 once the screen underneath shows its own logo and content:
//            set in the same UI-thread frame the glide lands (or as a
//            crossfade starts), and left at 1 for the rest of the session.
const EntranceContext = createContext<{
  phase: Phase
  setPhase: (phase: Phase) => void
  heroRect: Rect | null
  setHeroRect: (rect: Rect) => void
  lockRect: Rect | null
  setLockRect: (rect: Rect) => void
  glide: SharedValue<number>
  landed: SharedValue<number>
} | null>(null)

export function EntranceProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>('splash')
  const [heroRect, setHeroRect] = useState<Rect | null>(null)
  const [lockRect, setLockRect] = useState<Rect | null>(null)
  const glide = useSharedValue(0)
  const landed = useSharedValue(0)
  return (
    <EntranceContext.Provider value={{ phase, setPhase, heroRect, setHeroRect, lockRect, setLockRect, glide, landed }}>
      {children}
    </EntranceContext.Provider>
  )
}

export function useEntrance() {
  const ctx = useContext(EntranceContext)
  if (!ctx) throw new Error('useEntrance must be used within an EntranceProvider')
  return ctx
}

// One spring for everything that moves in the entrance (shared with the web login page).
export { ENTRANCE_SPRING } from '@shared/brand/entranceTimeline'
