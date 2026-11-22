import 'server-only'
import { randomInt } from 'node:crypto'
import { Timestamp, type DocumentData, type Firestore } from 'firebase-admin/firestore'
import { addPoolCodes } from '@/lib/inventory/poolAdmin'
import { encryptVoucherCode, hashCode } from '@/lib/inventory/ledger/codes'
import { countInStock } from '@/lib/inventory/ledger/stock'
import { sandboxDemoVoucherData } from '@/lib/inventory/ledger/transitions'
import { EVENTS_COLLECTION, PRODUCTS_COLLECTION, VOUCHERS_COLLECTION } from '@/lib/inventory/ledger/types'
import { POOL_COLLECTION } from '@/lib/inventory/types'
import { findVariant, parseVariants } from '@/lib/offers/variants'
import { isPaymentSandboxEnabled } from './devSandbox'
import { isDocumentId } from './paymentValidation'

// Dev sandbox only (lib/payments/devSandbox.ts): a Raayonit voucher value whose stock is empty in the staging project (a freshly added 200 or 150
// value has no uploaded codes) would refuse every test purchase. So a sandbox checkout tops the empty stock up with a few clearly fake
// codes, `RAAYONIT-DEMO-{value}-{XXXX}`. It does nothing when the sandbox is off (production, or a real payment terminal), and nothing
// when the stock already has codes. Both inventories are covered: the ledger product, or the older couponPools stock.
export const DEMO_CODES_PER_TOPUP = 5
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export const demoCode = (faceValueAgorot: number, suffix: string): string => `RAAYONIT-DEMO-${Math.round(faceValueAgorot / 100)}-${suffix}`
const randomSuffix = (): string => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')

export async function ensureSandboxDemoStock(db: Firestore, offer: DocumentData | undefined, variantPoolId: string | null): Promise<{ topped: number }> {
  if (!isPaymentSandboxEnabled() || !offer || offer.fulfillmentType !== 'raayonit_pool') return { topped: 0 }
  const variant = findVariant(parseVariants(offer.variants), variantPoolId)
  const poolId = variant ? variant.poolId : offer.poolId
  if (!isDocumentId(poolId)) return { topped: 0 }
  const codes = (face: number) => Array.from({ length: DEMO_CODES_PER_TOPUP }, () => demoCode(face, randomSuffix()))

  const productSnap = await db.collection(PRODUCTS_COLLECTION).doc(poolId).get()
  const product = productSnap.data()
  if (product && product.active !== false && product.issueMode !== 'dynamic') {
    if ((await countInStock(db, poolId)) > 0) return { topped: 0 }
    const face = Number(product.faceValueAgorot)
    const now = Timestamp.now()
    let topped = 0
    for (const code of codes(face)) {
      const id = hashCode(code)
      const ref = db.collection(VOUCHERS_COLLECTION).doc(id)
      const data = sandboxDemoVoucherData({ productId: poolId, supplierId: 'raayonit', codeEncrypted: encryptVoucherCode(code, id), codeHash: id, faceValueAgorot: face, expiresAt: null, importBatchId: 'sandbox-demo' }, now)
      await db.runTransaction(async (tx) => {
        if ((await tx.get(ref)).exists) return
        tx.create(ref, data)
        tx.create(db.collection(EVENTS_COLLECTION).doc(), { voucherId: id, type: 'IMPORTED', fromStatus: 'STAGED', toStatus: 'IN_STOCK', amountAgorot: 0, businessId: null, source: 'system', externalEventId: null, occurredAt: now, meta: { sandboxDemo: true } })
        topped++
      })
    }
    return { topped }
  }

  const pool = (await db.collection(POOL_COLLECTION).doc(poolId).get()).data()
  if (!pool || pool.kind !== 'shared' || (Number(pool.remainingCount) || 0) > 0) return { topped: 0 }
  const res = await addPoolCodes(db, poolId, codes(Number(pool.faceValueAgorot)))
  return { topped: res.added }
}
