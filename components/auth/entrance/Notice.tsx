import type { ReactNode } from 'react'

// Web counterpart of landly-mobile/src/components/Notice.tsx.
export default function Notice({ children, tone = 'error' }: { children: ReactNode; tone?: 'error' | 'success' }) {
  const error = tone === 'error'
  return (
    <div
      role="alert"
      className={`mb-4 rounded-xl border px-4 py-3 text-sm font-semibold ${
        error ? 'bg-red-50 border-red-200 text-red-600' : 'bg-green-50 border-green-200 text-green-700'
      }`}
    >
      {children}
    </div>
  )
}
