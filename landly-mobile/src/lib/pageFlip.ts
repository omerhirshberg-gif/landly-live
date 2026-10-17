import { Platform } from 'react-native'

// The "page flip" push used by the settings stack: a pushed screen slides in
// from the reading direction's far side, and dragging a finger across the
// screen turns it back like a book page, alongside the header's back button.
//
// Native layout direction is always LTR (supportsRTL is off in app.json), so
// the platform's own push would come from the right and pop from the left
// edge even in Hebrew. For RTL the screen uses react-native-screens'
// slide_from_left with animationMatchesGesture (native-stack's name for
// react-native-screens' customAnimationOnSwipe), which makes iOS take the swipe
// from the right edge (RNSScreenStack.mm checks the edge against the
// animation); fullScreenGestureEnabled lets the drag start anywhere on the
// screen, not only at the edge. LTR keeps the system's own iOS push. Android
// uses its iOS-style push in the matching direction and the system back
// gesture. The Expo web build ignores these and uses the browser's back.
export function pageFlipOptions(isRtl: boolean) {
  const animation =
    Platform.OS === 'android' ? (isRtl ? 'ios_from_left' : 'ios_from_right') : isRtl ? 'slide_from_left' : 'default'
  return {
    gestureEnabled: true,
    fullScreenGestureEnabled: true,
    // Ignored by the system push (iOS LTR); needed for the custom RTL slide.
    animationMatchesGesture: true,
    animation,
  } as const
}
