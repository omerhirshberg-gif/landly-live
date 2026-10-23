import { Platform } from 'react-native'
import * as Haptics from 'expo-haptics'

// Tactile feedback for the app's few physical moments. The Expo web build
// skips it (browsers have no taptic engine; vibrate() is no substitute), and
// a device without haptics fails quietly.
const native = Platform.OS !== 'web'

/** A light tick: a card turning over. */
export function tick() {
  if (native) Haptics.selectionAsync().catch(() => {})
}

/** The success pattern: a purchase confirmed, a code copied. */
export function success() {
  if (native) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
}

/** The error pattern: a form that can't be submitted yet. */
export function warning() {
  if (native) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
}

/** A light impact: a deliberate tap, like asking for Face ID again. */
export function impact() {
  if (native) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
}
