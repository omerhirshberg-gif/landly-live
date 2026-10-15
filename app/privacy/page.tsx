import type { Metadata } from 'next'
import Navbar from '@/components/layout/Navbar'
import PrivacyPolicy from '@/components/legal/PrivacyPolicy'

// A server component: the whole policy is in the first HTML response, so it
// reads without JavaScript (in-app browsers, Google's OAuth reviewers).
export const metadata: Metadata = {
  title: 'Privacy Policy — Landly',
  description:
    'How Landly Ltd. collects, uses, shares, protects and deletes personal information, including Google user data received through Sign in with Google.',
  alternates: { canonical: 'https://www.golandly.com/privacy' },
  robots: { index: true, follow: true },
}

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main
        className="min-h-screen bg-[#F8FAFC] pt-16 overflow-x-hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div
          className="mx-auto w-full max-w-[832px] py-6 sm:py-12"
          style={{ paddingLeft: 'max(16px, env(safe-area-inset-left))', paddingRight: 'max(16px, env(safe-area-inset-right))' }}
        >
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-12 shadow-sm">
            <PrivacyPolicy />
          </div>
        </div>
      </main>
    </>
  )
}
