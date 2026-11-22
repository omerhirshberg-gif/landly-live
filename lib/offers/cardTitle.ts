// A card's title, shortened for display only (the stored title is never changed). A Raayonit "Super Tav" card already says
// what it is by its picture and badges, so a trailing "— Super Tav" or a leading "תו על —" (hyphen, en or em dash) only costs
// the title a line and is cut mid-word. Other offers keep their title whole.
const LABEL = '(?:super\\s*tav|supertav|תו\\s*על)'
const SUFFIX = new RegExp(`\\s*[-\\u2013\\u2014]\\s*${LABEL}\\s*$`, 'i')
const PREFIX = new RegExp(`^\\s*${LABEL}\\s*[-\\u2013\\u2014]\\s*`, 'i')

export function cardTitle(title: string, opts: { raayonit?: boolean } = {}): string {
  if (!opts.raayonit || !title) return title
  const stripped = title.replace(SUFFIX, '').replace(PREFIX, '').trim()
  return stripped || title
}
