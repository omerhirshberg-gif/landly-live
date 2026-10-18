'use client'

import Navbar from '@/components/layout/Navbar'
import MentorRequestCard from '@/components/olim/MentorRequestCard'
import { useLang } from '@/lib/i18n/useLang'

export default function OlimPage() {
  const { t } = useLang()

  return (
    <>
      <Navbar />
      <div className="pt-16 bg-white">
        <div className="max-w-4xl mx-auto px-5 sm:px-6 py-8 sm:py-10">
          <div className="text-center mb-10 sm:mb-12">
            <div className="text-4xl sm:text-5xl mb-4">✈️ 🇮🇱</div>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 mb-4" style={{ letterSpacing: '-1px' }}>{t('olim_title')}</h1>
            <p className="text-slate-500 max-w-xl mx-auto leading-relaxed text-[15px] sm:text-base">{t('olim_sub')}</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-4 sm:gap-5 mb-10 sm:mb-12">
            <div className="bg-brandLight border border-brand/20 rounded-2xl p-5 sm:p-6 text-center">
              <div className="text-3xl mb-3">🎁</div>
              <h3 className="font-bold text-slate-900 mb-2">{t('olim_card_title')}</h3>
              <p className="text-sm text-slate-500">{t('olim_card_desc')}</p>
            </div>
            <div className="bg-brandLight border border-brand/20 rounded-2xl p-5 sm:p-6 text-center">
              <div className="text-3xl mb-3">⚖️</div>
              <h3 className="font-bold text-slate-900 mb-2">{t('olim_rights_title')}</h3>
              <p className="text-sm text-slate-500">{t('olim_rights_desc')}</p>
            </div>
            <div className="bg-brandLight border border-brand/20 rounded-2xl p-5 sm:p-6 text-center">
              <div className="text-3xl mb-3">🤝</div>
              <h3 className="font-bold text-slate-900 mb-2">{t('olim_mentor_title')}</h3>
              <p className="text-sm text-slate-500">{t('olim_mentor_desc')}</p>
            </div>
          </div>
          {/* Lone soldiers: what Landly offers them, and the member type to pick when joining. */}
          <section id="lone-soldiers" aria-labelledby="lone-soldiers-title" className="scroll-mt-20 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 mb-10 sm:mb-12 shadow-sm">
            <div className="text-4xl flex-shrink-0" aria-hidden="true">🎖️</div>
            <div className="min-w-0">
              <h2 id="lone-soldiers-title" className="text-xl sm:text-2xl font-black text-slate-900 mb-2">{t('olim_lone_title')}</h2>
              <p className="text-[15px] leading-relaxed text-slate-600">{t('olim_lone_desc')}</p>
            </div>
          </section>
          <div className="bg-slate-50 rounded-3xl p-6 sm:p-8 mb-10 sm:mb-12">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-6">{t('olim_categories_title')}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              <div className="bg-white border border-slate-100 rounded-xl p-4 text-center hover:border-brand transition cursor-pointer"><div className="text-2xl mb-2">👶</div><div className="font-semibold text-slate-800 text-sm">{t('cats_kids')}</div></div>
              <div className="bg-white border border-slate-100 rounded-xl p-4 text-center hover:border-brand transition cursor-pointer"><div className="text-2xl mb-2">🏠</div><div className="font-semibold text-slate-800 text-sm">{t('cats_home')}</div></div>
              <div className="bg-white border border-slate-100 rounded-xl p-4 text-center hover:border-brand transition cursor-pointer"><div className="text-2xl mb-2">📊</div><div className="font-semibold text-slate-800 text-sm">{t('cats_insurance')}</div></div>
              <div className="bg-white border border-slate-100 rounded-xl p-4 text-center hover:border-brand transition cursor-pointer"><div className="text-2xl mb-2">🏥</div><div className="font-semibold text-slate-800 text-sm">{t('olim_cat_health')}</div></div>
              <div className="bg-white border border-slate-100 rounded-xl p-4 text-center hover:border-brand transition cursor-pointer"><div className="text-2xl mb-2">📚</div><div className="font-semibold text-slate-800 text-sm">{t('olim_cat_ulpan')}</div></div>
              <div className="bg-white border border-slate-100 rounded-xl p-4 text-center hover:border-brand transition cursor-pointer"><div className="text-2xl mb-2">🚗</div><div className="font-semibold text-slate-800 text-sm">{t('cats_cars')}</div></div>
            </div>
          </div>
          <MentorRequestCard />
        </div>
      </div>
    </>
  )
}
