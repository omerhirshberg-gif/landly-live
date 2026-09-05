'use client'

import { useEffect, useState } from 'react'
import { useLang } from '@/lib/i18n/useLang'
import { usePerkCollections } from '@/lib/firebase/usePerkCollections'
import type { Perk } from '@/lib/types/perk'

export default function PerkDetailModal({
  perk,
  isOpen,
  onClose,
}: {
  perk: Perk
  isOpen: boolean
  onClose: () => void
}) {
  const { t } = useLang()
  const { isWishlisted, isInCart, toggleWishlist, toggleCart } = usePerkCollections()
  const [showQr, setShowQr] = useState(false)
  const [showCode, setShowCode] = useState(false)

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    if (!isOpen) {
      setShowQr(false)
      setShowCode(false)
    }
  }, [isOpen])

  return (
    <div
      className={`modal-bg ${isOpen ? 'show' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal-box">
        <button onClick={onClose} className="modal-close-btn tap-target flex items-center justify-center absolute top-3 right-3 sm:top-4 sm:right-5 text-slate-400 hover:text-slate-700 text-xl"><i className="fa-solid fa-xmark"></i></button>

        <div className="max-w-sm mx-auto">
          <div className="w-full h-32 sm:h-36 rounded-2xl bg-gradient-to-br from-brand to-brandDark flex items-center justify-center text-5xl mb-5">
            <span>{perk.emoji}</span>
          </div>

          <h2 className="text-lg sm:text-xl font-black text-slate-900 mb-1 pr-8">{perk.businessName}</h2>
          <p className="text-sm text-slate-500 mb-4">{perk.location}</p>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              onClick={() => toggleWishlist(perk.id)}
              aria-pressed={isWishlisted(perk.id)}
              className={`tap-target flex items-center justify-center gap-2 border-2 rounded-full text-sm font-bold py-2.5 transition ${isWishlisted(perk.id) ? 'border-red-500 text-red-500 bg-red-50' : 'border-slate-200 text-slate-700 hover:border-red-300 hover:text-red-500'}`}
            >
              <i className={`${isWishlisted(perk.id) ? 'fa-solid' : 'fa-regular'} fa-heart text-xs`}></i>
              <span>{isWishlisted(perk.id) ? t('btn_remove_from_wishlist') : t('btn_add_to_wishlist')}</span>
            </button>
            <button
              onClick={() => toggleCart(perk.id)}
              aria-pressed={isInCart(perk.id)}
              className={`tap-target flex items-center justify-center gap-2 border-2 rounded-full text-sm font-bold py-2.5 transition ${isInCart(perk.id) ? 'border-brand text-brand bg-brandLight' : 'border-slate-200 text-slate-700 hover:border-brand hover:text-brand'}`}
            >
              <i className="fa-solid fa-cart-shopping text-xs"></i>
              <span>{isInCart(perk.id) ? t('btn_remove_from_cart') : t('btn_add_to_cart')}</span>
            </button>
          </div>

          <div className="mb-6">
            <div className="flex flex-col items-center">
              <div
                role="button"
                tabIndex={0}
                aria-label={showQr ? t('perk_modal_hide_qr') : t('perk_modal_show_qr')}
                onClick={() => setShowQr((v) => !v)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowQr((v) => !v) } }}
                className={`flip-card w-48 sm:w-56 aspect-square cursor-pointer ${showQr ? 'flipped' : ''}`}
              >
                <div className="flip-card-inner">
                  <div className="flip-card-face bg-slate-100 border-2 border-dashed border-slate-300">
                    <i className="fa-solid fa-qrcode text-2xl text-slate-400"></i>
                  </div>
                  <div className="flip-card-face flip-card-face-back qr-box" style={{ width: '100%', height: '100%' }}></div>
                </div>
              </div>
              <button
                onClick={() => setShowQr((v) => !v)}
                className="tap-target w-48 sm:w-56 mt-3 flex items-center justify-center gap-2 bg-brand text-white font-bold text-sm py-2.5 rounded-full hover:bg-brandDark transition"
              >
                <i className="fa-solid fa-qrcode text-xs"></i>
                <span>{showQr ? t('perk_modal_hide_qr') : t('perk_modal_show_qr')}</span>
              </button>
            </div>

            <div className="flex flex-col items-center mt-4">
              <div
                role="button"
                tabIndex={0}
                aria-label={showCode ? t('perk_modal_hide_code') : t('perk_modal_show_code')}
                onClick={() => setShowCode((v) => !v)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowCode((v) => !v) } }}
                className={`flip-card w-full h-14 sm:h-16 cursor-pointer ${showCode ? 'flipped' : ''}`}
              >
                <div className="flip-card-inner">
                  <div className="flip-card-face flex-row gap-2 bg-slate-100 border-2 border-dashed border-slate-300">
                    <i className="fa-solid fa-key text-lg text-slate-400"></i>
                  </div>
                  <div className="flip-card-face flip-card-face-back bg-brandLight px-2">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">{t('perk_modal_code_label')}</div>
                    <div className="text-base sm:text-lg font-black text-slate-900 tracking-[0.15em]" dir="ltr">{perk.redeemCode}</div>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowCode((v) => !v)}
                className="tap-target w-full mt-3 flex items-center justify-center gap-2 border-2 border-brand text-brand font-bold text-sm py-2.5 rounded-full hover:bg-brandLight transition"
              >
                <i className="fa-solid fa-key text-xs"></i>
                <span>{showCode ? t('perk_modal_hide_code') : t('perk_modal_show_code')}</span>
              </button>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 mb-6">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">{t('perk_modal_details_label')}</div>
            <p className="text-sm text-slate-700 leading-relaxed">{perk.details}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <a href={perk.wazeUrl} target="_blank" rel="noopener noreferrer" className="tap-target flex items-center justify-center gap-2 bg-[#33ccff] text-white font-bold text-sm py-3 rounded-full hover:opacity-90 transition">
              <i className="fa-brands fa-waze text-base"></i> <span>Waze</span>
            </a>
            <a href={perk.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="tap-target flex items-center justify-center gap-2 border-2 border-slate-200 text-slate-700 font-bold text-sm py-3 rounded-full hover:border-brand hover:text-brand transition">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path d="M12 2C7.58 2 4 5.58 4 10c0 5.25 6.72 11.19 7.02 11.45a1.3 1.3 0 0 0 1.96 0C13.28 21.19 20 15.25 20 10c0-4.42-3.58-8-8-8z" fill="#EA4335" />
                <circle cx="12" cy="10" r="3.2" fill="#fff" />
              </svg>
              <span>Google Maps</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
