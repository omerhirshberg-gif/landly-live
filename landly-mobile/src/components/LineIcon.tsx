import type { ColorValue, StyleProp, ViewStyle } from 'react-native'
import ArrowDownWideNarrow from 'lucide-react-native/icons/arrow-down-wide-narrow'
import Award from 'lucide-react-native/icons/award'
import Banknote from 'lucide-react-native/icons/banknote'
import Calendar from 'lucide-react-native/icons/calendar'
import Check from 'lucide-react-native/icons/check'
import ChevronDown from 'lucide-react-native/icons/chevron-down'
import ChevronLeft from 'lucide-react-native/icons/chevron-left'
import ChevronRight from 'lucide-react-native/icons/chevron-right'
import CircleCheck from 'lucide-react-native/icons/circle-check'
import Clock from 'lucide-react-native/icons/clock'
import Copy from 'lucide-react-native/icons/copy'
import FileText from 'lucide-react-native/icons/file-text'
import Fingerprint from 'lucide-react-native/icons/fingerprint-pattern'
import Flag from 'lucide-react-native/icons/flag'
import Gift from 'lucide-react-native/icons/gift'
import Globe from 'lucide-react-native/icons/globe'
import Heart from 'lucide-react-native/icons/heart'
import Locate from 'lucide-react-native/icons/locate'
import Lock from 'lucide-react-native/icons/lock'
import LogOut from 'lucide-react-native/icons/log-out'
import Mail from 'lucide-react-native/icons/mail'
import MapIcon from 'lucide-react-native/icons/map'
import MapPin from 'lucide-react-native/icons/map-pin'
import MessageCircle from 'lucide-react-native/icons/message-circle'
import MessageCircleQuestionMark from 'lucide-react-native/icons/message-circle-question-mark'
import Monitor from 'lucide-react-native/icons/monitor'
import Navigation from 'lucide-react-native/icons/navigation'
import PiggyBank from 'lucide-react-native/icons/piggy-bank'
import Plus from 'lucide-react-native/icons/plus'
import QrCode from 'lucide-react-native/icons/qr-code'
import Receipt from 'lucide-react-native/icons/receipt'
import ScanFace from 'lucide-react-native/icons/scan-face'
import Search from 'lucide-react-native/icons/search'
import Settings from 'lucide-react-native/icons/settings'
import Shield from 'lucide-react-native/icons/shield'
import Smartphone from 'lucide-react-native/icons/smartphone'
import Sparkles from 'lucide-react-native/icons/sparkles'
import Tag from 'lucide-react-native/icons/tag'
import Ticket from 'lucide-react-native/icons/ticket'
import X from 'lucide-react-native/icons/x'

// The app's outline glyphs, lucide-react-native (24px grid, 2px stroke), each
// imported from its own file so Metro bundles only these and not the library;
// the same set as the website's lucide-react: the settings stack, the Profile
// tab header, My Pass, the wishlist hearts and the Perks tab's rail headings.
// `flip` mirrors a directional glyph (the chevrons, sign out) for
// right-to-left languages; the app sets I18nManager.allowRTL(false), so
// nothing mirrors by itself.
const ICONS = {
  globe: Globe,
  shield: Shield,
  help: MessageCircleQuestionMark,
  file: FileText,
  lock: Lock,
  flag: Flag,
  locate: Locate,
  pin: MapPin,
  navigation: Navigation,
  map: MapIcon,
  phone: Smartphone,
  monitor: Monitor,
  signOut: LogOut,
  check: Check,
  plus: Plus,
  close: X,
  copy: Copy,
  calendar: Calendar,
  qrCode: QrCode,
  tag: Tag,
  gift: Gift,
  banknote: Banknote,
  receipt: Receipt,
  search: Search,
  chevronStart: ChevronLeft,
  chevronDown: ChevronDown,
  sort: ArrowDownWideNarrow,
  chat: MessageCircle,
  mail: Mail,
  chevronEnd: ChevronRight,
  // The app lock: Face ID / face unlock, and Touch ID / fingerprint.
  faceId: ScanFace,
  fingerprint: Fingerprint,
  // The Perks tab's rail headings: Sparkles (New on Landly), Award (Best Sellers).
  sparkles: Sparkles,
  award: Award,
  heart: Heart,
  gear: Settings,
  // My Pass: its stats, empty states and pass marks.
  ticket: Ticket,
  piggyBank: PiggyBank,
  circleCheck: CircleCheck,
  clock: Clock,
} as const

export type LineIconName = keyof typeof ICONS

// The action controls share one stroke scale: 2 for the heart, the pin and
// the rest (the default), 2.2 for chevrons, 2.4 for a selection or success
// check; only display-sized marks (the order celebration, the QR stand-in) differ.
export default function LineIcon({
  name,
  size = 18,
  color,
  strokeWidth = 2,
  flip = false,
  fill = 'none',
  style,
}: {
  name: LineIconName
  size?: number
  color: ColorValue
  strokeWidth?: number
  flip?: boolean
  /** Fills the outline, e.g. the solid heart of a saved perk. */
  fill?: ColorValue
  style?: StyleProp<ViewStyle>
}) {
  const Icon = ICONS[name]
  return <Icon size={size} color={color} fill={fill} strokeWidth={strokeWidth} style={[flip && { transform: [{ scaleX: -1 }] }, style]} />
}
