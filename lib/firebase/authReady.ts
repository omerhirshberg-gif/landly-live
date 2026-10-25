// AuthProvider's wait for Firebase Auth's first answer, kept apart from React
// so it can be tested with fake timers. `subscribe` is onAuthStateChanged
// bound to the app's auth. Every answer goes to onUser; onReady fires once,
// at the first answer or, with a timeout, when it runs out first (the page
// then carries on as a guest, and a later answer still arrives in onUser).
export function watchAuthState<U>(
  subscribe: (next: (user: U | null) => void) => () => void,
  handlers: { onUser: (user: U | null) => void; onReady: () => void },
  timeoutMs?: number,
): () => void {
  let ready = false
  const markReady = () => {
    if (ready) return
    ready = true
    handlers.onReady()
  }
  const timer = timeoutMs === undefined ? undefined : setTimeout(markReady, timeoutMs)
  const unsubscribe = subscribe((user) => {
    clearTimeout(timer)
    handlers.onUser(user)
    markReady()
  })
  return () => {
    clearTimeout(timer)
    unsubscribe()
  }
}
