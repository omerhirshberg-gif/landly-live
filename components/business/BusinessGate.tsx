'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase/config'
import { useAuth } from '@/lib/firebase/useAuth'
import { getBusinessDocument, BusinessDocument } from '@/lib/firebase/businesses'

interface BusinessContextValue {
  business: BusinessDocument
}

const BusinessContext = createContext<BusinessContextValue | null>(null)

export function useBusiness() {
  const ctx = useContext(BusinessContext)
  if (!ctx) throw new Error('useBusiness must be used within BusinessGate')
  return ctx
}

// Gates every /business/dashboard/* page behind a signed-in business account
// and loads its Firestore doc once, sharing it via context so pages don't
// each re-fetch it. This is a UX gate only, not the security boundary -- the
// API routes each page calls (/api/business/*) independently re-derive the
// business from the caller's Firebase ID token, so they stay safe even if a
// page here were skipped or reached directly.
export default function BusinessGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [business, setBusiness] = useState<BusinessDocument | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (!loading && !user) router.replace('/business/login')
  }, [loading, user, router])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    getBusinessDocument(user.uid).then(async (doc) => {
      if (cancelled) return
      if (!doc) {
        await signOut(auth)
        router.replace('/business/login')
        return
      }
      setBusiness(doc)
      setChecking(false)
    })
    return () => {
      cancelled = true
    }
  }, [user, router])

  if (loading || !user || checking || !business) {
    return <div className="min-h-screen bg-slate-950" />
  }

  return <BusinessContext.Provider value={{ business }}>{children}</BusinessContext.Provider>
}
