import { Image, StyleSheet, View } from 'react-native'
import { issuerLine, type VoucherIssuer } from '@shared/payments/issuer'
import AppText from './AppText'
import { useLang } from '../i18n/LangProvider'
import { colors, radius } from '../theme'

// The issuer's card (web: components/member/IssuerAttribution.tsx): "Issued by Raayonit Ltd." with the issuer's
// logo large in a white frame, on the offer page, the order summary, a voucher under its code and the order
// confirmation. The logo file is assets/images/raayonit-logo.png, the official logo on white (248 x 442, portrait).
// `note` is a quieter line under the headline (what the voucher is, how long it lasts).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const LOGO = require('../../assets/images/raayonit-logo.png')
const LOGO_RATIO = 248 / 442
/** The framed tile: 64 square, the portrait logo inside it at 44 high (web: size-16, h-11). */
const TILE = 64
const LOGO_HEIGHT = 46

export default function IssuerAttribution({ issuer, note }: { issuer: VoucherIssuer; note?: string }) {
  const { lang } = useLang()
  const line = issuerLine(issuer, lang)
  return (
    <View style={styles.wrap} accessible accessibilityLabel={note ? `${line}. ${note}` : line}>
      <View style={styles.tile}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" accessible={false} />
      </View>
      <View style={styles.text}>
        <AppText style={styles.headline}>{line}</AppText>
        {!!note && <AppText style={styles.note}>{note}</AppText>}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 16,
    padding: 16,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    borderColor: 'rgba(0,56,184,0.22)',
    // The brand tint fading to white (web: bg-gradient-to-br from-brandTint to-white), a solid tint where gradients are unsupported.
    backgroundColor: colors.brandTint,
    experimental_backgroundImage: `linear-gradient(135deg, ${colors.brandTint}, ${colors.white})`,
    shadowColor: colors.brand,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 5,
  },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: LOGO_HEIGHT * LOGO_RATIO, height: LOGO_HEIGHT },
  text: { flex: 1, minWidth: 0, gap: 4 },
  headline: { fontSize: 17, lineHeight: 23, fontWeight: '800', color: colors.heading },
  note: { fontSize: 13, lineHeight: 20, color: colors.body },
})
