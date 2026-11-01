import es from 'react-phone-number-input/locale/es'
import fr from 'react-phone-number-input/locale/fr'
import he from 'react-phone-number-input/locale/he'
import ru from 'react-phone-number-input/locale/ru'
import type { PrelaunchLang } from './copy'

// Country names for the phone picker. Read on the server and handed to the page
// as a prop, so each language's page carries only its own list. English is the
// picker's built-in.
const LABELS = { he, ru, fr, es }

export function countryLabels(lang: PrelaunchLang) {
  return lang === 'en' ? undefined : LABELS[lang]
}
