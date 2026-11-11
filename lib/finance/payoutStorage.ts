import 'server-only'
import { getAdminBucket } from '@/lib/firebase/admin'
import type { FileStore } from './settlement'

/** Payout files live under payouts/ in the private bucket (storage.rules: no client access). */
export const payoutFileStore: FileStore = {
  async save(path, bytes, contentType) {
    await getAdminBucket().file(path).save(Buffer.from(bytes), { contentType, resumable: false, metadata: { cacheControl: 'private, no-store' } })
  },
  async read(path) {
    const [data] = await getAdminBucket().file(path).download()
    return new Uint8Array(data)
  },
}
