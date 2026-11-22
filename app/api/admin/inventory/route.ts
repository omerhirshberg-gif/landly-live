import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { getAdminDb } from '@/lib/firebase/admin'
import { cipherKeyConfigured } from '@/lib/crypto/fieldCipher'
import { isRaayonitDisplayEnabled } from '@/lib/flags/featureFlags.server'
import { readLedgerOverview } from '@/lib/inventory/ledger/adminData'
import { safeErrorText } from '@/lib/inventory/ledger/codes'
import { isMultipassConfigured } from '@/lib/inventory/suppliers/MultipassAdapter'

// The ledger tabs' data: products with their status counts, the latest import batches, open alerts, pending business changes.
export async function GET(request: Request) {
  const denied = requireAdminAuth(request)
  if (denied) return denied
  try {
    const [overview, raayonitDisplay] = await Promise.all([readLedgerOverview(getAdminDb()), isRaayonitDisplayEnabled()])
    return NextResponse.json({ ...overview, raayonitDisplay, encryptionConfigured: cipherKeyConfigured('POOL_CODES_KEY'), multipassConfigured: isMultipassConfigured() })
  } catch (error) {
    console.error('Ledger overview failed', safeErrorText(error))
    return NextResponse.json({ error: 'Could not load the inventory ledger.' }, { status: 500 })
  }
}
