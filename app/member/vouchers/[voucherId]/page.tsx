'use client'

import { Fragment, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { LoaderCircle, MapPin, Ticket } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import BackButton from '@/components/navigation/BackButton'
import OpenInAppHint from '@/components/layout/OpenInAppHint'
import RedemptionBadge from '@/components/discover/RedemptionBadge'
import HowToRedeem from '@/components/offers/HowToRedeem'
import NavigationLinks from '@/components/offers/NavigationLinks'
import { voucherDestination } from '@/lib/member/voucherDestination'
import ContactActions from '@/components/offers/ContactActions'
import VoucherCover from '@/components/member/VoucherCover'
import VoucherTicket from '@/components/member/VoucherTicket'
import VoucherTerms from '@/components/member/VoucherTerms'
import { CodeReveal, QrReveal } from '@/components/member/VoucherReveal'
import AddToAppleWallet from '@/components/member/AddToAppleWallet'
import BusinessPageNotice from '@/components/member/BusinessPageNotice'
import IssuerAttribution from '@/components/member/IssuerAttribution'
import VoucherBalance from '@/components/member/VoucherBalance'
import { resolveVoucherRedemptionProgress } from '@/lib/vouchers/redemptionProgress'
import { superTavHeadline } from '@/lib/offers/superTav'
import { ChainsFold, MultiChainCreditBox } from '@/components/offers/MultiChainCredit'
import { isRaayonitMultiChain } from '@/lib/offers/multiChainNote'
import MarkVoucherUsed from '@/components/member/MarkVoucherUsed'
import { useOnboardingGuard } from '@/components/auth/useOnboardingGuard'
import { useLang } from '@/lib/i18n/useLang'
import { useAuth } from '@/lib/firebase/useAuth'
import { formatNumericDate } from '@/lib/format'
import { redeemVoucherKey, subscribeToVoucher, type VoucherDocument } from '@/lib/firebase/vouchers'
import TranslationNotice from '@/components/ui/TranslationNotice'
import { useLocalizedContent } from '@/lib/i18n/useLocalizedContent'
import { localizedBusinessName } from '@/lib/business/businessText'
import { offerTextSources } from '@/lib/offers/offerText'
import { locationNoticeKind } from '@/lib/offers/locationVisibility'
import BrandStrip from '@/components/offers/BrandStrip'
import { ParticipatingChains, PerkReachLine, RedemptionGuide } from '@/components/discover/PerkReach'
import { useChainBrands } from '@/lib/offers/useChainBrands'

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

  // A multi-chain pass shows its brands as logo tiles, found among the live brand offers (the voucher froze only the names).
  const brands = useChainBrands(voucher)

  // The voucher's own frozen translation, not the live offer's.
  const content = useLocalizedContent(offerTextSources(voucher), voucher?.translations, lang)
  const title = content.text('title')
  const instructions = content.text('redemptionInstructions')
  const businessName = voucher ? localizedBusinessName(voucher, lang).text : ''
  const headline = voucher ? superTavHeadline(voucher, t('super_tav_headline')) : null
  const { place, destination } = voucher ? voucherDestination(voucher, lang) : { place: '', destination: null }
  const codeOnly = voucher?.redemptionKind === 'code_only'
  const expired = !!voucher?.expiresAt && voucher.expiresAt.getTime() < Date.now()
  // A multi-chain pass: the title already names it, and one guide covers every chain.
  const multiChain = voucher?.perkScope === 'multi_chain'
  const guide = voucher?.universalRedemptionGuide
  const hasGuide = multiChain && !!(guide && (guide.he || guide.en))
  // The balance line only when it says something the value in the title doesn't: a partly used pass.
  const progress = voucher ? resolveVoucherRedemptionProgress(voucher) : null
  const showBalance = !!progress && (progress.remainingAgorot !== progress.faceValueAgorot || voucher?.status !== 'active')

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
        <div className="max-w-xl lg:max-w-[1320px] 2xl:max-w-[1640px] mx-auto px-5 sm:px-6 pt-4 sm:pt-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:pb-12">
          <OpenInAppHint className="mb-3" />
          <BackButton fallback="/member" label={t('nav_my_pass')} className="mb-3" />

          {voucher === null ? (
            <div role="alert" className="bg-white border border-slate-100 rounded-3xl p-8 shadow-card text-center">
              <Ticket aria-hidden="true" className="mx-auto mb-3 h-8 w-8 text-slate-300" strokeWidth={1.5} />
              <p className="text-sm text-slate-600">{t('voucher_not_found')}</p>
            </div>
          ) : (
            <div className="lg:grid lg:grid-cols-[minmax(0,480px)_minmax(0,1fr)] lg:items-start lg:gap-8 2xl:grid-cols-[minmax(0,540px)_minmax(0,1fr)] 2xl:gap-12">
              <div className="lg:sticky lg:top-[calc(var(--header-offset)+1rem)]">
              <VoucherTicket
                top={
                  <>
                    <VoucherCover voucher={voucher} name={businessName} aspect="aspect-[2/1] max-h-[220px]" logoSize="lg" />
                    <div className="px-5 pb-[18px] pt-10 sm:px-7 sm:pt-11">
                      {/* Directly under the gift card: what is left, then until when. */}
                      {(voucher.expiresAt || showBalance) && (
                        <div className="mb-6">
                          {showBalance && <VoucherBalance voucher={voucher} variant="detail" />}
                          {voucher.expiresAt && (
                            <p className={`mt-1 text-center text-sm font-medium ${expired ? 'text-red-600' : 'text-slate-500'}`}>
                              {t(expired ? 'voucher_expired_on' : 'voucher_valid_until').split('{date}').map((part, i) => (i === 0 ? part : <Fragment key="d"><bdi dir="ltr" className="font-bold tabular-nums">{formatNumericDate(voucher.expiresAt!)}</bdi>{part}</Fragment>))}
                            </p>
                          )}
                        </div>
                      )}
                      {/* A Super Tav leads with its value ("Super Tav — ₪100 Value"), the business on the line below; any other perk keeps business then deal. */}
                      {headline ? (
                        <>
                          <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-ink tabular-nums break-words sm:text-3xl" dir="auto">{headline}</h1>
                          {!multiChain && <p className="mt-1.5 text-[15px] font-medium leading-relaxed text-slate-600" dir="auto">{businessName}</p>}
                        </>
                      ) : (
                        <>
                          <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-ink break-words sm:text-3xl" dir="auto">{businessName}</h1>
                          <p className="mt-1.5 text-[15px] font-medium leading-relaxed text-slate-600" lang={title.lang ?? undefined} dir="auto">{title.text}</p>
                        </>
                      )}
                      {codeOnly && voucher.issuer && <IssuerAttribution issuer={voucher.issuer} lang={lang} note={t('voucher_valid_years')} className="mt-5" />}
                      {content.machine && (
                        <TranslationNotice className="mt-1" showingOriginal={content.showingOriginal} onToggle={content.toggleOriginal} />
                      )}
                    </div>
                  </>
                }
                stub={
                  <>
                    {voucher.status === 'active' && codeOnly ? (
                      <>
                        {/* Raayonit: the code is the voucher. No QR code, no QR reveal. */}
                        <CodeReveal code={voucher.externalCode ?? voucher.redemptionCode} prominent />
                        {/* Immediately under the code: issued as a Multi-Chain Super Tav, valid here and across the network. */}
                        {isRaayonitMultiChain(voucher) && !multiChain && <MultiChainCreditBox className="mt-4" />}
                        <AddToAppleWallet voucher={voucher} />
                        <MarkVoucherUsed voucherId={voucher.id} />
                      </>
                    ) : voucher.status === 'active' ? (
                      <>
                        <QrReveal redeemKey={redeemVoucherKey(voucher)} />
                        <div className="mt-4">
                          <CodeReveal code={voucher.externalCode ?? voucher.redemptionCode} />
                        </div>
                        <AddToAppleWallet voucher={voucher} />
                      </>
                    ) : (
                      <p role="status" className="rounded-2xl bg-slate-50 p-4 text-center text-sm font-semibold text-slate-600">
                        {t(voucher.status === 'cancelled' ? 'voucher_cancelled' : 'voucher_already_redeemed')}
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

              </div>

              {/* Right column from lg (below it, under the ticket): how to redeem, where it works, the terms. */}
              <div className="mt-4 space-y-4 lg:mt-0">
                <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
                  {/* A multi-chain pass is redeemed the same way at every chain: its one guide replaces the generic steps. */}
                  {hasGuide ? <><div className="mb-3"><RedemptionBadge method={voucher.redemptionMethod} /></div><RedemptionGuide offer={voucher} /></> : <HowToRedeem method={voucher.redemptionMethod} instructions={instructions.text} instructionsLang={instructions.lang} variant="inline" codeOnly={codeOnly} />}
                  {voucher.status === 'active' && !expired && <BusinessPageNotice offerId={voucher.offerId} multiChain={multiChain} className="mt-5" />}
                  {voucher.redemptionTerms && (
                    <div className="mt-5 border-t border-slate-100 pt-5">
                      <VoucherTerms voucher={voucher} terms={content.text('redemptionTerms')} hideExpiry />
                    </div>
                  )}
                </div>
                <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6 empty:hidden">
                  <ContactActions stack className="mt-5" websiteUrl={voucher.websiteUrl} phone={voucher.contactPhone} />
                  {!place && locationNoticeKind(voucher) !== null && <PerkReachLine offer={voucher} className="mt-3.5 text-sm text-muted" />}
                  {!place && (locationNoticeKind(voucher) === 'stores' || locationNoticeKind(voucher) === 'chains') && (
                    <div className="mt-3">{brands.length > 0 ? <BrandStrip entries={brands} compact /> : <ParticipatingChains offer={voucher} guide={false} />}</div>
                  )}
                  {place && (
                    <p className="mt-3.5 flex items-start gap-1.5 text-sm text-muted">
                      <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} />
                      <span className="min-w-0 break-words" dir="auto">{place}</span>
                    </p>
                  )}
                  {destination && <NavigationLinks wide destination={destination} className="mt-3" />}
                  {/* Under the store's own branches: where else the voucher works (the whole Raayonit network). */}
                  {isRaayonitMultiChain(voucher) && voucher.perkScope !== 'multi_chain' && <div className="mt-4 border-t border-slate-100"><ChainsFold /></div>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
