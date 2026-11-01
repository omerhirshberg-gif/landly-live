import type { ReactNode } from 'react'
import type { ColorValue } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import Armchair from 'lucide-react-native/icons/armchair'
import Baby from 'lucide-react-native/icons/baby'
import Car from 'lucide-react-native/icons/car'
import Compass from 'lucide-react-native/icons/compass'
import Dumbbell from 'lucide-react-native/icons/dumbbell'
import Plane from 'lucide-react-native/icons/plane'
import ShieldCheck from 'lucide-react-native/icons/shield-check'
import ShoppingBag from 'lucide-react-native/icons/shopping-bag'
import Tag from 'lucide-react-native/icons/tag'
import TreePalm from 'lucide-react-native/icons/tree-palm'
import UtensilsCrossed from 'lucide-react-native/icons/utensils-crossed'
import Wine from 'lucide-react-native/icons/wine'

type IconProps = { size: number; color: ColorValue; strokeWidth: number }

// Beauty and Skincare: the website's lipstick (components/ui/CategoryIcon.tsx),
// since Lucide has no cosmetics glyph. Upright, so it doesn't mirror in Hebrew.
function Lipstick({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color as string} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M7 14h10v6a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z" />
      <Path d="M8.5 14v-3h7v3" />
      <Path d="M10 11V6l4-3v8" />
    </Svg>
  )
}

// Each category's glyph, the same set as the website's CATEGORY_ICONS, in a
// fine 1.75 stroke. Nothing here is directional, so no glyph mirrors in Hebrew.
export const CATEGORY_ICONS: Record<string, (props: IconProps) => ReactNode> = {
  'Restaurants and Cafes': UtensilsCrossed,
  'Beach and Sea': TreePalm,
  'Attractions and Tours': Compass,
  'Fashion and Shopping': ShoppingBag,
  'Sport and Fitness': Dumbbell,
  'Israel and Global Tourism': Plane,
  'Pampering Bundles': Wine,
  'Beauty and Skincare': Lipstick,
  'Home and Furnishing': Armchair,
  'Kids and Baby': Baby,
  'Insurance and Savings': ShieldCheck,
  'Cars and Transport': Car,
}

// Decorative: the label beside it carries the meaning. A tag for an unknown category.
export default function CategoryIcon({ category, size, color, strokeWidth = 1.75 }: { category: string; size: number; color: ColorValue; strokeWidth?: number }) {
  const Icon = CATEGORY_ICONS[category] ?? Tag
  return <Icon size={size} color={color} strokeWidth={strokeWidth} />
}
