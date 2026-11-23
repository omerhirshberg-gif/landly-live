// One place for "this row does not honour vouchers": Raayonit puts a notice in a row's name or detail pane ("האתר לא מכבד תווים עד להודעה חדשה",
// "המלון סגור לרגל שיפוצים", "האתר סגור באופן זמני", "סגור זמנית"), and a few properties are known to be closed without any notice. The scraper's
// listing grouping (raayonitListing.ts), the daily diff (raayonitLiveDiff.ts), the branch sanitizer (raayonitSanitize.ts) and the canonical
// catalogue (raayonitCanonicalCatalog.ts) all read the rules below, so they can never disagree. Pure; shared by the website, the app and the scripts.

/** The wording Raayonit uses for a site, hotel or branch that does not honour vouchers for now. */
export const CLOSURE_PATTERN = /(?:ה?אתר\s+)?(?:לא מכבד תווים|סגור באופן זמני|סגור זמנית)|(?:ה?מלון|ה?אתר)\s+סגור|סגור לרגל שיפוצים|עד להודעה חדשה|עמכם הסליחה|סגירה זמנית/

/** True when a title, address or detail pane carries one of Raayonit's closure notices. */
export const isClosedText = (text: string): boolean => CLOSURE_PATTERN.test(text)

/**
 * Properties excluded by name because the business is not honouring vouchers, with why. A row is matched on its exact title
 * (whitespace trimmed), so a sibling property (Leonardo Plaza Jerusalem, Leonardo Boutique Jerusalem) is never caught by accident.
 */
export const NAMED_CLOSURES: ReadonlyArray<{ title: string; reason: string }> = [
  { title: 'לאונרדו ירושלים', reason: 'The hotel-section row carries no notice on Raayonit\'s page, but the same property\'s spa row says "האתר סגור באופן זמני" (checked on the live page, 2026-11-23).' },
  { title: 'לאונרדו אין ים המלח', reason: 'Closed for renovation: its row says "המלון סגור לרגל שיפוצים".' },
]
export const isNamedClosure = (title: string): boolean => NAMED_CLOSURES.some((c) => c.title === title.trim())
