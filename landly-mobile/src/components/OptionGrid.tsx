import { Pressable, StyleSheet, View } from 'react-native'
import Animated, { type CSSTransitionProperties } from 'react-native-reanimated'
import { ONB } from '@shared/brand/onboardingMotion'
import AppText from './AppText'
import { webOnly } from '../lib/webStyles'
import { colors } from '../theme'
import { SILK_CSS } from '../auth/onboarding/motion'

// Reanimated CSS transition for selection and press (kept out of StyleSheet.create, whose types don't take it).
const TRANSITION: CSSTransitionProperties = {
  transitionProperty: ['borderColor', 'backgroundColor', 'transform'],
  transitionDuration: ONB.ringMs,
  transitionTimingFunction: SILK_CSS,
}

export type Option = { value: string; label: string }

// The app's single-choice card grid (the customer type in onboarding, Member
// type and Edit profile; the region in Israel): two equal columns, every card
// the same height (a label may wrap to a second line, never a third row of a
// different size). With an odd count the last card spans the row, so no row is
// left half empty. Columns follow the reading direction, so Hebrew starts on
// the right. Web twin: components/ui/OptionGrid.tsx.
export default function OptionGrid({ options, value, onChange }: { options: readonly Option[]; value: string; onChange: (value: string) => void }) {
  return (
    <View accessibilityRole="radiogroup" style={styles.grid}>
      {options.map((option, index) => {
        const selected = option.value === value
        const spans = options.length % 2 === 1 && index === options.length - 1
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(option.value)}
            style={[styles.cell, spans && styles.cellSpan]}
          >
            {({ pressed }) => (
              <Animated.View style={[styles.card, selected && styles.cardSelected, { transform: [{ scale: pressed ? ONB.pressScale : 1 }] }, TRANSITION]}>
                <AppText numberOfLines={2} style={[styles.label, selected && styles.labelSelected]}>
                  {option.label}
                </AppText>
              </Animated.View>
            )}
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  // Two columns with the 12pt gap between: each cell takes just under half.
  cell: { flexBasis: '45%', flexGrow: 1, ...webOnly({ cursor: 'pointer', userSelect: 'none' }) },
  cellSpan: { flexBasis: '100%' },
  card: {
    minHeight: 56,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  cardSelected: { borderColor: colors.brand, backgroundColor: colors.brandLight, boxShadow: '0 0 0 4px rgba(0, 56, 184, 0.12)' },
  label: { fontSize: 14, lineHeight: 18, fontWeight: '600', color: colors.text, textAlign: 'center' },
  labelSelected: { color: colors.brand, fontWeight: '700' },
})
