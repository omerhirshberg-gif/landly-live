import { useEffect, useState } from 'react'
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import AppText from './AppText'
import LineIcon from './LineIcon'
import VoucherQRCode from './VoucherQRCode'
import { useLang } from '../i18n/LangProvider'
import { webOnly } from '../lib/webStyles'
import { colors, radius } from '../theme'

// The voucher screen's two concealed parts (web: components/member/
// VoucherReveal.tsx): the QR code and the numeric code each stay hidden until
// the member taps to show them at the counter.

/** A placeholder card until "Show QR Code"; then the scannable code, black on white. */
export function QrReveal({ voucherId }: { voucherId: string }) {
  const { t } = useLang()
  const [shown, setShown] = useState(false)
  return (
    <View style={styles.section}>
      <View style={styles.qrBox}>
        {shown ? (
          <VoucherQRCode voucherId={voucherId} size={224} />
        ) : (
          <View style={styles.qrPlaceholder}>
            <LineIcon name="qrCode" size={64} color={colors.border} strokeWidth={1.6} />
            <AppText style={styles.qrHidden}>{t('voucher_qr_hidden')}</AppText>
          </View>
        )}
      </View>
      {shown && <AppText style={styles.hint}>{t('voucher_qr_label')}</AppText>}
      <RevealButton
        primary={!shown}
        icon={shown ? 'close' : 'qrCode'}
        label={t(shown ? 'voucher_hide_qr' : 'voucher_show_qr')}
        expanded={shown}
        onPress={() => setShown((value) => !value)}
      />
    </View>
  )
}

/** The redemption code masked as dots until "Show Code"; copying is offered once it's shown. */
export function CodeReveal({ code }: { code: string }) {
  const { t } = useLang()
  const [shown, setShown] = useState(false)
  return (
    <View style={styles.section}>
      <AppText style={styles.codeLabel}>{t('voucher_redemption_code_label')}</AppText>
      {shown ? (
        <AppText ltr style={styles.code} selectable>{code}</AppText>
      ) : (
        <AppText ltr style={[styles.code, styles.codeMasked]} accessibilityLabel={t('voucher_code_hidden')}>
          {'•'.repeat(Math.max(code.length, 8))}
        </AppText>
      )}
      <View style={styles.codeActions}>
        <RevealButton
          icon={shown ? 'close' : 'lock'}
          label={t(shown ? 'voucher_hide_code' : 'voucher_show_code')}
          expanded={shown}
          onPress={() => setShown((value) => !value)}
        />
        {shown && <CopyCodeButton code={code} />}
      </View>
    </View>
  )
}

function RevealButton({ label, icon, primary, expanded, onPress }: {
  label: string
  icon: 'qrCode' | 'close' | 'lock'
  primary?: boolean
  expanded: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      style={({ pressed }) => [styles.button, primary ? styles.buttonPrimary : styles.buttonOutline, pressed && (primary ? styles.buttonPrimaryPressed : styles.buttonOutlinePressed)]}
    >
      <LineIcon name={icon} size={16} color={primary ? colors.white : colors.text} strokeWidth={2.2} />
      <AppText style={[styles.buttonText, primary && styles.buttonTextPrimary]}>{label}</AppText>
    </Pressable>
  )
}

function CopyCodeButton({ code }: { code: string }) {
  const { t } = useLang()
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle')

  useEffect(() => {
    if (status === 'idle') return
    AccessibilityInfo.announceForAccessibility(t(status === 'copied' ? 'voucher_code_copied' : 'voucher_copy_failed'))
    const timer = setTimeout(() => setStatus('idle'), 2000)
    return () => clearTimeout(timer)
  }, [status, t])

  const copy = async () => {
    try {
      setStatus((await Clipboard.setStringAsync(code)) ? 'copied' : 'failed')
    } catch {
      setStatus('failed')
    }
  }

  const label = status === 'copied' ? t('voucher_code_copied') : status === 'failed' ? t('voucher_copy_failed') : t('voucher_copy_code')
  return (
    <Pressable
      onPress={copy}
      accessibilityRole="button"
      accessibilityLabel={t('voucher_copy_code')}
      style={({ pressed }) => [styles.button, styles.copy, pressed && styles.copyPressed]}
    >
      <LineIcon
        name={status === 'copied' ? 'check' : status === 'failed' ? 'close' : 'copy'}
        size={16}
        color={status === 'failed' ? colors.danger : status === 'copied' ? colors.success : colors.brand}
        strokeWidth={2.2}
      />
      <AppText style={styles.copyText}>{label}</AppText>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  section: { alignItems: 'center' },
  qrBox: {
    width: 264,
    height: 264,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  qrPlaceholder: { alignItems: 'center', gap: 12 },
  qrHidden: { fontSize: 12, color: colors.textMuted, textAlign: 'center', maxWidth: 180 },
  hint: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 10 },
  codeLabel: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginBottom: 4 },
  code: { fontSize: 30, fontWeight: '900', color: colors.textStrong, letterSpacing: 5, textAlign: 'center' },
  codeMasked: { color: colors.border },
  codeActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 20,
    marginTop: 14,
    borderRadius: radius.pill,
    ...webOnly({ cursor: 'pointer' }),
  },
  buttonPrimary: { backgroundColor: colors.brand },
  buttonPrimaryPressed: { backgroundColor: colors.brandDark },
  buttonOutline: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  buttonOutlinePressed: { backgroundColor: colors.borderLight },
  buttonText: { fontSize: 14, fontWeight: '700', color: colors.text },
  buttonTextPrimary: { color: colors.white },
  copy: { backgroundColor: colors.brandTint },
  copyPressed: { backgroundColor: colors.brandLight },
  copyText: { fontSize: 14, fontWeight: '700', color: colors.brand },
})
