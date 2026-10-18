import { useLang } from '@/lib/i18n/useLang'

// What a guest sees on an offer page in place of How to redeem: the steps,
// counter instructions and terms are for members, so a short banner says so.
// The sign-in and join links sit right under it, in the purchase bar
// (OfferMemberGate), which sticks to the bottom of the screen on phones.
export default function OfferGuestTeaser() {
  const { t } = useLang()

  return (
    <div className="flex items-start gap-3.5 rounded-2xl border border-brand/15 bg-[#F0F7FF] p-4 sm:p-5">
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white text-brand shadow-sm" aria-hidden="true">
        <i className="fa-solid fa-lock"></i>
      </span>
      <div className="min-w-0">
        <h2 className="text-[15px] font-bold text-[#0B1B3D]">{t('offer_teaser_title')}</h2>
        <p className="mt-1 text-sm leading-relaxed text-[#475569]">{t('offer_teaser_message')}</p>
      </div>
    </div>
  )
}
