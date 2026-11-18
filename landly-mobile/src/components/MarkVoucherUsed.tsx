import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { markVoucherUsed } from '@shared/vouchers/markUsedClient'
import AppText from './AppText'
import ScalePressable from './ScalePressable'
import { useLang } from '../i18n/LangProvider'
import { useAuth } from '@shared/firebase/useAuth'
import { API_BASE_URL } from '../lib/env'
import { impact, success, warning } from '../lib/haptics'
import { colors, radius } from '../theme'

// A code-only voucher (Raayonit) is used at a till nobody here sees, so the member says so
// (web: components/member/MarkVoucherUsed.tsx). Two taps on purpose: the first asks, inline (no
// system alert, which the Expo web build lacks), the second does it. The voucher's live
// subscription then flips the screen to "already redeemed".
export default function MarkVoucherUsed({ voucherId }: { voucherId: string }) {
  const { t } = useLang()
  const { user } = useAuth()
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const confirm = async () => {
    if (!user || busy) return
    setBusy(true)
    setFailed(false)
    const ok = await markVoucherUsed(await user.getIdToken(), voucherId, API_BASE_URL).catch(() => false)
    if (ok) success()
    else {
      warning()
      setFailed(true)
      setBusy(false)
    }
  }

  if (!asking) {
    return (
      <ScalePressable
        pressedScale={0.98}
        onPress={() => { impact(); setAsking(true) }}
        accessibilityRole="button"
        style={styles.link}
      >
        <AppText style={styles.linkText}>{t('voucher_mark_used')}</AppText>
      </ScalePressable>
    )
  }
  return (
    <View style={styles.panel} accessibilityRole="alert">
      <AppText style={styles.title}>{t('voucher_mark_used_title')}</AppText>
      <AppText style={styles.body}>{t('voucher_mark_used_body')}</AppText>
      {failed && <AppText style={styles.error}>{t('voucher_mark_used_error')}</AppText>}
      <View style={styles.actions}>
        <ScalePressable pressedScale={0.97} onPress={() => setAsking(false)} disabled={busy} accessibilityRole="button" style={[styles.btn, styles.btnOutline]}>
          <AppText style={styles.btnText}>{t('voucher_mark_used_cancel')}</AppText>
        </ScalePressable>
        <ScalePressable pressedScale={0.97} onPress={confirm} disabled={busy} accessibilityRole="button" accessibilityState={{ busy }} style={[styles.btn, styles.btnPrimary, busy && styles.busy]}>
          <AppText style={[styles.btnText, styles.btnTextPrimary]}>{t('voucher_mark_used_confirm')}</AppText>
        </ScalePressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  link: { alignSelf: 'stretch', alignItems: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, marginTop: 16 },
  linkText: { fontSize: 14, fontWeight: '700', color: colors.brand },
  panel: { alignSelf: 'stretch', marginTop: 12, padding: 16, borderRadius: radius.lg, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  title: { fontSize: 15, fontWeight: '800', color: colors.textStrong },
  body: { fontSize: 13, color: colors.body, marginTop: 4, lineHeight: 19 },
  error: { fontSize: 13, color: colors.danger, marginTop: 8 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  btn: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.action, borderCurve: 'continuous' },
  btnOutline: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  btnPrimary: { backgroundColor: colors.brand },
  busy: { opacity: 0.6 },
  btnText: { fontSize: 14, fontWeight: '700', color: colors.text },
  btnTextPrimary: { color: colors.white },
})
