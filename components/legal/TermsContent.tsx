'use client'

import { useLang } from '@/lib/i18n/useLang'
import { TranslationKey } from '@/lib/i18n/translations'

// The sections formerly shown in the home-page TermsModal, now on /terms.
// Client-rendered through useLang so it follows the member's language (and
// RTL for Hebrew); the server HTML is the English default.
const SECTIONS: { heading: TranslationKey; body: (TranslationKey | [TranslationKey, TranslationKey])[] }[] = [
  { heading: 'terms_h1', body: ['terms_p1'] },
  { heading: 'terms_h2', body: [['terms_p2a_label', 'terms_p2a'], ['terms_p2b_label', 'terms_p2b']] },
  { heading: 'terms_h3', body: ['terms_p3'] },
  { heading: 'terms_h6', body: ['terms_p6'] },
  { heading: 'terms_h7', body: ['terms_p7'] },
]

export default function TermsContent() {
  const { t, isRtl } = useLang()

  return (
    <article dir={isRtl ? 'rtl' : 'ltr'} className="text-[#475569] text-[15px] leading-relaxed">
      <h1 className="text-2xl sm:text-3xl font-black text-[#0B1B3D] mb-2" style={{ letterSpacing: '-0.02em' }}>{t('terms_title')}</h1>
      <p className="text-sm text-slate-500 mb-8">
        <strong className="font-semibold">{t('terms_updated_label')}</strong> <span>{t('terms_updated_date')}</span>
      </p>
      <div className="space-y-7">
        {SECTIONS.map((s) => (
          <section key={s.heading}>
            <h2 className="font-bold text-[#0B1B3D] text-lg mb-2">{t(s.heading)}</h2>
            {s.body.map((p) =>
              Array.isArray(p) ? (
                <p key={p[1]} className="mt-2 first:mt-0"><strong className="text-[#0B1B3D]">{t(p[0])}</strong> <span>{t(p[1])}</span></p>
              ) : (
                <p key={p}>{t(p)}</p>
              )
            )}
          </section>
        ))}
      </div>
    </article>
  )
}
