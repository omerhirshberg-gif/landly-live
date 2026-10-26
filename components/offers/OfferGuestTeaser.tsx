import { Lock } from 'lucide-react'
import IconFrame from '@/components/ui/IconFrame'
import { useLang } from '@/lib/i18n/useLang'

// What a guest sees on an offer page in place of How to redeem: the steps,
// counter instructions and terms are for members, so a short banner says so.
// The sign-in and join links sit right under it, in the purchase bar
// (OfferMemberGate), which sticks to the bottom of the screen on phones.
export default function OfferGuestTeaser() {
  const { t } = useLang()

  return (
    <div className="flex items-start gap-3.5 rounded-2xl border border-brand/15 bg-brandTint p-4 sm:p-5">
      <IconFrame icon={Lock} size="sm" tone="white" className="shadow-sm" />
      <div className="min-w-0">
        <h2 className="text-copy font-bold text-ink">{t('offer_teaser_title')}</h2>
        <p className="mt-1 text-sm leading-relaxed text-body">{t('offer_teaser_message')}</p>
      </div>
    </div>
  )
}
