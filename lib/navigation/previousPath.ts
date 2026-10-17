// The in-app pages behind the current one, kept so a back button can tell
// whether the browser's own back would land where it should (settings
// sub-pages go back to their parent page, components/settings/
// SettingsPageShell.tsx). Fed by components/layout/RouteTracker.tsx on every
// route change: a browser back or forward (popstate) that returns to the page
// below pops it, a replace we announce with willReplace() swaps the top, and
// anything else is a push. Per tab and in memory only; a reload starts over.
const stack: string[] = []
const MAX_DEPTH = 50
let popping = false
let replacing = false

/** A browser back or forward is under way (the next recorded path came from history). */
export function notePopState() {
  popping = true
}

if (typeof window !== 'undefined') window.addEventListener('popstate', notePopState)

export function recordPath(path: string) {
  const top = stack[stack.length - 1]
  if (path !== top) {
    if (popping && stack[stack.length - 2] === path) stack.pop()
    else if (replacing && stack.length) stack[stack.length - 1] = path
    else stack.push(path)
    if (stack.length > MAX_DEPTH) stack.shift()
  }
  popping = false
  replacing = false
}

/** The in-app page the browser's back would return to, or null when there's none (opened directly). */
export function previousPath(): string | null {
  return stack[stack.length - 2] ?? null
}

/** Call right before router.replace(), so the replaced page isn't kept as one to go back to. */
export function willReplace() {
  replacing = true
}

/** Tests only. */
export function resetPathHistory() {
  stack.length = 0
  popping = false
  replacing = false
}
