'use client'

import { useEffect } from 'react'
import Navbar from '@/components/layout/Navbar'
import ErrorScreen from '@/components/errors/ErrorScreen'
import { useLang } from '@/lib/i18n/useLang'

// Runtime errors below the root layout, so the providers (and the visitor's
// language) are still available. In production the message is generic; the
// digest matches the server log entry, so support can look it up.
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { t } = useLang()

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <>
      <Navbar />
      <ErrorScreen
        icon="fa-triangle-exclamation"
        title={t('err_title')}
        body={t('err_body')}
        primary={{ label: t('err_retry'), icon: 'fa-rotate-right', onClick: () => retry() }}
        secondary={{ label: t('err_home'), icon: 'fa-house', href: '/' }}
        footnote={error.digest ? `${t('err_ref')} ${error.digest}` : undefined}
      />
    </>
  )
}
