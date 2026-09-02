'use client'

import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'

export default function BusinessPage() {
  return (
    <>
      <Navbar forceLocked />
      <div className="pt-16" dir="ltr">
        <div className="max-w-4xl mx-auto px-5 sm:px-6 py-8 sm:py-10">
          <Link href="/" className="tap-target flex items-center gap-2 text-brand font-bold mb-6 hover:underline">
            <i className="fa-solid fa-arrow-left"></i> Back
          </Link>
          <div className="text-center mb-10 sm:mb-12">
            <div className="text-4xl sm:text-5xl mb-4">🤝</div>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 mb-4" style={{ letterSpacing: '-1px' }}>Grow With Landly</h1>
            <p className="text-slate-500 max-w-xl mx-auto leading-relaxed text-[15px] sm:text-base">Landly connects high-quality international customers including expats, Masa interns, new Olim and tourists with reliable and trustworthy local Israeli businesses that offer fair and transparent pricing. Joining Landly means partnering with a growing community of engaged, loyal customers who are actively spending and exploring Israel.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-4 sm:gap-5 mb-10 sm:mb-12">
            <div className="bg-brandLight border border-brand/20 rounded-2xl p-5 sm:p-6 text-center">
              <div className="text-3xl mb-3">🎯</div>
              <h3 className="font-bold text-slate-900 mb-2">Targeted Exposure</h3>
              <p className="text-sm text-slate-500">Your business shown directly to 183K+ new arrivals who are actively looking for what you offer.</p>
            </div>
            <div className="bg-brandLight border border-brand/20 rounded-2xl p-5 sm:p-6 text-center">
              <div className="text-3xl mb-3">📈</div>
              <h3 className="font-bold text-slate-900 mb-2">Pay Only for Results</h3>
              <p className="text-sm text-slate-500">3 to 5 percent commission only on direct in-app sales. No hidden fees, no risk.</p>
            </div>
            <div className="bg-brandLight border border-brand/20 rounded-2xl p-5 sm:p-6 text-center">
              <div className="text-3xl mb-3">💬</div>
              <h3 className="font-bold text-slate-900 mb-2">Multilingual Reach</h3>
              <p className="text-sm text-slate-500">Your listing appears in Russian, French, Spanish, English and more, reaching customers in their own language.</p>
            </div>
          </div>
          <div className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-sm">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-2">Apply to Become a Partner</h2>
            <p className="text-slate-400 text-sm mb-6 sm:mb-7">Fill in your details and our partnerships team will be in touch within 48 hours.</p>
            <form action="https://formspree.io/f/xykrpjgo" method="POST" className="space-y-4">
              <input type="hidden" name="type" value="Business Partner Application" />
              <div className="grid sm:grid-cols-2 gap-4">
                <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Business Name</label><input type="text" name="business_name" required placeholder="Your business name" className="inp" /></div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Category</label>
                  <select name="category" className="inp">
                    <option value="">Select a category</option>
                    <option>Restaurants and Cafes</option><option>Beach and Sea</option><option>Attractions and Tours</option>
                    <option>Fashion and Shopping</option><option>Sport and Fitness</option><option>Israel and Global Tourism</option>
                    <option>Pampering Bundles</option><option>Beauty and Skincare</option>
                    <option>Home and Furnishing</option><option>Kids and Baby</option><option>Insurance and Savings</option><option>Other</option>
                  </select>
                </div>
                <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Contact Person</label><input type="text" name="contact_person" required placeholder="Full name" className="inp" /></div>
                <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Phone Number</label><input type="tel" name="phone" required placeholder="+972 50 000 0000" className="inp" /></div>
                <div className="sm:col-span-2"><label className="block text-sm font-semibold text-slate-700 mb-1.5">Email Address</label><input type="email" name="email" required placeholder="business@example.com" className="inp" /></div>
                <div className="sm:col-span-2"><label className="block text-sm font-semibold text-slate-700 mb-1.5">Tell us about your business (optional)</label><textarea name="message" rows={3} placeholder="Briefly describe your business and the type of offer you would like to make to Landly members..." className="inp resize-none"></textarea></div>
              </div>
              <button type="submit" className="tap-target w-full text-center justify-center bg-brand text-white font-bold py-3.5 rounded-full hover:bg-brandDark transition text-base mt-2 shadow-md">Submit Application</button>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}
