'use client'

import Link from 'next/link'
import { useLang } from '@/lib/i18n/useLang'
import { TranslationKey } from '@/lib/i18n/translations'
import { splitEmails } from '@/lib/legal/bidi'
import { TERMS_SECTIONS } from '@/lib/legal/termsSections'

// The Terms of Service on /terms, from the sections the app's Terms screen
// also renders (lib/legal/termsSections.ts). Client-rendered through useLang
// so it follows the member's language (and RTL for Hebrew); the server HTML
// is the English default. A section's link is website-only: the app's text
// names the same Settings path instead.
const LINKS: Partial<Record<TranslationKey, { href: string; label: TranslationKey }>> = {
  terms_h4: { href: '/settings/delete-account', label: 'terms_p4_link' },
}

// Email addresses keep their left-to-right order inside Hebrew sentences.
function Text({ value }: { value: string }) {
  return <>{splitEmails(value).map((piece, i) => (piece.ltr ? <bdi key={i}>{piece.text}</bdi> : piece.text))}</>
}

export default function TermsContent() {
  const { t, isRtl } = useLang()

  return (
    <article dir={isRtl ? 'rtl' : 'ltr'} className="text-[#475569] text-[15px] leading-relaxed">
      <h1 className="text-2xl sm:text-3xl font-black text-[#0B1B3D] mb-2" style={{ letterSpacing: '-0.02em' }}>{t('terms_title')}</h1>
      <p className="text-sm text-slate-500 mb-8">
        <strong className="font-semibold">{t('terms_updated_label')}</strong> <span>{t('terms_updated_date')}</span>
      </p>
      <div className="space-y-7">
        {TERMS_SECTIONS.map((s) => {
          const link = LINKS[s.heading]
          return (
            <section key={s.heading}>
              <h2 className="font-bold text-[#0B1B3D] text-lg mb-2">{t(s.heading)}</h2>
              {s.body.map((p) =>
                Array.isArray(p) ? (
                  <p key={p[1]} className="mt-2 first:mt-0"><strong className="text-[#0B1B3D]">{t(p[0])}</strong> <span><Text value={t(p[1])} /></span></p>
                ) : (
                  <p key={p}><Text value={t(p)} /></p>
                )
              )}
              {link && (
                <p className="mt-3">
                  <Link href={link.href} className="inline-flex min-h-[44px] items-center gap-2 font-semibold text-[#0038B8] underline-offset-4 hover:underline">
                    {t(link.label)}
                    <i className="fa-solid fa-arrow-right text-xs rtl:-scale-x-100" aria-hidden="true"></i>
                  </Link>
                </p>
              )}
            </section>
          )
        })}
      </div>
    </article>
  )
}
