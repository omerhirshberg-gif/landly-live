import { Linking } from 'react-native'
import type { OfferDocument } from '@shared/firebase/offers'
import { API_BASE_URL } from './env'

// Checkout (Tranzila) runs on the website; the voucher it creates then
// appears live in the My Pass tab.
export function openOffer(offer: OfferDocument) {
  Linking.openURL(`${API_BASE_URL}/offers/${offer.id}`)
}
