import { useEffect, useState } from 'react'

// `value`, settled: it only updates once `value` has stopped changing for
// `delayMs`. Shared by the web and native perk searches.
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])
  return debounced
}
