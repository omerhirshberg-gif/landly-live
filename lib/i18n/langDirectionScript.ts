import { LANGUAGES } from './languages'
import { RTL_LANGS } from './translations'

// The server always sends English, left to right, and LangProvider picks up a
// saved language after hydration. Inline in <head>, this applies a returning
// reader's language attribute and direction before the first paint, so a Hebrew
// page never lays out left to right first, and a Russian, French or Spanish one
// is announced and hyphenated in its own language from the start; the words
// follow once React runs. First-time visitors stay on English.
const STORAGE_KEY = 'landly_lang'

/** Inline in <head>; plain ES5, no imports at runtime, never throws. */
export const LANG_DIRECTION_SCRIPT = `try{(function(){var l=localStorage.getItem('${STORAGE_KEY}');if(${JSON.stringify(LANGUAGES.map((language) => language.code))}.indexOf(l)>-1){var h=document.documentElement;h.lang=l;if(${JSON.stringify([...RTL_LANGS])}.indexOf(l)>-1){h.dir='rtl';h.classList.add('is-rtl')}}})()}catch(e){}`
