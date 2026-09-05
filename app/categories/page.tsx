'use client'

import { useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import TermsModal from '@/components/modals/TermsModal'
import NearMeButton from '@/components/discover/NearMeButton'
import { useLang } from '@/lib/i18n/useLang'
import { TranslationKey } from '@/lib/i18n/translations'
import { sortByDistance, Coordinates } from '@/lib/geo'
import type { Business } from '@/lib/types/business'

// No businesses onboarded yet — populated once real listings exist.
const BUSINESSES: Business[] = []

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
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null)

  const openRaffleTerms = () => setTermsOpen(true)
  const closeTerms = () => setTermsOpen(false)

  const nearby = userLocation ? sortByDistance(BUSINESSES, userLocation) : null

  return (
    <>
      <Navbar />
      <div className="pt-16">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 py-8 sm:py-10">
          <Link href="/" className="tap-target flex items-center gap-2 text-brand font-bold mb-6 hover:underline">
            <i className="fa-solid fa-arrow-left"></i> <span>{t('back_btn')}</span>
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900">{t('cats_page_title')}</h1>
            <NearMeButton onLocate={setUserLocation} />
          </div>

          {nearby && (
            <div className="mb-8">
              <h2 className="text-sm font-bold text-slate-900 mb-3">{t('discover_nearby_title')}</h2>
              {nearby.length === 0 ? (
                <div className="dash-empty-state bg-white border border-slate-100 rounded-2xl">
                  <i className="fa-solid fa-tags"></i>
                  <div className="font-bold text-slate-700 text-base mb-1">{t('deals_empty_title')}</div>
                  <p className="text-sm text-slate-500 max-w-xs">{t('deals_empty_sub')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  {nearby.map((business) => (
                    <div key={business.id} className="bg-white border border-slate-100 rounded-2xl p-4">
                      <div className="font-bold text-slate-900 text-sm">{business.name}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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
