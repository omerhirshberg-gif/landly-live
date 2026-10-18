'use client'

import { useEffect, useState } from 'react'

interface Props {
  children: string
  className?: string
}

const ICON_BUTTON =
  'inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-[#94A3B8] transition-colors hover:bg-[#F0F7FF] hover:text-[#0038B8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0038B8]'

// Masks a sensitive value (e.g. a freshly-created login password) behind a
// reveal toggle instead of printing it to the screen by default.
export default function RevealableText({ children, className }: Props) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="flex items-center gap-1">
      <span className={`min-w-0 break-all ${className ?? ''}`} dir="ltr">
        {visible ? children : '•'.repeat(Math.max(children.length, 8))}
      </span>
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className={ICON_BUTTON}
        aria-label={visible ? 'Hide' : 'Reveal'}
        aria-pressed={visible}
      >
        <i className={`fa-solid ${visible ? 'fa-eye-slash' : 'fa-eye'} text-sm`} aria-hidden="true" />
      </button>
      <CopyButton value={children} />
    </div>
  )
}

/**
 * Copies a value without showing it. The Clipboard API needs a secure
 * context (https or localhost), so on a LAN http address this reports a
 * failure and the admin falls back to Reveal.
 */
export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle')

  useEffect(() => {
    if (status === 'idle') return
    const timer = setTimeout(() => setStatus('idle'), 2000)
    return () => clearTimeout(timer)
  }, [status])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setStatus('copied')
    } catch {
      setStatus('failed')
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={ICON_BUTTON}
      aria-label={status === 'copied' ? 'Copied' : status === 'failed' ? 'Copy failed' : label}
    >
      <i
        className={`fa-solid ${status === 'copied' ? 'fa-check text-emerald-600' : status === 'failed' ? 'fa-xmark text-[#B91C1C]' : 'fa-copy'} text-sm`}
        aria-hidden="true"
      />
      <span className="sr-only" aria-live="polite">
        {status === 'copied' ? 'Copied' : status === 'failed' ? 'Copy failed' : ''}
      </span>
    </button>
  )
}
