import { router } from 'expo-router'
import type { VoucherDocument } from '@shared/firebase/vouchers'

type Voucher = VoucherDocument & { id: string }

// Passes already on screen (My Pass), by id, so the pushed voucher screen
// draws the tapped pass at once and its live listener only refreshes it
// behind the scenes (the same handoff as openOffer for perks).
const seen = new Map<string, Voucher>()

export function cachedVoucher(voucherId: string): Voucher | undefined {
  return seen.get(voucherId)
}

export function openVoucher(voucher: Voucher) {
  seen.set(voucher.id, voucher)
  router.push({ pathname: '/voucher/[voucherId]', params: { voucherId: voucher.id } })
}
