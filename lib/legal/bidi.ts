// Email addresses inside legal text keep their left-to-right order in Hebrew.
// The website wraps them in <bdi>; native text can't nest an isolate element,
// so it brackets them with the Unicode isolate marks instead.

const EMAIL = /([\w.+-]+@[\w-]+(?:\.[\w-]+)+)/

/** Splits text into plain pieces and email addresses. */
export function splitEmails(text: string): { text: string; ltr: boolean }[] {
  return text
    .split(EMAIL)
    .filter(Boolean)
    .map((piece) => ({ text: piece, ltr: EMAIL.test(piece) }))
}

const FSI = '⁨' // FIRST STRONG ISOLATE
const PDI = '⁩' // POP DIRECTIONAL ISOLATE

/** Brackets a left-to-right token with isolate marks. */
export const isolate = (token: string) => `${FSI}${token}${PDI}`

/** Text with every email address isolated, for native right-to-left screens. */
export function isolateEmails(text: string): string {
  return splitEmails(text)
    .map((piece) => (piece.ltr ? isolate(piece.text) : piece.text))
    .join('')
}
