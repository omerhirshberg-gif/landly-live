import { doc, getDoc } from 'firebase/firestore'
import { db } from './config'

export interface BusinessDocument {
  businessName: string
  businessId: string // ח.פ — display/reference only, never used for authentication
  category: string
  location: string // free-text city/address for now, not coordinates
  voucherStats: {
    redeemedTotal: number
    redeemedThisMonth: number
    active: number
  }
}

// Business accounts are created manually in the Firebase Console (Auth user +
// this Firestore doc, same uid) — there's no in-app signup, so no writer here.
export async function getBusinessDocument(uid: string): Promise<BusinessDocument | null> {
  const snap = await getDoc(doc(db, 'businesses', uid))
  if (!snap.exists()) return null
  const data = snap.data()
  const voucherStats = data.voucherStats ?? {}
  return {
    businessName: data.businessName ?? '',
    businessId: data.businessId ?? '',
    category: data.category ?? '',
    location: data.location ?? '',
    voucherStats: {
      redeemedTotal: Number(voucherStats.redeemedTotal) || 0,
      redeemedThisMonth: Number(voucherStats.redeemedThisMonth) || 0,
      active: Number(voucherStats.active) || 0,
    },
  }
}
