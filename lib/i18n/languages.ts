import { Lang } from './translations'

// Single source of truth for the 5 supported languages — shared by the navbar
// switcher and the profile language selector so they can't drift apart.
export const LANGUAGES: { code: Lang; flag: string; label: string }[] = [
  { code: 'en', flag: '🇺🇸', label: 'English' },
  { code: 'ru', flag: '🇷🇺', label: 'Русский' },
  { code: 'es', flag: '🇪🇸', label: 'Español' },
  { code: 'fr', flag: '🇫🇷', label: 'Français' },
  { code: 'he', flag: '🇮🇱', label: 'עברית' },
]
