import 'server-only'
import { SupplierUnsupportedError, type BalanceResult, type IssuedCode, type OrderItem, type SupplierAdapter, type SupplierBusiness, type SupplierRedemption } from './SupplierAdapter'
import { stageBatch, type StageInput } from '../ledger/importBatch'
import { getAdminDb } from '@/lib/firebase/admin'
import { fetchRaayonitDirectory } from './raayonitDirectory'

// Raayonit sells pre-bought codes: there is no issue, balance or redemption API. Stock arrives as the two-column sheet
// (importStock = the batch importer), balances are our own ledger, and the only thing read from them is the public
// "תו על" directory, which the daily 04:00 sync diffs into businessChanges.
export class RaayonitAdapter implements SupplierAdapter {
  readonly id = 'raayonit' as const

  importStock(input: Omit<StageInput, 'supplierId'>) {
    return stageBatch(getAdminDb(), { ...input, supplierId: 'raayonit' })
  }
  async issue(_item: OrderItem): Promise<IssuedCode> {
    throw new SupplierUnsupportedError('raayonit', 'issuing at the sale (it sells pre-bought stock)')
  }
  async checkBalance(ref: { ledgerBalanceAgorot?: number }): Promise<BalanceResult> {
    return { balanceAgorot: typeof ref.ledgerBalanceAgorot === 'number' ? ref.ledgerBalanceAgorot : null, source: 'ledger' }
  }
  async getRedemptions(): Promise<SupplierRedemption[]> {
    return []
  }
  async voidCode(): Promise<{ confirmed: boolean }> {
    // No API: a void is confirmed by hand with Raayonit, then recorded by an admin.
    return { confirmed: false }
  }
  async syncBusinesses(): Promise<SupplierBusiness[]> {
    return fetchRaayonitDirectory()
  }
}
