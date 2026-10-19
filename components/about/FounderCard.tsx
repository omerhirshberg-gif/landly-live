'use client'

import type { Founder } from '@/lib/about/founders'
import { useLang } from '@/lib/i18n/useLang'

// One co-founder on the About page: photo (or initials until there's one),
// name, role and bio. The avatar box is a fixed 96px, so a photo dropped in
// later doesn't move anything; the card fills its grid row, so both cards in
// a row match in height whatever their bios' length.
export default function FounderCard({ founder }: { founder: Founder }) {
  const { t } = useLang()
  const name = t(founder.nameKey)

  return (
    <article
      aria-labelledby={`founder-${founder.id}`}
      className="flex h-full flex-col items-center text-center sm:flex-row sm:items-start sm:text-start gap-5 bg-white/95 backdrop-blur-md rounded-2xl p-6 sm:p-8 border border-line shadow-sm transition-all [@media(hover:hover)]:hover:shadow-md motion-reduce:transition-none"
    >
      <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-full ring-4 ring-brandTint">
        {founder.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={founder.photo} alt={name} width={96} height={96} className="h-full w-full object-cover" />
        ) : (
          <span aria-hidden="true" className="ds-avatar-fallback flex h-full w-full items-center justify-center text-2xl font-black text-white">
            {founder.initials}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 id={`founder-${founder.id}`} className="text-xl font-black text-[#0B1B3D]">{name}</h3>
        <p className="mt-0.5 text-sm font-bold text-brand">{t(founder.roleKey)}</p>
        <p className="mt-3 text-[15px] leading-relaxed text-[#475569]">{t(founder.bioKey)}</p>
      </div>
    </article>
  )
}
