import Link from 'next/link'
import { withRedirect } from '@/lib/auth/safeRedirect'
import { useLang } from '@/lib/i18n/useLang'

// The guest state of an offer's purchase bar: guests can read the whole perk
// but buying (and any voucher) is for members, so the Buy button gives way to
// sign-in and join links that come back to this offer afterwards.
export default function OfferMemberGate({ offerId }: { offerId: string }) {
  const { t } = useLang()
  const back = `/offers/${encodeURIComponent(offerId)}`

  return (
    <div className="flex flex-col items-stretch gap-1">
      <Link href={withRedirect('/login', back)} className="tap-target btn-primary w-full text-center">
        <i className="fa-solid fa-lock text-sm" aria-hidden="true"></i>
        <span>{t('offer_gate_signin')}</span>
      </Link>
      <Link
        href={withRedirect('/signup', back)}
        className="tap-target flex items-center justify-center text-center text-sm font-semibold text-brand hover:underline"
      >
        {t('offer_gate_join')}
      </Link>
    </div>
  )
}
