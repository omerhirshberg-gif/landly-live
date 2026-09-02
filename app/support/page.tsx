'use client'

import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import { useLang } from '@/lib/i18n/useLang'

export default function SupportPage() {
  const { t } = useLang()

  return (
    <>
      <Navbar />
      <div className="pt-16">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 py-8 sm:py-10">
          <Link href="/" className="tap-target flex items-center gap-2 text-brand font-bold mb-6 hover:underline">
            <i className="fa-solid fa-arrow-left"></i> <span>{t('back_btn')}</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mb-8">{t('support_title')}</h1>

          <div className="grid sm:grid-cols-2 gap-4 sm:gap-5 mb-8 sm:mb-10">
            <div className="bg-brandLight border border-brand/20 rounded-2xl p-5">
              <div className="text-2xl mb-2">📧</div>
              <div className="font-bold text-slate-900 mb-1">{t('support_email_us')}</div>
              <a href="mailto:contact@landly.io" className="text-brand text-sm font-semibold hover:underline">contact@landly.io</a>
              <p className="text-xs text-slate-500 mt-2">{t('support_email_note')}</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
              <div className="text-2xl mb-2">💬</div>
              <div className="font-bold text-slate-900 mb-1">{t('support_whatsapp')}</div>
              <p className="text-sm text-slate-600">{t('support_whatsapp_note')}</p>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl p-6 sm:p-8 shadow-sm">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-6">{t('support_form_title')}</h2>
            <form action="https://formspree.io/f/xykrpjgo" method="POST" className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('form_name')}</label><input type="text" name="name" required placeholder={t('form_name_ph')} className="inp" /></div>
                <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('form_email')}</label><input type="email" name="email" required placeholder="your@email.com" className="inp" /></div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('form_subject')}</label>
                <select name="subject" className="inp">
                  <option>{t('subj_general')}</option><option>{t('subj_billing')}</option>
                  <option>{t('subj_card')}</option><option>{t('subj_voucher')}</option>
                  <option>{t('subj_raffle')}</option><option>{t('subj_partner')}</option><option>{t('subj_aliyah')}</option>
                </select>
              </div>
              <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('form_message')}</label><textarea name="message" rows={4} required placeholder={t('form_message_ph')} className="inp resize-none"></textarea></div>
              <button type="submit" className="tap-target w-full text-center justify-center bg-brand text-white font-bold py-3 rounded-full hover:bg-brandDark transition shadow-md">{t('btn_send_message')}</button>
            </form>
          </div>

          <div className="mt-8 bg-slate-50 rounded-2xl p-5">
            <h3 className="font-bold text-slate-900 mb-3">{t('support_faq_links')}</h3>
            <div className="space-y-2 text-sm">
              <Link href="/#faq" className="block text-brand hover:underline">{t('faq1_q')}</Link>
              <Link href="/#faq" className="block text-brand hover:underline">{t('faq4_q')}</Link>
              <Link href="/#faq" className="block text-brand hover:underline">{t('faq5_q')}</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
