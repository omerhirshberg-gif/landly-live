import type { TranslationKey } from '@/lib/i18n/translations'

// The Terms of Service sections, as translation keys: the one list both the
// website (components/legal/TermsContent.tsx) and the app's native Terms
// screen (landly-mobile/src/app/settings/terms.tsx) render, so the two can't
// drift; tests/unit/nativeHelpLegal.test.ts checks the rendered website
// against it in every language. A pair is a bold label followed by its text.
// Section numbers are part of the heading strings (terms_h5 is "5. …").
export const TERMS_SECTIONS: { heading: TranslationKey; body: (TranslationKey | [TranslationKey, TranslationKey])[] }[] = [
  { heading: 'terms_h1', body: ['terms_p1'] },
  { heading: 'terms_h2', body: [['terms_p2a_label', 'terms_p2a'], ['terms_p2b_label', 'terms_p2b'], ['terms_p2c_label', 'terms_p2c']] },
  { heading: 'terms_h3', body: ['terms_p3', ['terms_p3b_label', 'terms_p3b'], ['terms_p3c_label', 'terms_p3c'], ['terms_p3d_label', 'terms_p3d']] },
  { heading: 'terms_h4', body: [['terms_p4a_label', 'terms_p4a'], ['terms_p4b_label', 'terms_p4b'], ['terms_p4c_label', 'terms_p4c']] },
  { heading: 'terms_h5', body: [['terms_p5a_label', 'terms_p5a'], ['terms_p5b_label', 'terms_p5b']] },
  { heading: 'terms_h6', body: ['terms_p6'] },
  { heading: 'terms_h7', body: ['terms_p7'] },
  { heading: 'terms_h8', body: ['terms_p8'] },
]
