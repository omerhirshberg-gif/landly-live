import type { ReactNode } from 'react'

const TONES = {
  error: 'bg-red-50 border-red-200 text-red-600',
  success: 'bg-green-50 border-green-200 text-green-700',
  info: 'bg-blue-50 border-blue-200 text-brand',
} as const

// Web counterpart of landly-mobile/src/components/Notice.tsx. `info` is a
// progress line ("Sending…"), announced politely rather than as an alert.
export default function Notice({ children, tone = 'error' }: { children: ReactNode; tone?: keyof typeof TONES }) {
  return (
    <div
      role={tone === 'info' ? 'status' : 'alert'}
      className={`mb-4 rounded-xl border px-4 py-3 text-sm font-semibold ${TONES[tone]}`}
    >
      {children}
    </div>
  )
}
