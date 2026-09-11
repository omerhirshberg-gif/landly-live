'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase/config'
import { useLang } from '@/lib/i18n/useLang'

// Minimal header for business-owner pages: logo + business name + logout only —
// no customer nav links, no language switcher (see components/layout/Navbar.tsx
// for the full customer header this deliberately does not reuse).
export default function BusinessHeader({ businessName }: { businessName: string }) {
  const { t } = useLang()
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut(auth)
    router.push('/business/login')
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-[1000] bg-slate-950/95 backdrop-blur-sm border-b border-slate-800 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <Link href="/business/dashboard" className="flex items-center gap-2">
          <img src="/logo-mark.png" alt="Landly" className="h-8 w-auto" />
          <span className="font-black text-white truncate max-w-[40vw]">{businessName}</span>
        </Link>
        <button
          onClick={handleSignOut}
          className="tap-target text-sm font-bold text-slate-400 hover:text-red-400 transition flex items-center gap-1.5"
        >
          <i className="fa-solid fa-arrow-right-from-bracket"></i>
          <span>{t('bizdash_logout')}</span>
        </button>
      </div>
    </nav>
  )
}
