import { useEffect } from 'react'

// While a form has unsaved changes, closing or reloading the tab asks first
// (the browser's own prompt). In-app links leave as usual; the forms' Cancel
// asks with confirmLeave.
export function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      // Older Chrome and Safari still need returnValue set to show the prompt.
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])
}

/** True to go ahead: nothing unsaved, or the admin chose to discard it. */
export function confirmLeave(dirty: boolean): boolean {
  return !dirty || window.confirm('Discard your unsaved changes?')
}
