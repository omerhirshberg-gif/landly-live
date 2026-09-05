'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import { useLang } from '@/lib/i18n/useLang'
import { useAuth } from '@/lib/firebase/useAuth'
import { usePerkCollections } from '@/lib/firebase/usePerkCollections'

export default function WishlistPage() {
  const { t } = useLang()
  const { user, loading } = useAuth()
  const router = useRouter()
  const { wishlistIds, toggleWishlist } = usePerkCollections()

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  if (loading || !user) {
    return (
      <>
        <Navbar />
        <div className="pt-16 min-h-screen bg-slate-50" />
      </>
    )
  }

  return (
    <>
      <Navbar />
      <div className="pt-16 bg-slate-50 min-h-screen">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 py-8 sm:py-10">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mb-6">{t('wishlist_title')}</h1>

          {wishlistIds.length === 0 ? (
            <div className="dash-empty-state bg-white border border-slate-100 rounded-2xl">
              <i className="fa-solid fa-heart"></i>
              <div className="font-bold text-slate-700 text-base mb-1">{t('wishlist_empty_title')}</div>
              <p className="text-sm text-slate-500 max-w-xs mb-5">{t('wishlist_empty_sub')}</p>
              <Link href="/categories" className="tap-target btn-primary">
                <span>{t('nav_cta')}</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Falls back to showing the raw perk id until a real perk
                  catalog exists to resolve business name/image/details from it. */}
              {wishlistIds.map((perkId) => (
                <div key={perkId} className="bg-white border border-slate-100 rounded-2xl p-4 sm:p-5 flex items-center gap-4 shadow-sm">
                  <div className="qr-box"></div>
                  <div className="flex-1 min-w-0 font-bold text-slate-900 text-sm sm:text-base" dir="ltr">{perkId}</div>
                  <button
                    onClick={() => toggleWishlist(perkId)}
                    aria-label={t('btn_remove_from_wishlist')}
                    className="tap-target flex items-center justify-center text-red-500 hover:text-red-600"
                  >
                    <i className="fa-solid fa-heart text-lg"></i>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
