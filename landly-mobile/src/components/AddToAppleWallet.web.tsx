import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useAuth } from '@shared/firebase/useAuth'
import { fetchWalletAvailability, requestWalletPass } from '@shared/wallet/walletClient'
import { canOfferWalletPass, walletSupport } from '@shared/wallet/walletSupport'
import Button from './Button'
import Notice from './Notice'
import { useLang } from '../i18n/LangProvider'
import { API_BASE_URL } from '../lib/env'
import { colors } from '../theme'

type Voucher = { id: string; status: string; redeemToken: string | null; expiresAt: Date | null }

// The Expo web build: the same decision as the website, on Apple's browsers
// only. A plain navigation to the pass is what opens Wallet's preview.
export default function AddToAppleWallet({ voucher }: { voucher: Voucher }) {
  const { t } = useLang()
  const { user } = useAuth()
  const [now] = useState(Date.now)
  const [available, setAvailable] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<'error' | 'mock' | null>(null)

  const device = walletSupport(navigator.userAgent, navigator.maxTouchPoints)
  const supported = device === 'badge' || device === 'in-app'
  const eligible = canOfferWalletPass(voucher, now)

  useEffect(() => {
    if (!supported || !eligible) return
    let cancelled = false
    fetchWalletAvailability(API_BASE_URL).then((next) => {
      if (!cancelled) setAvailable(next)
    })
    return () => {
      cancelled = true
    }
  }, [supported, eligible])

  const add = async () => {
    if (!user || busy) return
    setBusy(true)
    setNotice(null)
    try {
      const link = await requestWalletPass(await user.getIdToken(), voucher.id, API_BASE_URL)
      if (!link.ok) setNotice('error')
      else if (link.mock) setNotice('mock')
      else window.location.assign(link.url)
    } catch {
      setNotice('error')
    } finally {
      setBusy(false)
    }
  }

  if (!supported || !eligible || !available) return null

  return (
    <>
      <View style={styles.divider} />
      <View style={styles.row}>
        <Button label={t('wallet_add_label')} variant="secondary" busy={busy} onPress={add} />
        {notice && <Notice tone={notice === 'error' ? 'error' : 'info'} message={t(notice === 'error' ? 'wallet_add_error' : 'wallet_mock_notice')} />}
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  divider: { height: 1, backgroundColor: colors.borderLight, marginVertical: 24 },
  row: { alignItems: 'center', gap: 12 },
})
