'use client'

import { useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import TermsModal from '@/components/modals/TermsModal'
import { useLang } from '@/lib/i18n/useLang'
import { TranslationKey } from '@/lib/i18n/translations'

const TILES: { emoji: string; labelKey: TranslationKey; countKey: TranslationKey; newDot?: boolean }[] = [
  { emoji: '✨', labelKey: 'row_new', countKey: 'count_12', newDot: true },
  { emoji: '🔥', labelKey: 'row_bestsellers', countKey: 'count_30' },
  { emoji: '🍽️', labelKey: 'row_restaurants', countKey: 'count_50' },
  { emoji: '🏖️', labelKey: 'row_beach', countKey: 'count_30' },
  { emoji: '🎯', labelKey: 'cats_attractions_tours', countKey: 'count_25' },
  { emoji: '👗', labelKey: 'row_fashion', countKey: 'count_40' },
  { emoji: '💪', labelKey: 'row_sport', countKey: 'count_35' },
  { emoji: '🏨', labelKey: 'row_tourism', countKey: 'count_20' },
  { emoji: '🥂', labelKey: 'row_bundles', countKey: 'count_18' },
  { emoji: '💅', labelKey: 'row_beauty', countKey: 'count_22' },
  { emoji: '🏠', labelKey: 'cats_home', countKey: 'count_15' },
  { emoji: '👶', labelKey: 'cats_kids', countKey: 'count_20' },
  { emoji: '📊', labelKey: 'cats_insurance', countKey: 'count_10' },
  { emoji: '🚗', labelKey: 'cats_cars', countKey: 'count_12' },
]

export default function CategoriesPage() {
  const { t } = useLang()
  const [termsOpen, setTermsOpen] = useState(false)

  const openRaffleTerms = () => setTermsOpen(true)
  const closeTerms = () => setTermsOpen(false)

  return (
    <>
      <Navbar />
      <div className="pt-16">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 py-8 sm:py-10">
          <Link href="/" className="tap-target flex items-center gap-2 text-brand font-bold mb-6 hover:underline">
            <i className="fa-solid fa-arrow-left"></i> <span>{t('back_btn')}</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mb-6">{t('cats_page_title')}</h1>

          <div className="join-cta-banner mb-8">
            <div className="flex items-center gap-3">
              <i className="fa-solid fa-gift text-brand text-xl flex-shrink-0"></i>
              <div>
                <p className="font-bold text-slate-900 text-sm sm:text-base">{t('cats_cta_headline')}</p>
                <p className="text-slate-500 text-xs sm:text-sm mt-0.5">{t('cats_cta_sub')}</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5 flex-shrink-0 w-full sm:w-auto">
              <Link href="/#pricing" className="tap-target justify-center bg-brand text-white font-bold text-sm px-5 py-2.5 rounded-full hover:bg-brandDark transition shadow-md whitespace-nowrap">{t('join_banner_cta')}</Link>
              <button onClick={openRaffleTerms} className="tap-target justify-center border-2 border-brand text-brand font-bold text-sm px-5 py-2.5 rounded-full hover:bg-brandLight transition whitespace-nowrap">{t('raffle_card_details')}</button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {TILES.map((tile, i) => (
              <div key={i} className="bg-white border border-slate-100 rounded-2xl p-4 sm:p-5 text-center hover:border-brand hover:shadow-md transition cursor-pointer relative">
                {tile.newDot && <span className="new-badge-dot" style={{ position: 'absolute', top: 14, right: 14 }}></span>}
                <div className="text-3xl sm:text-4xl mb-2 sm:mb-3">{tile.emoji}</div>
                <div className="font-bold text-slate-900 text-sm sm:text-base">{t(tile.labelKey)}</div>
                <div className="text-xs text-slate-400 mt-1"><span>{t(tile.countKey)}</span> <span>{t('deals_word')}</span></div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <TermsModal isOpen={termsOpen} onClose={closeTerms} scrollToRaffle={true} />
    </>
  )
}
