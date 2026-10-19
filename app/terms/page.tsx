import type { Metadata } from 'next'
import { Suspense } from 'react'
import Navbar from '@/components/layout/Navbar'
import BackToSettings from '@/components/settings/BackToSettings'
import TermsContent from '@/components/legal/TermsContent'

// Same shell as /privacy. The terms text lives in the i18n table, so the
// content itself is a client component; this server page owns the metadata.
export const metadata: Metadata = {
  title: 'Terms and Conditions',
  description: 'Landly payments, refund policy, voucher rules, governing law and contact details.',
  alternates: { canonical: 'https://www.golandly.com/terms' },
  robots: { index: true, follow: true },
}

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main
        className="member-canvas below-header overflow-x-hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div
          className="mx-auto w-full max-w-[832px] py-6 sm:py-12"
          style={{ paddingLeft: 'max(16px, env(safe-area-inset-left))', paddingRight: 'max(16px, env(safe-area-inset-right))' }}
        >
          <Suspense fallback={null}>
            <BackToSettings className="mb-3 sm:mb-6" />
          </Suspense>
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 sm:p-12 shadow-[0_1px_2px_rgba(15,23,42,.04),0_8px_24px_rgba(15,23,42,.06)]">
            <TermsContent />
          </div>
        </div>
      </main>
    </>
  )
}
