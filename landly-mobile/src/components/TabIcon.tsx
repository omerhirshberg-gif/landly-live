import type { ColorValue } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { colors } from '../theme'

export type TabIconName = 'home' | 'perks' | 'wishlist' | 'pass' | 'profile'

// Lucide-style 24px icons for the web tab bar (_layout.web.tsx; iOS and
// Android use system symbols): an outline when inactive, a solid brand-blue
// fill when active. Details inside a filled shape (the gift's ribbon, the
// ticket's perforation) are cut out in white.
const OUTLINE: Record<TabIconName, string> = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  perks: 'M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z',
  wishlist: 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z',
  pass: 'M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4zM14 6v2M14 11v2M14 16v2',
  profile: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
}

const FILLED: Record<TabIconName, { fill: string; stroke?: string; cut?: string }> = {
  home: { fill: OUTLINE.home },
  perks: {
    fill: 'M4 12h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM2 8a1 1 0 0 1 1-1h18a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z',
    stroke: 'M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z',
    cut: 'M12 8v13',
  },
  wishlist: { fill: OUTLINE.wishlist },
  pass: {
    fill: 'M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z',
    cut: 'M14 7.5v1M14 11.5v1M14 15.5v1',
  },
  profile: { fill: 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2z' },
}

export default function TabIcon({
  name,
  color,
  size,
  focused = false,
}: {
  name: TabIconName
  color: ColorValue
  size: number
  focused?: boolean
}) {
  const stroke = { stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (!focused) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...stroke}>
        <Path d={OUTLINE[name]} />
      </Svg>
    )
  }
  const filled = FILLED[name]
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={filled.fill} fill={color} {...stroke} />
      {filled.stroke && <Path d={filled.stroke} fill="none" {...stroke} />}
      {filled.cut && <Path d={filled.cut} fill="none" stroke={colors.white} strokeWidth={2} strokeLinecap="round" />}
    </Svg>
  )
}
