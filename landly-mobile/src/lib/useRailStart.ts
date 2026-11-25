import { useCallback, useEffect, useRef } from 'react'
import { useLang } from '../i18n/LangProvider'

// A horizontal rail that opens at the reading-direction start. Rows lay out
// right to left in Hebrew through the root view's `direction`, but a horizontal
// scroller does not always open at its right edge (it depends on the platform's
// scroll view), so every rail asks for the start once its content has a size.
// `key` re-anchors when the rail's content is replaced (a city filter, a new
// list) but never while the member is scrolling it: the content-size callback
// only acts once per key. Works on a ScrollView or a FlatList.
//   const [railRef, onRailSize] = useRailStart<ScrollView>(city)
//   then pass `ref={railRef}` and `onContentSizeChange={onRailSize}` to the list.
type Scroller = { scrollToEnd: (options?: { animated?: boolean }) => void }

export default function useRailStart<T extends Scroller>(key: string | number | null = null) {
  const { isRtl } = useLang()
  const ref = useRef<T | null>(null)
  const anchoredFor = useRef<string | number | null | undefined>(undefined)

  useEffect(() => {
    anchoredFor.current = undefined
  }, [key])

  const onContentSizeChange = useCallback(
    (width: number) => {
      if (!isRtl || width <= 0 || anchoredFor.current === key) return
      anchoredFor.current = key
      ref.current?.scrollToEnd({ animated: false })
    },
    [isRtl, key]
  )
  return [ref, onContentSizeChange] as const
}
