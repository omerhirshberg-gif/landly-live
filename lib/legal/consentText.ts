// Splits a consent sentence such as "I agree to the {terms} and {privacy}"
// into plain text and link pieces, so web and native can each render the
// links their own way while the word order stays per-language (Hebrew puts
// the conjunction straight onto the second link: "את {terms} ו{privacy}").

export type ConsentLink = 'terms' | 'privacy'
export type ConsentPart = { text: string } | { link: ConsentLink }

export const CONSENT_PATHS: Record<ConsentLink, string> = { terms: '/terms', privacy: '/privacy' }

export function consentParts(template: string): ConsentPart[] {
  return template
    .split(/(\{terms\}|\{privacy\})/)
    .filter(Boolean)
    .map((piece) => (piece === '{terms}' ? { link: 'terms' } : piece === '{privacy}' ? { link: 'privacy' } : { text: piece }))
}
