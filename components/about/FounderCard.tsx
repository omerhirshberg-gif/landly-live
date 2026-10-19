'use client'

import type { Founder } from '@/lib/about/founders'
import { useLang } from '@/lib/i18n/useLang'

// One co-founder on the About page, as an editorial card: a brand accent bar
// along the top, a 96px rounded-square portrait (the initials on the brand
// gradient until there's a photo), the name, the role as a pill and the bio.
// The portrait box is a fixed 96px, so a photo dropped in later doesn't move
// anything; the card fills its grid row, so both cards in a row match in
// height whatever their bios' length. It lifts on hover with a real pointer.
export default function FounderCard({ founder }: { founder: Founder }) {
  const { t } = useLang()
  const name = t(founder.nameKey)

  return (
    <article
      aria-labelledby={`founder-${founder.id}`}
      className="relative flex h-full flex-col items-center overflow-hidden text-center sm:flex-row sm:items-start sm:text-start gap-5 bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/80 shadow-sm transition-all duration-200 before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:from-brand before:to-brandGradientStart rtl:before:bg-gradient-to-l [@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:shadow-md motion-reduce:transition-none motion-reduce:[@media(hover:hover)]:hover:translate-y-0"
    >
      <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-2xl shadow-[0_8px_20px_-8px_rgba(0,56,184,.45)]">
        {founder.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={founder.photo} alt={name} width={96} height={96} className="h-full w-full object-cover" />
        ) : (
          <span aria-hidden="true" className="ds-avatar-fallback flex h-full w-full items-center justify-center font-display text-3xl font-extrabold tracking-tight text-white">
            {founder.initials}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 id={`founder-${founder.id}`} className="font-display text-xl font-extrabold text-ink">{name}</h3>
        <p className="mt-2 inline-flex items-center rounded-full border border-brand/15 bg-brandTint px-2.5 py-0.5 text-xs font-bold text-brand">{t(founder.roleKey)}</p>
        <p className="mt-3 text-[15px] leading-relaxed text-body">{t(founder.bioKey)}</p>
      </div>
    </article>
  )
}
