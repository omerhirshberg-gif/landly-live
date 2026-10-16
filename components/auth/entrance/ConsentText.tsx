import { CONSENT_PATHS, consentParts } from '@/lib/legal/consentText'
import type { TranslationKey } from '@/lib/i18n/translations'

// A consent sentence with its {terms} / {privacy} placeholders as links.
// They open in a new tab so a half-filled sign-up form isn't lost.
export default function ConsentText({ template, t }: { template: string; t: (key: TranslationKey) => string }) {
  return (
    <>
      {consentParts(template).map((part, i) =>
        'link' in part ? (
          <a
            key={i}
            href={CONSENT_PATHS[part.link]}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-brand underline-offset-2 hover:underline"
          >
            {t(part.link === 'terms' ? 'legal_terms_link' : 'legal_privacy_link')}
          </a>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </>
  )
}
