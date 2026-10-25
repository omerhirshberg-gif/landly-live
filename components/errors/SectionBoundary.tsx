'use client'

import { catchError, type ErrorInfo } from 'next/error'

// Wraps one secondary section or floating widget (the home page's marketing
// sections, the layout's WhatsApp, cookie, passkey and accessibility
// widgets): if it throws while rendering, only that piece drops out and the
// rest of the page stays up. The error is logged with the section's name.
// The hero, navbar and footer stay outside it, so a failure there still
// reaches app/error.tsx. Render errors only: effects and handlers that throw
// aren't caught by any React boundary.
function SectionFallback({ name }: { name: string }, { error }: ErrorInfo) {
  console.error(`[section:${name}]`, error)
  return null
}

export default catchError(SectionFallback)
