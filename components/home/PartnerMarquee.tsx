'use client'

import type { CSSProperties } from 'react'
import Link from 'next/link'
import { marqueeRepeats, pickMarqueeItems, type MarqueeItem, type ShowcaseOffer } from '@/lib/home/showcase'
import { useLang } from '@/lib/i18n/useLang'
import { localizedBusinessName } from '@/lib/business/businessText'
import { useInView } from '@/lib/useInView'

// Seconds per item, so a short or long stream drifts at about the same speed.
const SECONDS_PER_ITEM = 3

// The ticker tape right under the guest hero: one continuous stream of the
// real businesses on Landly (or, with too few yet, the real categories), as
// bold uppercase links in brand blue with a small Star of David between
// each, on a sky-blue band (#E0F2FE) with sky hairlines above and below. CSS only (.marquee in globals.css): the
// track holds the stream twice and slides by exactly half its width,
// transform only, so the loop restarts on the same pixel and nothing is laid
// out per frame. In Hebrew it runs the other way, with the reading.
//
// It never stops under the pointer and has no pause button. It stops while
// an item has keyboard focus (so a tabbed-to item can be read) and while off
// screen; under reduced motion it's one static, wrapped set of items.
export default function PartnerMarquee({ offers }: { offers: readonly ShowcaseOffer[] }) {
  const { t } = useLang()
  const [ref, inView] = useInView<HTMLDivElement>()
  const items = pickMarqueeItems(offers)
  const label = t(items[0]?.kind === 'category' ? 'landing_marquee_categories' : 'landing_marquee_label')

  return (
    <section aria-label={label} className="pb-10 sm:pb-12">
      <p className="mb-3 px-5 text-center text-xs font-bold uppercase tracking-widest text-body rtl:tracking-normal" aria-hidden="true">{label}</p>
      <div className="border-y border-sky-200/70 bg-sky-100">
        <div ref={ref} className="marquee mx-auto max-w-screen-2xl" data-paused={!inView || undefined}>
          {items.length > 0 && <MarqueeRow row={items} />}
        </div>
      </div>
    </section>
  )
}

function MarqueeRow({ row }: { row: MarqueeItem[] }) {
  const repeats = marqueeRepeats(row.length)
  const perHalf = row.length * repeats

  // One half of the loop; the second is the same items again, hidden from
  // screen readers and the tab order, as are the repeats inside the first.
  // Every item carries its own divider, so both halves are exactly equal.
  const half = (clone: boolean) => (
    <ul className="marquee-half" aria-hidden={clone || undefined} inert={clone}>
      {Array.from({ length: repeats }, (_, rep) =>
        row.map((item) => (
          <li key={`${rep}-${item.key}`} className="marquee-item" data-repeat={rep > 0 || undefined} inert={rep > 0}>
            <StarOfDavid />
            <TickerItem item={item} />
          </li>
        )),
      )}
    </ul>
  )

  return (
    <div className="marquee-row">
      <div className="marquee-track" style={{ '--marquee-duration': `${perHalf * SECONDS_PER_ITEM}s` } as CSSProperties}>
        {half(false)}
        {half(true)}
      </div>
    </div>
  )
}

// The divider: a crisp inline vector (the Star of David character renders as
// an OS emoji on many phones), two interlaced outlined triangles in faded
// brand blue.
function StarOfDavid() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="mx-4 h-3.5 w-3.5 shrink-0 text-brand/60 sm:mx-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
      <path d="M12 2.5 20.66 17.5H3.34Z" />
      <path d="M12 21.5 3.34 6.5h17.32Z" />
    </svg>
  )
}

// One item on the tape: bold uppercase brand blue, no box; a business's
// discount follows it in emerald. Hebrew has no capitals, so it drops the
// wide tracking.
function TickerItem({ item }: { item: MarqueeItem }) {
  const { t, lang } = useLang()
  return (
    <Link
      href={item.href}
      className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap font-display text-sm font-bold uppercase tracking-wider text-brand transition-colors duration-200 rtl:tracking-normal sm:text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand [@media(hover:hover)]:hover:text-ink"
    >
      {item.kind === 'offer' ? (
        <>
          <bdi>{localizedBusinessName({ businessName: item.label, businessTranslations: item.businessTranslations }, lang).text}</bdi>
          {item.percent > 0 && <span className="text-success">{t('offer_percent_off').replace('{n}', String(item.percent))}</span>}
        </>
      ) : (
        <span>{t(item.labelKey)}</span>
      )}
    </Link>
  )
}
