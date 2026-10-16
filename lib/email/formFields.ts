import 'server-only'

// Input cleaning shared by the public contact forms (/api/support,
// /api/business/inquiry) before their fields reach an email.

// Same shape the browser's type="email" accepts, minus anything that could
// break the reply-to header.
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]+$/

export function isValidEmail(value: string, maxLength = 254): boolean {
  return value.length <= maxLength && EMAIL_RE.test(value)
}

/** One line: control characters (incl. CR/LF) become spaces, whitespace collapses. */
export function singleLine(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Free text: keeps line breaks (at most one blank line in a row), drops other control characters. */
export function multiLine(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
