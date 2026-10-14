import type { KeyboardEvent } from 'react'

// Arrow-key movement inside a role="radiogroup" of role="radio" buttons, as
// native radio inputs behave: the arrow moves focus and selects. Left/right
// follow the reading direction, so in RTL ArrowLeft moves forward.
export function radioKeyDown(e: KeyboardEvent<HTMLElement>, isRtl: boolean, select: (index: number) => void) {
  const forward = e.key === 'ArrowDown' || e.key === (isRtl ? 'ArrowLeft' : 'ArrowRight')
  const backward = e.key === 'ArrowUp' || e.key === (isRtl ? 'ArrowRight' : 'ArrowLeft')
  if (!forward && !backward) return
  const radios = Array.from(e.currentTarget.closest('[role="radiogroup"]')?.querySelectorAll<HTMLElement>('[role="radio"]') ?? [])
  const index = radios.indexOf(e.currentTarget)
  if (index < 0) return
  e.preventDefault()
  const next = (index + (forward ? 1 : -1) + radios.length) % radios.length
  radios[next].focus()
  select(next)
}
