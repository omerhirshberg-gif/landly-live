import AsyncStorage from '@react-native-async-storage/async-storage'
import { onboardingDraftKey, parseOnboardingDraft, serializeOnboardingDraft, type OnboardingDraft } from '@shared/auth/onboarding'

// The wizard's progress on this device (web counterpart: localStorage in
// components/auth/onboarding/OnboardingWizard.tsx), so closing the app
// mid-wizard comes back to the same card. Storage failures only cost that.

export async function loadOnboardingDraft(uid: string): Promise<OnboardingDraft | null> {
  try {
    return parseOnboardingDraft(await AsyncStorage.getItem(onboardingDraftKey(uid)))
  } catch {
    return null
  }
}

/** Saves the draft, or clears it with null. */
export function saveOnboardingDraft(uid: string, draft: OnboardingDraft | null): void {
  const key = onboardingDraftKey(uid)
  const write = draft ? AsyncStorage.setItem(key, serializeOnboardingDraft(draft)) : AsyncStorage.removeItem(key)
  write.catch(() => {})
}
