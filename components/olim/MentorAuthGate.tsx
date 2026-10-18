import Link from 'next/link'
import { withRedirect } from '@/lib/auth/safeRedirect'
import { useLang } from '@/lib/i18n/useLang'

// Where /login and /signup bring a guest back to: the mentor card itself.
export const MENTOR_RETURN_PATH = '/olim#mentor'

// The guest state of the mentor card: no form (nothing a guest can submit),
// just why the service is members-only and the way in.
export default function MentorAuthGate() {
  const { t } = useLang()

  return (
    <div className="rounded-2xl border border-white/25 bg-white/10 p-5 sm:p-6">
      <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wide">
        <i className="fa-solid fa-lock" aria-hidden="true"></i>
        {t('olim_gate_badge')}
      </span>
      <p className="mt-4 mb-6 text-[15px] leading-relaxed text-white">{t('olim_gate_message')}</p>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
        <Link
          href={withRedirect('/signup', MENTOR_RETURN_PATH)}
          className="tap-target flex items-center justify-center text-center bg-white text-brand font-bold py-3.5 px-8 rounded-full hover:bg-brandLight transition shadow-lg focus-visible:outline-white"
        >
          {t('olim_gate_signup')}
        </Link>
        <Link
          href={withRedirect('/login', MENTOR_RETURN_PATH)}
          className="tap-target flex items-center justify-center text-center py-2 font-semibold text-white underline-offset-4 hover:underline focus-visible:outline-white"
        >
          {t('olim_gate_login')}
        </Link>
      </div>
    </div>
  )
}
