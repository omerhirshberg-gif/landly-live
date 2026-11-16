// Input cleaning shared by the public contact forms (/api/support,
// /api/business/inquiry) before their fields reach an email, and by the /join
// form (lib/prelaunch/validation.ts), which also runs in the browser.

// The shape check is shared product-wide (lib/validation/email.ts); it also
// rejects anything that could break a reply-to header.
export { isValidEmail } from '@/lib/validation/email'

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
