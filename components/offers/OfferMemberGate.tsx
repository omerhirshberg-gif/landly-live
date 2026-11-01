import Link from 'next/link'
import { Lock } from 'lucide-react'
import IconFrame from '@/components/ui/IconFrame'
import { withRedirect } from '@/lib/auth/safeRedirect'
import { useLang } from '@/lib/i18n/useLang'

// What a guest sees on an offer page under the About fold, in place of How to
// redeem, the fine print and the Buy button: one locked card that says the steps, terms and codes are for members
// and leads with joining. Both links come back to this offer afterwards.
export default function OfferMemberGate({ offerId }: { offerId: string }) {
  const { t } = useLang()
  const back = `/offers/${encodeURIComponent(offerId)}`

  return (
    <div className="flex flex-col items-center rounded-2xl border border-slate-200/80 bg-slate-50/70 p-6 text-center sm:p-7 fold:bg-white">
      <IconFrame icon={Lock} size="sm" tone="white" className="shadow-sm" />
      <h2 className="mt-4 text-base font-bold text-ink">{t('offer_teaser_title')}</h2>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-body">{t('offer_teaser_message')}</p>
      <Link href={withRedirect('/signup', back)} className="ds-btn ds-btn-primary ds-btn-wrap mt-5 w-full max-w-sm">
        <span>{t('landing_cta_join')}</span>
      </Link>
      <Link
        href={withRedirect('/login', back)}
        className="tap-target mt-1 flex items-center justify-center text-sm font-semibold text-brand [@media(hover:hover)]:hover:underline"
      >
        {t('nav_login')}
      </Link>
    </div>
  )
}
