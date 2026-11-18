import { useSyncExternalStore } from 'react'
import { AppState } from 'react-native'

// Whether the app is in the foreground, from one AppState subscription shared
// by every caller (each autoplaying carousel used to open its own).
const listeners = new Set<() => void>()
let active = AppState.currentState === 'active'
let subscription: { remove: () => void } | null = null

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (!subscription) {
    active = AppState.currentState === 'active'
    subscription = AppState.addEventListener('change', (state) => {
      const next = state === 'active'
      if (next === active) return
      active = next
      listeners.forEach((l) => l())
    })
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && subscription) {
      subscription.remove()
      subscription = null
    }
  }
}

const getSnapshot = () => active

export function useAppActive(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
