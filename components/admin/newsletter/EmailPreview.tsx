'use client'

import { useEffect, useState } from 'react'
import { adminFetch } from '@/lib/admin/adminSession'
import { useAdminT } from '@/lib/admin/translations'
import Card from '@/components/admin/Card'
import type { AudienceLang, ContentState } from './types'

type Device = 'desktop' | 'mobile'

// The exact email a recipient gets: the server renders it with the sender's
// own template, and it is shown in a sandboxed iframe (no scripts, no
// navigation) at desktop width or phone width.
export default function EmailPreview({ content, lang }: { content: ContentState; lang: AudienceLang }) {
  const { t } = useAdminT()
  const [device, setDevice] = useState<Device>('desktop')
  const [html, setHtml] = useState('')
  const [subject, setSubject] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await adminFetch('/api/admin/newsletter/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...content, lang: lang === 'all' ? 'en' : lang }),
          signal: controller.signal,
        })
        if (!res.ok) return
        const data = (await res.json()) as { html: string; subject: string }
        setHtml(data.html)
        setSubject(data.subject)
      } catch {
        // Aborted by a newer keystroke, or offline: keep the last preview.
      }
    }, 300)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [content, lang])

  const tab = (value: Device, label: string, icon: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={device === value}
      onClick={() => setDevice(value)}
      className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors ${device === value ? 'bg-adm-surface text-adm-text shadow-sm' : 'text-adm-muted hover:text-adm-text'}`}
    >
      <i className={`fa-solid ${icon}`} aria-hidden="true" />
      {label}
    </button>
  )

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-adm-line/80 px-4 py-3 sm:px-5">
        <h2 className="text-base font-bold tracking-tight text-adm-text">{t('newsletter.preview')}</h2>
        <div role="tablist" aria-label={t('newsletter.preview')} className="flex gap-1 rounded-xl bg-adm-raised p-1">
          {tab('desktop', t('newsletter.preview.desktop'), 'fa-desktop')}
          {tab('mobile', t('newsletter.preview.mobile'), 'fa-mobile-screen')}
        </div>
      </div>
      <div className="border-b border-adm-line/80 px-4 py-3 text-sm sm:px-5">
        <span className="text-adm-muted">{t('newsletter.preview.subject')}: </span>
        <bdi dir="auto" className="font-semibold text-adm-text">{subject || '—'}</bdi>
      </div>
      <div className="bg-adm-sunken p-3 sm:p-5">
        <div style={{ backgroundColor: '#fff' }} className={`mx-auto overflow-hidden rounded-2xl border border-adm-line shadow-sm ${device === 'mobile' ? 'max-w-[390px]' : 'max-w-[640px]'}`}>
          <iframe
            title={t('newsletter.preview.title')}
            sandbox=""
            srcDoc={html}
            className="block h-[640px] w-full border-0"
          />
        </div>
      </div>
    </Card>
  )
}
