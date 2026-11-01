'use client'

import { Backpack, Compass, GraduationCap, House, PlaneLanding, ShieldCheck, type LucideIcon } from 'lucide-react'
import type { TranslationKey } from '@/lib/i18n/translations'
import { useLang } from '@/lib/i18n/useLang'
import { LANDING_COLUMN } from '@/components/landing/landingColumn'

// Who Landly is for, as a Bento grid of soft pastel cards. The two wide cards
// (`wide`) open and close it, so six cards fill both rows on a desktop and
// four on a phone, with no hole. Informational: nothing here is a link or
// reacts to a pointer.
const AUDIENCES: readonly { icon: LucideIcon; titleKey: TranslationKey; descKey: TranslationKey; tint: string; ink: string; wide?: boolean }[] = [
  { icon: PlaneLanding, titleKey: 'landing_aud_olim', descKey: 'landing_aud_olim_desc', tint: 'from-blue-50/40 to-indigo-50/20', ink: 'text-blue-700', wide: true },
  { icon: ShieldCheck, titleKey: 'landing_aud_soldiers', descKey: 'landing_aud_soldiers_desc', tint: 'from-emerald-50/40 to-teal-50/20', ink: 'text-emerald-700' },
  { icon: GraduationCap, titleKey: 'landing_aud_students', descKey: 'landing_aud_students_desc', tint: 'from-violet-50/40 to-purple-50/20', ink: 'text-violet-700' },
  { icon: House, titleKey: 'landing_aud_returnees', descKey: 'landing_aud_returnees_desc', tint: 'from-rose-50/40 to-pink-50/20', ink: 'text-rose-700' },
  { icon: Backpack, titleKey: 'landing_aud_programs', descKey: 'landing_aud_programs_desc', tint: 'from-amber-50/40 to-orange-50/20', ink: 'text-amber-700' },
  { icon: Compass, titleKey: 'landing_aud_travelers', descKey: 'landing_aud_travelers_desc', tint: 'from-cyan-50/40 to-sky-50/20', ink: 'text-cyan-700', wide: true },
]

export default function AudienceCards() {
  const { t } = useLang()

  return (
    <section aria-labelledby="landing-audiences-title" className="py-8 sm:py-10 lg:py-12">
      <div className={LANDING_COLUMN}>
        <h2 id="landing-audiences-title" className="mb-6 text-2xl font-black tracking-tight text-ink sm:text-3xl">{t('landing_aud_title')}</h2>
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {AUDIENCES.map(({ icon: Icon, titleKey, descKey, tint, ink, wide }) => (
            <li key={titleKey} className={wide ? 'col-span-2' : undefined}>
              <div className={`flex h-full flex-col rounded-3xl border border-slate-200/80 bg-gradient-to-br p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] sm:p-6 ${tint}`}>
                <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 ring-1 ring-slate-200/80">
                  <Icon aria-hidden="true" className={`h-5 w-5 ${ink}`} strokeWidth={1.75} />
                </span>
                <h3 className="text-base font-extrabold tracking-tight text-ink sm:text-lg">{t(titleKey)}</h3>
                <p className="mt-1 flex-1 text-sm leading-relaxed text-body">{t(descKey)}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
