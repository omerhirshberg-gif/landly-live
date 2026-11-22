import { Pressable, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import type { OfferDocument } from '@shared/firebase/offers'
import { perkBrand } from '@shared/perks/perksFilter'
import { localizedBusinessName } from '@shared/business/businessText'
import AppText from './AppText'
import DealMedia from './DealMedia'
import ContactActions from './ContactActions'
import LineIcon from './LineIcon'
import MerchantBadge from './MerchantBadge'
import { useLang } from '../i18n/LangProvider'
import { badgeLogoUri, secureImageUrl } from '../lib/imageSource'
import { heroLogoSource, isRaayonitOffer } from '../lib/logoHero'
import type { DealImage } from '../lib/useDealImage'
import { webOnly } from '../lib/webStyles'
import { colors } from '../theme'

// The brand's card at the foot of the offer page: the offer's own picture (else its category's panel) as the banner, the brand's logo
// centred across the banner's lower edge, then its website (only when Raayonit or GoLandly hold one) and "To brand page", which opens the
// Perks catalogue filtered to that brand. No description: only what the data holds. Web: components/offers/BrandSpotlight.tsx.
export default function BrandSpotlight({ offer, image }: { offer: OfferDocument; image: DealImage }) {
  const { t, lang, isRtl } = useLang()
  const name = perkBrand(offer)
  const shown = localizedBusinessName(offer, lang).text || name
  if (!name || offer.perkScope === 'multi_chain') return null
  const logoUri = heroLogoSource(offer) ? null : badgeLogoUri(secureImageUrl(offer.businessLogoUrl ?? ''), image.uri, image.role)
  return (
    <View style={styles.card}>
      <View style={styles.banner}>
        <DealMedia image={image} category={offer.category} logo={heroLogoSource(offer)} ratio={16 / 7} maxHeight={140} />
      </View>
      <View style={styles.logoSeam}>
        {(logoUri || isRaayonitOffer(offer)) && <MerchantBadge logoUri={logoUri} height={56} raayonit={isRaayonitOffer(offer)} large />}
      </View>
      <View style={styles.body}>
        <AppText accessibilityRole="header" style={styles.name}>{shown}</AppText>
        <ContactActions equal websiteUrl={offer.websiteUrl} phone={offer.contactPhone} />
        <Pressable
          accessibilityRole="link"
          onPress={() => router.navigate({ pathname: '/perks', params: { brand: name, cat: '', sort: '', kind: '' } })}
          style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
        >
          <AppText style={styles.ctaText}>{t('brand_spotlight_cta')}</AppText>
          <LineIcon name="chevronEnd" size={16} color={colors.brand} strokeWidth={2} flip={isRtl} />
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { marginTop: 28, borderRadius: 24, borderCurve: 'continuous', backgroundColor: '#F4F5F7', overflow: 'hidden' },
  banner: { overflow: 'hidden' },
  // Half of the 56pt tile hangs over the banner's lower edge, centred.
  logoSeam: { alignItems: 'center', height: 28, marginTop: -28 },
  body: { alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 40, paddingBottom: 20 },
  name: { fontSize: 18, lineHeight: 24, fontWeight: '800', color: colors.heading, textAlign: 'center' },
  cta: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 44, borderRadius: 12, borderCurve: 'continuous', borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: 'rgba(255,255,255,0.7)', ...webOnly({ cursor: 'pointer' }) },
  ctaText: { fontSize: 15, fontWeight: '700', color: colors.heading },
  pressed: { opacity: 0.6 },
})
