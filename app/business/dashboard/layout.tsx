'use client'

import { useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import BusinessGate from '@/components/business/BusinessGate'
import Sidebar from '@/components/business/Sidebar'
import SidebarShell from '@/components/layout/SidebarShell'
import { BusinessLangProvider, useBusinessLang } from '@/lib/business/BusinessLangProvider'
import { auth } from '@/lib/firebase/config'

// dir is set here, scoped to this subtree only -- not on document.documentElement
// like the site-wide LangProvider does -- so the business language toggle can
// never flip direction for the rest of the app.
function DashboardBody({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { isRtl } = useBusinessLang()

  const logout = async () => {
    await signOut(auth)
    router.push('/business/login')
  }

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'}>
      <BusinessGate>
        <SidebarShell sidebar={<Sidebar onLogout={logout} />}>{children}</SidebarShell>
      </BusinessGate>
    </div>
  )
}

export default function BusinessDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <BusinessLangProvider>
      <DashboardBody>{children}</DashboardBody>
    </BusinessLangProvider>
  )
}
