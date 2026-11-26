import { describe, expect, it } from 'vitest'
import { applePayAvailable, googlePayAvailable } from '@/lib/payments/walletAvailability'

const both = { applePay: true, googlePay: true }
const none = { applePay: false, googlePay: false }

describe('wallet availability', () => {
  it('shows no wallet without a live payment (the dev sandbox has none) or with the terminal flags off', () => {
    expect(applePayAvailable(null, { ApplePaySession: { canMakePayments: () => true } })).toBe(false)
    expect(googlePayAvailable(undefined, true)).toBe(false)
    expect(applePayAvailable(none, { ApplePaySession: { canMakePayments: () => true } })).toBe(false)
    expect(googlePayAvailable(none, true)).toBe(false)
  })
  it('needs the device too: Apple Pay only where ApplePaySession exists, Google Pay only once the SDK reports a wallet', () => {
    expect(applePayAvailable(both, {})).toBe(false)
    expect(applePayAvailable(both, undefined)).toBe(false)
    expect(applePayAvailable(both, { ApplePaySession: { canMakePayments: () => true } })).toBe(true)
    expect(applePayAvailable(both, { ApplePaySession: {} })).toBe(true)
    expect(applePayAvailable(both, { ApplePaySession: { canMakePayments: () => false } })).toBe(false)
    expect(applePayAvailable(both, { ApplePaySession: { canMakePayments: () => { throw new Error('insecure context') } } })).toBe(false)
    expect(googlePayAvailable(both, false)).toBe(false)
    expect(googlePayAvailable(both, true)).toBe(true)
  })
})
