import { Lang } from './translations'

// Single source of truth for the 5 supported languages — shared by the navbar
// switcher and the profile language selector so they can't drift apart.
export const LANGUAGES: { code: Lang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Русский' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'he', label: 'עברית' },
]
