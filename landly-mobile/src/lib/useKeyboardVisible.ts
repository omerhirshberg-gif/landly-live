import { useEffect, useState } from 'react'
import { Keyboard, Platform } from 'react-native'

// Whether the on-screen keyboard is up, so a screen can tighten its layout
// instead of scrolling. iOS reports it as the keyboard starts moving
// (will*), Android only once it has (did*). Always false on web.
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const ios = Platform.OS === 'ios'
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', () => setVisible(true))
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setVisible(false))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])
  return visible
}
