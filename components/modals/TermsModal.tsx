'use client'

import { useEffect, useRef } from 'react'
import { useLang } from '@/lib/i18n/useLang'

export default function TermsModal({
  isOpen,
  onClose,
  scrollToRaffle,
}: {
  isOpen: boolean
  onClose: () => void
  scrollToRaffle: boolean
}) {
  const { t } = useLang()
  const raffleSectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
  }, [isOpen])

  useEffect(() => {
    if (isOpen && scrollToRaffle) {
      const timer = setTimeout(() => {
        raffleSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [isOpen, scrollToRaffle])

  return (
    <div
      className={`modal-bg ${isOpen ? 'show' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal-box">
        <button onClick={onClose} className="modal-close-btn tap-target flex items-center justify-center absolute top-3 right-3 sm:top-4 sm:right-5 text-slate-400 hover:text-slate-700 text-xl"><i className="fa-solid fa-xmark"></i></button>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-4 pr-8">{t('terms_title')}</h2>
        <div className="join-cta-banner mb-6 !py-3 !px-4">
          <div className="flex items-center gap-2.5">
            <i className="fa-solid fa-ticket text-brand text-base flex-shrink-0"></i>
            <p className="font-semibold text-slate-800 text-xs sm:text-sm">{t('terms_cta_text')}</p>
          </div>
          <a href="#pricing" onClick={onClose} className="tap-target bg-brand text-white font-bold text-xs px-4 py-2 rounded-full hover:bg-brandDark transition flex-shrink-0">{t('join_banner_cta')}</a>
        </div>
        <div className="text-slate-600 text-[13px] leading-relaxed space-y-5">
          <p><strong>{t('terms_updated_label')}</strong> <span>{t('terms_updated_date')}</span></p>
          <div>
            <h3 className="font-bold text-slate-800 text-base mb-1">{t('terms_h1')}</h3>
            <p>{t('terms_p1')}</p>
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-base mb-1">{t('terms_h2')}</h3>
            <p><strong>{t('terms_p2a_label')}</strong> <span>{t('terms_p2a')}</span></p>
            <p className="mt-2"><strong>{t('terms_p2b_label')}</strong> <span>{t('terms_p2b')}</span></p>
            <p className="mt-2"><strong>{t('terms_p2c_label')}</strong> <span>{t('terms_p2c')}</span></p>
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-base mb-1">{t('terms_h3')}</h3>
            <p>{t('terms_p3')}</p>
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-base mb-1">{t('terms_h4')}</h3>
            <p>{t('terms_p4')}</p>
          </div>
          <div ref={raffleSectionRef} className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <h3 className="font-bold text-slate-800 text-base mb-1 flex items-center gap-2"><i className="fa-solid fa-ticket text-amber-500"></i> <span>{t('terms_h5')}</span></h3>
            <p>{t('terms_raffle_intro')}</p>
            <ul className="list-disc pr-5 mt-2 space-y-1">
              <li>{t('terms_raffle_li1')}</li>
              <li>{t('terms_raffle_li2')}</li>
              <li>{t('terms_raffle_li3')}</li>
              <li>{t('terms_raffle_li4')}</li>
              <li>{t('terms_raffle_li5')}</li>
              <li>{t('terms_raffle_li6')}</li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-base mb-1">{t('terms_h6')}</h3>
            <p>{t('terms_p6')}</p>
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-base mb-1">{t('terms_h7')}</h3>
            <p>{t('terms_p7')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
