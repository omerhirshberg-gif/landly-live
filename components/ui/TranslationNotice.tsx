'use client'

import { Languages } from 'lucide-react'
import { useLang } from '@/lib/i18n/useLang'

// The attribution under machine-translated content: "Translated by Google ·
// Show original", the switch flipping to "Show translation". Google's name
// sits in a <bdi> so a Hebrew line doesn't reorder it, and the whole line
// follows the page's direction. Shown only when something on screen really
// is Google's wording (useLocalizedContent's `machine`). Expo app:
// landly-mobile/src/components/TranslationNotice.tsx.
export default function TranslationNotice({
  showingOriginal,
  onToggle,
  className = '',
}: {
  showingOriginal: boolean
  onToggle: () => void
  className?: string
}) {
  const { t } = useLang()
  return (
    <p className={`flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted ${className}`}>
      <Languages aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
      <bdi>{t('content_translated_by_google')}</bdi>
      <span aria-hidden="true">·</span>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={showingOriginal}
        className="tap-target -my-2 inline-flex min-h-11 items-center font-semibold text-brand [-webkit-tap-highlight-color:transparent] [@media(hover:hover)]:hover:underline"
      >
        {showingOriginal ? t('content_show_translation') : t('content_show_original')}
      </button>
    </p>
  )
}
