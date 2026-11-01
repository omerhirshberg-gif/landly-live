import type { ComponentType } from 'react'
import type { ViewProps } from 'react-native'
import { requireNativeView, requireOptionalNativeModule } from 'expo'

// Absent in Expo Go, on Android and on the web, where the voucher screen falls
// back or shows nothing (src/components/AddToAppleWallet.tsx).
const native = requireOptionalNativeModule<{
  canAddPasses(): boolean
  addPass(url: string): Promise<void>
}>('AppleWallet')

export const AppleWallet = native

export const AppleWalletButton: ComponentType<ViewProps & { onAddPress: () => void }> | null = native
  ? requireNativeView('AppleWallet')
  : null
