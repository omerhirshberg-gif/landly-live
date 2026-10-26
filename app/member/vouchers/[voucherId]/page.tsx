'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { LoaderCircle, Ticket } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import BackButton from '@/components/navigation/BackButton'
import OpenInAppHint from '@/components/layout/OpenInAppHint'
import PerkImage from '@/components/discover/PerkImage'
import RedemptionBadge from '@/components/discover/RedemptionBadge'
import HowToRedeem from '@/components/offers/HowToRedeem'
import VoucherTerms from '@/components/member/VoucherTerms'
import { CodeReveal, QrReveal } from '@/components/member/VoucherReveal'
import { useOnboardingGuard } from '@/components/auth/useOnboardingGuard'
import { useLang } from '@/lib/i18n/useLang'
import { useAuth } from '@/lib/firebase/useAuth'
import { getOffer, type OfferDocument } from '@/lib/firebase/offers'
import { redeemVoucherKey, subscribeToVoucher, type VoucherDocument } from '@/lib/firebase/vouchers'
import TranslationNotice from '@/components/ui/TranslationNotice'
import { useLocalizedContent } from '@/lib/i18n/useLocalizedContent'
import { localizedBusinessName } from '@/lib/business/businessText'
import { offerTextSources } from '@/lib/offers/offerText'

type Voucher = VoucherDocument & { id: string }

// One voucher as its own page, opened from a My Pass card: the perk's photo
// and the business name up top, then the QR code and the numeric code --
// each on the back of a card that turns over when tapped
// (components/member/VoucherReveal.tsx) -- then how to redeem and the
// validity and terms. Live from Firestore, so a pass the business redeems
// turns into the "already redeemed" notice in place. Back returns to My
// Pass; the browser's back and edge swipe do the same.
export default function VoucherPage() {
  const { t, lang } = useLang()
  const { user, loading } = useAuth()
  // Onboarding first: a member mid-wizard is sent back to it.
  const held = useOnboardingGuard()
  const router = useRouter()
  const { voucherId } = useParams<{ voucherId: string }>()
  // undefined while loading; null when missing or someone else's (rules deny both alike).
  const [voucher, setVoucher] = useState<Voucher | null | undefined>(undefined)
  const [offer, setOffer] = useState<OfferDocument | null>(null)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  useEffect(() => {
    if (!user || !voucherId) return
    return subscribeToVoucher(voucherId, setVoucher)
  }, [user, voucherId])

  // The photo and category are decoration: without them the category panel shows.
  const offerId = voucher?.offerId
  useEffect(() => {
    if (!offerId) return
    let cancelled = false
    getOffer(offerId)
      .then((next) => { if (!cancelled) setOffer(next) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [offerId])

  // The voucher's own frozen translation, not the live offer's.
  const content = useLocalizedContent(offerTextSources(voucher), voucher?.translations, lang)
  const title = content.text('title')
  const instructions = content.text('redemptionInstructions')

  if (loading || !user || held || voucher === undefined) {
    return (
      <>
        <Navbar />
        <div className="below-header member-canvas min-h-screen min-h-dvh">
          <div role="status" className="max-w-xl mx-auto px-5 py-16 flex justify-center text-slate-400">
            <LoaderCircle aria-hidden="true" className="h-7 w-7 animate-spin text-brand motion-reduce:animate-none" strokeWidth={1.75} />
            <span className="sr-only">{t('bizdash_loading')}</span>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <div className="below-header member-canvas min-h-screen min-h-dvh">
        <div className="max-w-xl mx-auto px-5 sm:px-6 pt-4 sm:pt-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:pb-12">
          <OpenInAppHint className="mb-3" />
          <BackButton fallback="/member" label={t('nav_my_pass')} className="mb-3" />

          {voucher === null ? (
            <div role="alert" className="bg-white border border-slate-100 rounded-3xl p-8 shadow-card text-center">
              <Ticket aria-hidden="true" className="mx-auto mb-3 h-8 w-8 text-slate-300" strokeWidth={1.5} />
              <p className="text-sm text-slate-600">{t('voucher_not_found')}</p>
            </div>
          ) : (
            <article className="overflow-hidden rounded-3xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_16px_40px_-20px_rgba(0,56,184,0.35)] ring-1 ring-slate-200/70">
              <div className="relative aspect-[16/9] bg-brandTint">
                {offer && <PerkImage src={offer.imageUrl} alt="" category={offer.category} businessName={offer.businessName} size="hero" />}
              </div>
              <div className="p-5 sm:p-7">
                <h1 className="text-3xl sm:text-4xl font-black leading-tight tracking-tight text-ink break-words" dir="auto">{localizedBusinessName(voucher, lang).text}</h1>
                <p className="mt-1 text-base font-semibold text-slate-600" lang={title.lang ?? undefined} dir="auto">{title.text}</p>
                {content.machine && (
                  <TranslationNotice className="mt-1" showingOriginal={content.showingOriginal} onToggle={content.toggleOriginal} />
                )}
                <RedemptionBadge method={voucher.redemptionMethod} className="mt-3" />

                {voucher.status === 'active' ? (
                  <>
                    <div className="mt-6 border-t border-slate-100 pt-6">
                      <QrReveal redeemKey={redeemVoucherKey(voucher)} />
                    </div>
                    <div className="mt-6 border-t border-slate-100 pt-6">
                      <CodeReveal code={voucher.redemptionCode} />
                    </div>
                  </>
                ) : (
                  <p role="status" className="mt-6 rounded-2xl bg-slate-50 p-4 text-center text-sm font-semibold text-slate-600">
                    {t('voucher_already_redeemed')}
                  </p>
                )}

                {/* Conditions stay in VoucherTerms below, so they aren't shown twice. */}
                <div className="mt-6 border-t border-slate-100 pt-6">
                  <HowToRedeem method={voucher.redemptionMethod} instructions={instructions.text} instructionsLang={instructions.lang} variant="inline" />
                </div>
                {(voucher.expiresAt || voucher.redemptionTerms) && (
                  <div className="mt-6 border-t border-slate-100 pt-6">
                    <VoucherTerms voucher={voucher} terms={content.text('redemptionTerms')} />
                  </div>
                )}
                {/* Vouchers issued before order numbering have none to show. */}
                {voucher.displayOrderNumber && (
                  <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-100 pt-6 text-sm">
                    <span className="text-slate-500">{t('success_order_number_label')}</span>
                    <span className="font-mono font-semibold text-slate-800" dir="ltr">{voucher.displayOrderNumber}</span>
                  </div>
                )}
              </div>
            </article>
          )}
        </div>
      </div>
    </>
  )
}
