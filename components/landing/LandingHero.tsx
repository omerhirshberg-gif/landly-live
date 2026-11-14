'use client'

import { BadgePercent, QrCode, Users } from 'lucide-react'
import IsraelLifestyleCollage from '@/components/landing/IsraelLifestyleCollage'
import StoreButtons from '@/components/landing/StoreButtons'
import { useLang } from '@/lib/i18n/useLang'

// The guest landing's opening on a soft wash: one editorial stage, 1240px at
// most, so the copy and the photo gallery sit close instead of drifting to the
// screen's two edges. Phones stack the copy and way in over the gallery; from
// lg the copy takes the start column and the four-photo gallery the end
// column. The real deals have their own section right under it. The three
// value cards each carry a colour: an L-shaped corner bracket on the start
// edge (logical, so Hebrew mirrors it), the icon frame and the title.
const TILES = [
  { icon: BadgePercent, key: 'free', bracket: 'border-[#0038B8]', ink: 'text-[#0038B8]', frame: 'bg-[#0038B8]/10' },
  { icon: Users, key: 'who', bracket: 'border-[#0284C7]', ink: 'text-[#0284C7]', frame: 'bg-[#0284C7]/10' },
  { icon: QrCode, key: 'spots', bracket: 'border-[#059669]', ink: 'text-[#059669]', frame: 'bg-[#059669]/10' },
] as const

export default function LandingHero() {
  const { t } = useLang()

  return (
    <section id="hero" className="relative isolate overflow-x-clip below-header bg-gradient-to-b from-blue-50/60 via-white to-transparent">
      <div className="mx-auto grid w-full max-w-[1240px] items-center gap-8 px-4 pt-10 pb-12 text-center sm:px-6 sm:pt-14 sm:pb-14 lg:grid-cols-12 lg:gap-8 lg:px-8 lg:pt-16 lg:pb-16 lg:text-start xl:gap-10">
        <div className="flex flex-col items-center lg:col-span-6 lg:items-start">
          <p className="mb-5 inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3.5 py-1.5 text-meta font-bold leading-snug tracking-tight rtl:tracking-normal text-ink shadow-[0_1px_2px_rgba(15,23,42,0.06)] backdrop-blur-md">
            <span aria-hidden="true" className="relative flex h-2 w-2 flex-shrink-0">
              <span className="absolute inset-0 rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" />
              <span className="relative h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span>{t('landing_free_badge')}</span>
          </p>
          <h1 className="mb-4 text-4xl font-black leading-[1.1] tracking-tight text-ink sm:text-5xl lg:text-6xl">
            <span className="block text-balance">{t('landing_hero_title')}</span>
            <span className="block text-balance bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text pb-1 text-transparent">{t('landing_hero_accent')}</span>
          </h1>
          <p className="mb-6 max-w-xl text-base leading-relaxed text-body sm:text-lg">{t('landing_hero_sub')}</p>
          <ul className="mb-8 grid w-full max-w-xl grid-cols-1 gap-3.5 sm:max-w-none sm:grid-cols-3 sm:gap-4">
            {TILES.map(({ icon: Icon, key, bracket, ink, frame }) => (
              <li key={key} className="relative rounded-2xl border border-slate-200/80 bg-white p-4 text-start shadow-[0_8px_24px_-6px_rgba(15,23,42,0.08)] sm:p-5">
                <span aria-hidden="true" className={`pointer-events-none absolute start-0 top-0 h-10 w-10 rounded-ss-2xl border-s-[3px] border-t-[3px] ${bracket}`} />
                <span aria-hidden="true" className={`flex h-11 w-11 items-center justify-center rounded-xl ${frame}`}>
                  <Icon className={`h-[22px] w-[22px] ${ink}`} strokeWidth={1.75} />
                </span>
                <span className={`mt-3 block text-[15px] font-extrabold leading-snug text-balance sm:text-[16px] ${ink}`}>{t(`landing_tile_${key}_title`)}</span>
                <span className="mt-1.5 block text-[13px] leading-relaxed text-slate-600">{t(`landing_tile_${key}_sub`)}</span>
              </li>
            ))}
          </ul>
          <StoreButtons align="start" freeBadge={false} />
        </div>
        <div className="lg:col-span-6">
          <IsraelLifestyleCollage />
        </div>
      </div>
    </section>
  )
}
