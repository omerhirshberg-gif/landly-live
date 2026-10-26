'use client'

import type { CSSProperties } from 'react'
import Link from 'next/link'
import { CalendarCheck, Check, GraduationCap, Luggage, PlaneLanding, ShieldCheck, Users, type LucideIcon } from 'lucide-react'
import Reveal from '@/components/ui/Reveal'
import { CUSTOMER_TYPES, OTHER_CUSTOMER_TYPE, type CustomerType } from '@/lib/customerTypes'
import { useLang } from '@/lib/i18n/useLang'
import type { TranslationKey } from '@/lib/i18n/translations'

type Segment = Exclude<CustomerType, typeof OTHER_CUSTOMER_TYPE>

// Each member type's icon and one line on what Landly gives it. "Other" is
// left out: it's a catch-all at sign-up, not an audience.
const SEGMENT_DETAILS: Record<Segment, { icon: LucideIcon; descKey: TranslationKey }> = {
  new_immigrant: { icon: PlaneLanding, descKey: 'olim_seg_new_immigrant_desc' },
  lone_soldier: { icon: ShieldCheck, descKey: 'olim_seg_lone_soldier_desc' },
  student: { icon: GraduationCap, descKey: 'olim_seg_student_desc' },
  taglit: { icon: Users, descKey: 'olim_seg_taglit_desc' },
  long_term_program: { icon: CalendarCheck, descKey: 'olim_seg_long_term_program_desc' },
  traveler: { icon: Luggage, descKey: 'olim_seg_traveler_desc' },
}

// "Who Landly is for" on /olim: the real member types picked at sign-up
// (lib/customerTypes.ts), each in its own accent colour. For known guests
// (`joinable`) every card leads to sign-up; for members, and while auth
// loads, they're information, and a member's own type is marked "You" with
// a ring in its colour. Cards lift on hover
// (real pointer only) and rise in as they're reached.
export default function SegmentCards({ member, joinable, currentType }: { member: boolean; joinable: boolean; currentType: string | null }) {
  const { t } = useLang()
  const segments = CUSTOMER_TYPES.filter((c): c is (typeof CUSTOMER_TYPES)[number] & { value: Segment } => c.value !== OTHER_CUSTOMER_TYPE)

  return (
    <section aria-labelledby="olim-segments-title" className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
      <div className="text-center mb-8 sm:mb-10">
        <h2 id="olim-segments-title" className="text-xl sm:text-2xl font-bold tracking-tight text-ink">{t('olim_segments_title')}</h2>
        <p className="mt-3 text-copy sm:text-base text-body">{t('olim_segments_sub')}</p>
      </div>
      <ul className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {segments.map((segment, i) => {
          const { icon: Icon, descKey } = SEGMENT_DETAILS[segment.value]
          const isYou = member && currentType === segment.value
          // Alpha tints as 8-digit hex, which every supported browser (older iOS Safari too) reads.
          const accent = { '--seg': segment.color, '--seg-tint': `${segment.color}1F`, '--seg-line': `${segment.color}59`, '--seg-ring': `${segment.color}33` } as CSSProperties
          const body = (
            <>
              <span className="flex items-start justify-between gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-[color:var(--seg-ring)] bg-[color:var(--seg-tint)] text-[color:var(--seg)]"
                >
                  <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
                </span>
                {isYou && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--seg)] px-2.5 py-1 text-micro font-bold text-white">
                    <Check aria-hidden="true" className="h-3 w-3" strokeWidth={2.5} />
                    {t('olim_segment_you')}
                  </span>
                )}
              </span>
              <span className="mt-4 block text-lg font-bold text-ink">{t(segment.labelKey)}</span>
              <span className="mt-1.5 block text-copy leading-relaxed text-body">{t(descKey)}</span>
            </>
          )
          const card = `relative flex h-full flex-col overflow-hidden rounded-2xl border bg-white p-5 sm:p-6 text-start shadow-sm before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-[color:var(--seg)] ${
            isYou ? 'border-[color:var(--seg-line)] ring-2 ring-[color:var(--seg-ring)]' : 'border-slate-200/80'
          }`
          return (
            <li key={segment.value} className="min-w-0" style={accent}>
              <Reveal delay={(i % 3) * 60} className="h-full">
                {!joinable ? (
                  <div className={card}>{body}</div>
                ) : (
                  <Link
                    href="/signup"
                    className={`${card} [-webkit-tap-highlight-color:transparent] transition-[transform,box-shadow,border-color] duration-200 ease-out [@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:border-[color:var(--seg-line)] [@media(hover:hover)]:hover:shadow-md active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none motion-reduce:[@media(hover:hover)]:hover:translate-y-0 motion-reduce:active:scale-100`}
                  >
                    {body}
                  </Link>
                )}
              </Reveal>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
