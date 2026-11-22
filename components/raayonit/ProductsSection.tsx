'use client'

import type { OfferDocument } from '@/lib/firebase/offers'
import { useLang } from '@/lib/i18n/useLang'
import RaayonitHero from './RaayonitHero'

// "Our Products" (native: landly-mobile/src/components/ProductsSection.tsx): the landing of Home and Perks. The Raayonit Card is the
// flagship.
export default function ProductsSection({ flagship }: { flagship: OfferDocument | null }) {
  const { t } = useLang()
  return (
    <section aria-labelledby="products-title" className="mx-auto w-full max-w-6xl">
      <h2 id="products-title" className="text-[22px] font-extrabold tracking-tight text-ink sm:text-2xl">{t('products_title')}</h2>
      <p className="mt-1 text-sm leading-5 text-muted">{t('products_sub')}</p>
      <div className="mt-5 space-y-4">
        <RaayonitHero offer={flagship} />
      </div>
    </section>
  )
}
