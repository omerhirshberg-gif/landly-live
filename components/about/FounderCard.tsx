'use client'

import type { Founder } from '@/lib/about/founders'
import { useLang } from '@/lib/i18n/useLang'

// One co-founder on the About page, as an editorial card: a brand accent bar
// along the top, a 128px round portrait (a soft slate monogram until there's
// a photo), the name, the role as a quiet tracked-caps subtitle (Hebrew has
// no capitals and isn't letter-spaced, so it reads plain), the bio and, when
// there is one, a LinkedIn button. The portrait box is a fixed 128px, so a
// photo dropped in later doesn't move anything; the card fills its grid row,
// so both cards in a row match in height whatever their bios' length, and
// the text column stretches with it so the LinkedIn button sits at its foot
// (mt-auto): side by side, both buttons share one baseline. The card lifts
// on hover with a real pointer.
export default function FounderCard({ founder }: { founder: Founder }) {
  const { t } = useLang()
  const name = t(founder.nameKey)

  return (
    <article
      aria-labelledby={`founder-${founder.id}`}
      className="relative flex h-full flex-col items-center overflow-hidden text-center sm:flex-row sm:items-start sm:text-start gap-5 bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/80 shadow-sm transition-all duration-200 before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:from-brand before:to-brandGradientStart rtl:before:bg-gradient-to-l [@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:shadow-md motion-reduce:transition-none motion-reduce:[@media(hover:hover)]:hover:translate-y-0"
    >
      <div className="h-32 w-32 flex-shrink-0 overflow-hidden rounded-full border border-line shadow-[0_8px_20px_-8px_rgba(0,56,184,.45)]">
        {founder.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={founder.photo} alt={`${name} - ${t(founder.roleKey)}`} width={128} height={128} className="h-full w-full object-cover" />
        ) : (
          <span aria-hidden="true" className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 font-display text-4xl font-bold tracking-wider text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,.9)]">
            {founder.initials}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col self-stretch">
        <h3 id={`founder-${founder.id}`} className="font-display text-xl font-extrabold text-ink">{name}</h3>
        <p className="mt-1.5 mb-3 text-xs sm:text-sm font-semibold uppercase tracking-[0.18em] rtl:tracking-normal text-brand">{t(founder.roleKey)}</p>
        <p className="text-[15px] leading-relaxed text-body">{t(founder.bioKey)}</p>
        {founder.linkedin && (
          <div className="mt-auto pt-6">
            <a
              href={founder.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t('about_linkedin_label').replace('{name}', name)}
              className="relative inline-flex min-h-[38px] items-center gap-2 rounded-full border border-[#0A66C2]/20 bg-[#0A66C2]/[0.06] px-4 py-2 text-sm font-bold leading-none text-[#0A66C2] before:absolute before:inset-x-0 before:-inset-y-[3px] before:content-[''] [-webkit-tap-highlight-color:transparent] transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out [@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:hover:border-[#0A66C2]/40 [@media(hover:hover)]:hover:bg-[#0A66C2]/10 [@media(hover:hover)]:hover:shadow-[0_6px_16px_-8px_rgba(10,102,194,.5)] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A66C2] motion-reduce:transition-none motion-reduce:[@media(hover:hover)]:hover:translate-y-0 motion-reduce:active:scale-100"
            >
              <i className="fa-brands fa-linkedin text-base leading-none" aria-hidden="true"></i>
              <span>LinkedIn</span>
            </a>
          </div>
        )}
      </div>
    </article>
  )
}
