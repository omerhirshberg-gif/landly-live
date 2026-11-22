import type { StyleProp, ViewStyle } from 'react-native'
import type { PerkSource } from '@shared/perks/perksFilter'
import SegmentedControl from './SegmentedControl'
import { useLang } from '../i18n/LangProvider'

// Explore Perks' source switch (web: components/perks/SourceSegment.tsx): All, GoLandly's own perks, Raayonit's chains. Lives in the
// route (?src=), so a shared link opens on the same segment.
export default function SourceSegment({ value, onChange, style }: { value: PerkSource; onChange: (next: PerkSource) => void; style?: StyleProp<ViewStyle> }) {
  const { t } = useLang()
  const options = [
    { value: 'all', label: t('perks_src_all') },
    { value: 'landly', label: t('perks_src_landly') },
    { value: 'raayonit', label: t('perks_src_raayonit') },
  ] as const
  return <SegmentedControl options={options} value={value} onChange={onChange} style={style} />
}
