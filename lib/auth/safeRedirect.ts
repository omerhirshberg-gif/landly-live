// Where /login and /signup send a member afterwards, from their ?redirect=
// parameter (e.g. the /olim mentor card's "Sign in" link). Only same-site
// paths are honoured, so the parameter can't be used to bounce someone to
// another site; anything else goes home.

export const DEFAULT_REDIRECT = '/'

export function safeRedirectPath(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_REDIRECT
  // One leading slash, then not a second slash or backslash (protocol-relative
  // URLs), and no control characters or whitespace browsers strip or bend.
  if (!/^\/(?![/\\])/.test(raw) || /[\u0000- \u007f\\]/.test(raw)) return DEFAULT_REDIRECT
  try {
    const url = new URL(raw, 'https://landly.invalid')
    if (url.origin !== 'https://landly.invalid') return DEFAULT_REDIRECT
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return DEFAULT_REDIRECT
  }
}

/** `path` with `?redirect=` attached, for links into /login and /signup. */
export function withRedirect(path: string, redirect: string): string {
  return `${path}?redirect=${encodeURIComponent(redirect)}`
}
