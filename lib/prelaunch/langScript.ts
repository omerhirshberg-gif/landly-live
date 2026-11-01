import { LOCALIZED_LANGS, PRELAUNCH_PATHS, type PrelaunchLang } from './copy'

// The root layout always sends <html lang="en" dir="ltr">. Inline in each /join
// page, this sets the page's own language before the first paint. It also saves
// that language for a visitor who has none yet, so Terms and Privacy, which open
// in a new tab, read in the language they consented in.
//
// /join is English for every ad click, so it follows only a choice made in this
// page's switcher (JOIN_LANG_STORAGE_KEY), never a member's language for the rest
// of the site. Links to /join/he and the like are always honoured, and so is a
// ?lang= in the URL.
export const LANG_STORAGE_KEY = 'landly_lang'
export const JOIN_LANG_STORAGE_KEY = 'landly_join_lang'

/** Plain ES5, no imports at runtime, never throws. */
export function prelaunchLangScript(lang: PrelaunchLang): string {
  const rtl = lang === 'he'
  const followChoice = lang === 'en'
    ? `var c=localStorage.getItem('${JOIN_LANG_STORAGE_KEY}'),p=${JSON.stringify(Object.fromEntries(LOCALIZED_LANGS.map((code) => [code, PRELAUNCH_PATHS[code]])))};if(p[c]&&location.search.indexOf('lang=')<0){location.replace(p[c]+location.search);return}`
    : ''
  return `try{(function(){var h=document.documentElement;${followChoice}h.lang='${lang}';h.dir='${rtl ? 'rtl' : 'ltr'}';h.classList.${rtl ? 'add' : 'remove'}('is-rtl');if(!localStorage.getItem('${LANG_STORAGE_KEY}'))localStorage.setItem('${LANG_STORAGE_KEY}','${lang}')})()}catch(e){}`
}
