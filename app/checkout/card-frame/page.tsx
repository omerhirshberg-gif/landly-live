'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import TranzilaHostedFields from '@/components/checkout/TranzilaHostedFields'
import {
  parseCardFrameInit, parseCardFrameState, type CardFrameErrorCode, type CardFrameEvent, type CardFrameInit,
} from '@/lib/payments/hostedFieldsProtocol'

declare global {
  interface Window { ReactNativeWebView?: { postMessage: (message: string) => void } }
}

// The Hosted Fields step as a page of its own, for the app's WebView (landly-mobile TranzilaCardFrame) and the Expo web
// build's iframe. It holds no session, reads no data and creates no order: the app sends `init` (the Handshake thtk,
// terminal, amount and notify URL its server call returned) over the bridge in lib/payments/hostedFieldsProtocol.ts, and
// this page reports back UI events only. The app then asks the server to confirm; nothing here settles a payment.
// Everything on this page except Tranzila's own iframes is ours: the Hosted Fields script URL is a fixed constant.
export default function CardFramePage() {
  const [init, setInit] = useState<CardFrameInit | null>(null)
  const [busy, setBusy] = useState(false)
  const [hostError, setHostError] = useState<CardFrameErrorCode | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const send = useCallback((event: CardFrameEvent) => {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(event))
    } else if (window.parent !== window) {
      let target = '*'
      try { if (document.referrer) target = new URL(document.referrer).origin } catch { /* keep '*': the events carry no data */ }
      window.parent.postMessage(event, target)
    }
  }, [])

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      // In an iframe only the embedding page may talk to us; the app's WebView injects its messages with no source window.
      if (!window.ReactNativeWebView && e.source !== window.parent) return
      const next = parseCardFrameInit(e.data)
      if (next) {
        document.documentElement.dir = next.dir
        document.documentElement.lang = next.lang
        setInit(next)
        return
      }
      const state = parseCardFrameState(e.data)
      if (state) { setBusy(state.busy); setHostError(state.error) }
    }
    window.addEventListener('message', onMessage)
    // Android WebViews deliver injected messages to `document`.
    document.addEventListener('message', onMessage as EventListener)
    send({ v: 1, type: 'hello' })
    return () => {
      window.removeEventListener('message', onMessage)
      document.removeEventListener('message', onMessage as EventListener)
    }
  }, [send])

  // The WebView is sized from the content, so the app never shows a scrollbar inside the frame.
  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const report = () => send({ v: 1, type: 'height', px: el.getBoundingClientRect().height })
    const observer = new ResizeObserver(report)
    observer.observe(el)
    report()
    return () => observer.disconnect()
  }, [send, init])

  return (
    <div ref={rootRef} className="bg-white px-0.5 pb-1 pt-0.5">
      {/* The development badge would float over the fields inside the app's WebView. */}
      <style>{'[data-dev-badge]{display:none !important}'}</style>
      {init && (
        <TranzilaHostedFields
          payment={init.payment}
          lang={init.lang}
          priceLabel={init.priceLabel}
          busy={busy}
          externalError={hostError}
          cardHolder={init.cardHolder}
          onEvent={send}
        />
      )}
    </div>
  )
}
