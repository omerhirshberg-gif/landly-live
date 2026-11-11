import { describe, expect, it } from 'vitest'
import { voucherDestination } from '@/lib/member/voucherDestination'

const address = { placeId: 'p1', formatted: { en: 'Dizengoff St 50, Tel Aviv-Yafo, Israel', he: 'דיזנגוף 50, תל אביב-יפו' }, short: { en: 'Dizengoff St 50, Tel Aviv-Yafo' } }

describe('voucherDestination', () => {
  it('uses the short address, then the full one, in the reader’s language, with the frozen position', () => {
    expect(voucherDestination({ businessAddress: address, businessGeo: { lat: 32.08, lng: 34.77 } }, 'en')).toEqual({
      place: 'Dizengoff St 50, Tel Aviv-Yafo',
      destination: { geo: { lat: 32.08, lng: 34.77 }, placeId: 'p1', address: 'Dizengoff St 50, Tel Aviv-Yafo' },
    })
    expect(voucherDestination({ businessAddress: address }, 'he').place).toBe('דיזנגוף 50, תל אביב-יפו')
  })

  it('offers nothing for a voucher issued before addresses were frozen', () => {
    expect(voucherDestination({}, 'en')).toEqual({ place: '', destination: null })
    expect(voucherDestination({ businessAddress: null, businessGeo: null }, 'he').destination).toBeNull()
  })

  it('still navigates by position when there is no address text', () => {
    expect(voucherDestination({ businessGeo: { lat: 1, lng: 2 } }, 'en').destination).toEqual({ geo: { lat: 1, lng: 2 }, placeId: undefined, address: '' })
  })
})
