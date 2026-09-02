'use client'

import { useState } from 'react'
import { useLang } from '@/lib/i18n/useLang'

export default function Waitlist() {
  const { t } = useLang()
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    try {
      const res = await fetch('https://formspree.io/f/xykrpjgo', {
        method: 'POST',
        body: data,
        headers: { Accept: 'application/json' },
      })
      if (res.ok) setSubmitted(true)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <section id="waitlist" className="py-14 sm:py-20 bg-brand">
      <div className="max-w-2xl mx-auto px-5 sm:px-6 text-center">
        <div className="text-[11px] font-bold tracking-widest text-blue-200 uppercase mb-4">{t('wl_label')}</div>
        <h2 className="text-3xl sm:text-4xl font-black text-white mb-4" style={{ letterSpacing: '-1px' }}>{t('wl_title')}</h2>
        <p className="text-blue-100 mb-8 sm:mb-10 leading-relaxed">{t('wl_sub')}</p>
        {!submitted && (
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              name="email"
              placeholder="your@email.com"
              required
              className="inp flex-1 !bg-white/12 !border-white/28 !text-white placeholder-blue-200 !min-h-[50px]"
              style={{ background: 'rgba(255,255,255,.12)', borderColor: 'rgba(255,255,255,.28)', color: '#fff' }}
            />
            <button type="submit" className="tap-target bg-white text-brand font-bold px-7 py-4 rounded-full hover:bg-brandLight transition whitespace-nowrap shadow-lg">{t('wl_cta')}</button>
          </form>
        )}
        {submitted && (
          <p className="mt-5 text-emerald-300 font-semibold">Welcome to Landly! We will be in touch very soon.</p>
        )}
        <p className="text-blue-200/70 text-xs mt-4">No spam. Unsubscribe at any time.</p>
      </div>
    </section>
  )
}
