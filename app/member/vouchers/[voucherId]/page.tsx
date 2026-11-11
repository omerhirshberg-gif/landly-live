'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Clock, LoaderCircle, MapPin, Ticket } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import BackButton from '@/components/navigation/BackButton'
import OpenInAppHint from '@/components/layout/OpenInAppHint'
import RedemptionBadge from '@/components/discover/RedemptionBadge'
import HowToRedeem from '@/components/offers/HowToRedeem'
import NavigationLinks from '@/components/offers/NavigationLinks'
import { voucherDestination } from '@/lib/member/voucherDestination'
import VoucherCover from '@/components/member/VoucherCover'
import VoucherTicket from '@/components/member/VoucherTicket'
import VoucherTerms from '@/components/member/VoucherTerms'
import { CodeReveal, QrReveal } from '@/components/member/VoucherReveal'
import AddToAppleWallet from '@/components/member/AddToAppleWallet'
import { useOnboardingGuard } from '@/components/auth/useOnboardingGuard'
import { useLang } from '@/lib/i18n/useLang'
import { useAuth } from '@/lib/firebase/useAuth'
import { formatLongDate } from '@/lib/format'
import { redeemVoucherKey, subscribeToVoucher, type VoucherDocument } from '@/lib/firebase/vouchers'
import TranslationNotice from '@/components/ui/TranslationNotice'
import { useLocalizedContent } from '@/lib/i18n/useLocalizedContent'
import { localizedBusinessName } from '@/lib/business/businessText'
import { offerTextSources } from '@/lib/offers/offerText'

type Voucher = VoucherDocument & { id: string }

// One voucher as its own page, opened from a My Pass card: the perk's photo
// and the business's logo up top, then a ticket: the business and the deal above
// a perforation, and below it the QR code and the numeric code -- each on the back of a card that turns over when tapped
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

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  useEffect(() => {
    if (!user || !voucherId) return
    return subscribeToVoucher(voucherId, setVoucher)
  }, [user, voucherId])

  // The voucher's own frozen translation, not the live offer's.
  const content = useLocalizedContent(offerTextSources(voucher), voucher?.translations, lang)
  const title = content.text('title')
  const instructions = content.text('redemptionInstructions')
  const businessName = voucher ? localizedBusinessName(voucher, lang).text : ''
  const { place, destination } = voucher ? voucherDestination(voucher, lang) : { place: '', destination: null }
  const expired = !!voucher?.expiresAt && voucher.expiresAt.getTime() < Date.now()

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
            <>
              <VoucherTicket
                top={
                  <>
                    <VoucherCover voucher={voucher} name={businessName} aspect="aspect-[2/1] max-h-[220px]" logoSize="lg" />
                    <div className="px-5 pb-[18px] pt-10 sm:px-7 sm:pt-11">
                      <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-ink break-words sm:text-3xl" dir="auto">{businessName}</h1>
                      <p className="mt-1 text-[15px] font-medium text-slate-600" lang={title.lang ?? undefined} dir="auto">{title.text}</p>
                      {content.machine && (
                        <TranslationNotice className="mt-1" showingOriginal={content.showingOriginal} onToggle={content.toggleOriginal} />
                      )}
                      <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                        <RedemptionBadge method={voucher.redemptionMethod} />
                        {voucher.expiresAt && (
                          <span className={`inline-flex items-center gap-1.5 text-[13px] font-semibold ${expired ? 'text-red-600' : 'text-slate-500'}`}>
                            <Clock aria-hidden="true" className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                            <span>{t(expired ? 'voucher_expired_on' : 'voucher_valid_until').replace('{date}', formatLongDate(voucher.expiresAt, lang))}</span>
                          </span>
                        )}
                      </div>
                      {place && (
                        <p className="mt-3.5 flex items-start gap-1.5 text-sm text-muted">
                          <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} />
                          <span className="min-w-0 break-words" dir="auto">{place}</span>
                        </p>
                      )}
                      {destination && <NavigationLinks wide destination={destination} className="mt-3" />}
                    </div>
                  </>
                }
                stub={
                  <>
                    {voucher.status === 'active' ? (
                      <>
                        <QrReveal redeemKey={redeemVoucherKey(voucher)} />
                        <div className="mt-4">
                          <CodeReveal code={voucher.externalCode ?? voucher.redemptionCode} />
                        </div>
                        <AddToAppleWallet voucher={voucher} />
                      </>
                    ) : (
                      <p role="status" className="rounded-2xl bg-slate-50 p-4 text-center text-sm font-semibold text-slate-600">
                        {t('voucher_already_redeemed')}
                      </p>
                    )}
                    {/* Vouchers issued before order numbering have none to show. */}
                    {voucher.displayOrderNumber && (
                      <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm">
                        <span className="text-slate-500">{t('success_order_number_label')}</span>
                        <span className="font-mono font-semibold text-slate-800" dir="ltr">{voucher.displayOrderNumber}</span>
                      </div>
                    )}
                  </>
                }
              />

              {/* How to redeem, up under the ticket; the conditions stay in VoucherTerms, so they aren't shown twice. */}
              <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
                <HowToRedeem method={voucher.redemptionMethod} instructions={instructions.text} instructionsLang={instructions.lang} variant="inline" />
                {(voucher.expiresAt || voucher.redemptionTerms) && (
                  <div className="mt-5 border-t border-slate-100 pt-5">
                    <VoucherTerms voucher={voucher} terms={content.text('redemptionTerms')} />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
