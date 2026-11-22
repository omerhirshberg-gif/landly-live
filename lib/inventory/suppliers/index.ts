import 'server-only'
import type { SupplierId } from '../ledger/types'
import { MultipassAdapter } from './MultipassAdapter'
import { RaayonitAdapter } from './RaayonitAdapter'
import type { SupplierAdapter } from './SupplierAdapter'

export function getSupplierAdapter(id: SupplierId): SupplierAdapter {
  return id === 'multipass' ? new MultipassAdapter() : new RaayonitAdapter()
}
