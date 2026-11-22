import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase/admin'
import { cronAuthError } from '@/lib/inventory/ledger/cronAuth'
import { releaseExpiredReservations } from '@/lib/inventory/ledger/stock'
import { safeErrorText } from '@/lib/inventory/ledger/codes'

// Every 5 minutes (vercel.json): RESERVED -> IN_STOCK for every checkout hold older than its 15 minutes.
export const maxDuration = 60

export async function GET(request: Request) {
  const denied = cronAuthError(request, 'inventory-release')
  if (denied) return denied
  try {
    return NextResponse.json({ ok: true, released: await releaseExpiredReservations(getAdminDb()) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[inventory-release] failed', safeErrorText(error))
    return NextResponse.json({ error: 'The release could not run.' }, { status: 502 })
  }
}
