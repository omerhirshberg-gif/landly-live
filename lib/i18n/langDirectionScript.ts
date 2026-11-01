import { RTL_LANGS } from './translations'

// The server always sends English, left to right, and LangProvider picks up a
// saved language after hydration. Inline in <head>, this applies a returning
// reader's direction before the first paint, so a Hebrew page never lays out
// left to right first; the words follow once React runs. First-time visitors
// stay on English.
const STORAGE_KEY = 'landly_lang'

/** Inline in <head>; plain ES5, no imports at runtime, never throws. */
export const LANG_DIRECTION_SCRIPT = `try{(function(){var l=localStorage.getItem('${STORAGE_KEY}');if(${JSON.stringify([...RTL_LANGS])}.indexOf(l)>-1){var h=document.documentElement;h.dir='rtl';h.lang=l;h.classList.add('is-rtl')}})()}catch(e){}`
