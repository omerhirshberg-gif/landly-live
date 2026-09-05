'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Dev-only route (no nav entry) for previewing /checkout/success with mock
// order data, since nothing in the real flow can generate real order params
// until Tranzila is wired up. Delete this once the real checkout flow exists
// and can be used to reach the success page instead.
export default function CheckoutSuccessPreviewPage() {
  const router = useRouter()

  useEffect(() => {
    const mockExpiresAt = new Date()
    mockExpiresAt.setFullYear(mockExpiresAt.getFullYear() + 1)

    const params = new URLSearchParams({
      orderId: 'LDLY-0000-DEV',
      plan: 'annual',
      amount: '348',
      expiresAt: mockExpiresAt.toISOString(),
    })
    router.replace(`/checkout/success?${params.toString()}`)
  }, [router])

  return null
}
