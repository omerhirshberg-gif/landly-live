// Whether this browser had a signed-in member last time, so the home page
// knows what to show before Firebase Auth answers. The server can't know who
// is signed in, so app/page.tsx sends the guest landing and the member shell
// together (components/home/HomePage.tsx); MEMBER_HINT_SCRIPT, inline in the
// root layout's <head>, runs before the first paint and marks <html> for a
// returning member, and globals.css hides whichever one doesn't apply. A
// guest -- or any browser where the script or storage fails -- gets the full
// landing without waiting for JavaScript. AuthProvider keeps the flag current.

export const MEMBER_HINT_KEY = 'landly_member'
export const MEMBER_HINT_CLASS = 'member-hint'

/** Inline in <head>; plain ES5, no imports, never throws. */
export const MEMBER_HINT_SCRIPT = `try{if(localStorage.getItem('${MEMBER_HINT_KEY}')==='1')document.documentElement.classList.add('${MEMBER_HINT_CLASS}')}catch(e){}`

type HintStore = Pick<Storage, 'setItem' | 'removeItem'>

const defaultStore = (): HintStore | null => (typeof window === 'undefined' ? null : window.localStorage)

/** Records whether a member is signed in on this browser; storage failures are ignored. */
export function rememberMemberHint(signedIn: boolean, store: () => HintStore | null = defaultStore): void {
  try {
    const storage = store()
    if (!storage) return
    if (signedIn) storage.setItem(MEMBER_HINT_KEY, '1')
    else storage.removeItem(MEMBER_HINT_KEY)
  } catch {
    // Private mode or blocked storage: the next visit simply shows the guest landing first.
  }
}
