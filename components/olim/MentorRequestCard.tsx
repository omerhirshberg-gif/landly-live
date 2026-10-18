'use client'

import { useAuth } from '@/lib/firebase/useAuth'
import { useLang } from '@/lib/i18n/useLang'
import MentorAuthGate from './MentorAuthGate'
import MentorRequestForm from './MentorRequestForm'

// The brand-blue "Connect with a Personal Mentor" card on /olim. The mentor
// service is for members only (/api/mentor/inquiry answers 401 without a
// session), so guests see the heading and a sign-up gate, and members the
// request form. Login and signup links come back to #mentor.
export default function MentorRequestCard() {
  const { t } = useLang()
  const { user, loading } = useAuth()

  return (
    <section id="mentor" aria-labelledby="mentor-title" className="scroll-mt-20 bg-brand rounded-3xl p-6 sm:p-8 text-white">
      <h2 id="mentor-title" className="text-xl sm:text-2xl font-black mb-2">{t('olim_mentor_form_title')}</h2>
      <p className="text-blue-100 text-sm mb-6">{t('olim_mentor_form_sub')}</p>
      {loading ? (
        // Holds the form's height so neither state flashes while auth resolves.
        <div role="status" className="min-h-[13rem] rounded-2xl bg-white/10 animate-pulse motion-reduce:animate-none">
          <span className="sr-only">{t('bizdash_loading')}</span>
        </div>
      ) : user ? (
        <MentorRequestForm user={user} />
      ) : (
        <MentorAuthGate />
      )}
    </section>
  )
}
