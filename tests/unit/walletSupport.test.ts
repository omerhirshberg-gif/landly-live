import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { translations } from '@/lib/i18n/translations'
import { canOfferWalletPass, walletBadgePath, walletSupport } from '@/lib/wallet/walletSupport'

const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1',
  instagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0',
  facebook: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/480.0]',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  macChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  winEdge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0',
  winFirefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0',
  android: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
}

describe('walletSupport', () => {
  it('shows the badge on Apple browsers, iPad Safari included', () => {
    expect(walletSupport(UA.iphoneSafari, 5)).toBe('badge')
    expect(walletSupport(UA.iphoneChrome, 5)).toBe('badge')
    expect(walletSupport(UA.macSafari, 0)).toBe('badge')
    expect(walletSupport(UA.macSafari, 5)).toBe('badge')
  })

  it('warns in in-app browsers', () => {
    expect(walletSupport(UA.instagram, 5)).toBe('in-app')
    expect(walletSupport(UA.facebook, 5)).toBe('in-app')
  })

  it('hands desktops off to a phone, and stays quiet on Android', () => {
    expect(walletSupport(UA.macChrome, 0)).toBe('handoff')
    expect(walletSupport(UA.winEdge, 0)).toBe('handoff')
    expect(walletSupport(UA.winFirefox, 0)).toBe('handoff')
    expect(walletSupport(UA.android, 5)).toBe('none')
  })
})

describe('canOfferWalletPass', () => {
  const now = 1000
  const ok = { status: 'active', redeemToken: 'a', expiresAt: null }
  it('matches the server', () => {
    expect(canOfferWalletPass(ok, now)).toBe(true)
    expect(canOfferWalletPass({ ...ok, status: 'redeemed' }, now)).toBe(false)
    expect(canOfferWalletPass({ ...ok, redeemToken: null }, now)).toBe(false)
    expect(canOfferWalletPass({ ...ok, expiresAt: new Date(999) }, now)).toBe(false)
  })
})

describe('the Wallet surfaces', () => {
  it('has copy in every language', () => {
    for (const table of Object.values(translations)) {
      expect(table.wallet_add_label).toMatch(/Apple Wallet/)
      expect(table.wallet_pass_offer.length).toBeGreaterThan(0)
    }
  })

  it('never leaves Apple\'s artwork open to effects', () => {
    const web = readFileSync('components/member/AddToAppleWallet.tsx', 'utf8')
    const badge = web.slice(web.indexOf('function WalletBadge'), web.indexOf('function IPhoneHandoff'))
    expect(walletBadgePath('he')).toBe('/wallet/add-to-apple-wallet-he.svg')
    expect(badge).toContain('h-12 w-auto')
    expect(badge).not.toMatch(/hover:|shadow|opacity|-scale-x|rtl:|animate|[" ]w-full/)
  })

  it('sits under the code on both voucher screens', () => {
    const web = readFileSync('app/member/vouchers/[voucherId]/page.tsx', 'utf8')
    const native = readFileSync('landly-mobile/src/app/voucher/[voucherId].tsx', 'utf8')
    for (const page of [web, native]) {
      expect(page.indexOf('<AddToAppleWallet')).toBeGreaterThan(page.indexOf('<CodeReveal'))
    }
  })
})
