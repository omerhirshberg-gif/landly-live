import type { CSSProperties } from 'react'

// Browsers ignore `placeholder` when they resolve dir="auto", so an EMPTY auto field is treated as left-to-right and
// a Hebrew hint ends up pushed off its start edge. Until something is typed, the field's direction follows its hint
// (a Hebrew/Arabic hint, or an RTL interface) and the hint is anchored to that edge. Once typed:
//   'text' (names, search, addresses, descriptions) -> dir="auto", text-align from the typed script (start);
//   'ltr'  (email, phone, password, url, numbers, dates) -> dir="ltr", left.
const RTL_SCRIPT = /[֐-ࣿיִ-﷿ﹰ-﻿]/

export const hasRtlScript = (text: string | undefined | null) => !!text && RTL_SCRIPT.test(text)

export type TypedKind = 'text' | 'ltr'

export interface DirectionalProps {
  dir: 'rtl' | 'ltr' | 'auto'
  /** Only set while empty; typed text keeps the field's own `text-start`. */
  style?: CSSProperties
}

export function directionalProps(
  value: string | null | undefined,
  placeholder: string | undefined,
  uiRtl: boolean,
  typed: TypedKind = 'text',
): DirectionalProps {
  if (String(value ?? '').trim().length === 0) {
    const rtl = uiRtl || hasRtlScript(placeholder)
    return { dir: rtl ? 'rtl' : 'ltr', style: { textAlign: rtl ? 'right' : 'left' } }
  }
  return typed === 'ltr' ? { dir: 'ltr', style: { textAlign: 'left' } } : { dir: 'auto' }
}
