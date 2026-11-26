import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import {
  CARD_FRAME_PATH, cardFrameHeight, nextCardFramePhase, parseCardFrameEvent, type CardFrameInit, type CardFramePhase, type CardFrameState,
} from '@shared/payments/hostedFieldsProtocol'
import AppText from './AppText'
import Button from './Button'
import BrandLoader from './BrandLoader'
import { useLang } from '../i18n/LangProvider'
import { API_BASE_URL } from '../lib/env'
import { colors } from '../theme'
import type { CardFrameProps } from './TranzilaCardFrame'

const HELLO_TIMEOUT_MS = 15_000

// The Expo web build of the card step: the same GoLandly card page (app/checkout/card-frame) in an iframe, speaking the same
// bridge (lib/payments/hostedFieldsProtocol.ts). Messages are accepted only from that iframe's window and origin.
export default function TranzilaCardFrame({ payment, priceLabel, busy, error, cardHolder, onEvent }: CardFrameProps) {
  const { lang, isRtl, t } = useLang()
  const frameRef = useRef<HTMLIFrameElement | null>(null)
  const helloed = useRef(false)
  const [measured, setMeasured] = useState(340)
  const [phase, setPhase] = useState<CardFramePhase>('idle')
  // While a charge is in flight the frame holds Tranzila's 400x600 3-D Secure challenge.
  const height = cardFrameHeight(phase, measured)
  const [ready, setReady] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [loadFailed, setLoadFailed] = useState(false)
  const origin = useMemo(() => new URL(API_BASE_URL || window.location.origin).origin, [])
  const src = `${origin}${CARD_FRAME_PATH}`

  const post = useCallback((message: CardFrameInit | CardFrameState) => {
    frameRef.current?.contentWindow?.postMessage(message, origin)
  }, [origin])

  const init = useMemo<CardFrameInit>(() => ({ v: 1, type: 'init', payment, lang, dir: isRtl ? 'rtl' : 'ltr', priceLabel, ...(cardHolder ? { cardHolder } : {}) }), [payment, lang, isRtl, priceLabel, cardHolder])
  const initRef = useRef(init)
  useEffect(() => { initRef.current = init }, [init])
  const onEventRef = useRef(onEvent)
  useEffect(() => { onEventRef.current = onEvent }, [onEvent])

  useEffect(() => { if (helloed.current) post(init) }, [init, post])
  useEffect(() => { if (helloed.current) post({ v: 1, type: 'state', busy, error }) }, [busy, error, post])

  useEffect(() => {
    const listener = (e: MessageEvent) => {
      if (e.origin !== origin || e.source !== frameRef.current?.contentWindow) return
      const event = parseCardFrameEvent(e.data)
      if (!event) return
      if (event.type === 'hello') { helloed.current = true; post(initRef.current); return }
      if (event.type === 'height') { setMeasured(Math.max(event.px, 200)); return }
      setPhase((current) => nextCardFramePhase(current, event))
      if (event.type === 'ready') setReady(true)
      onEventRef.current(event)
    }
    window.addEventListener('message', listener)
    return () => window.removeEventListener('message', listener)
  }, [origin, post, attempt])

  useEffect(() => {
    if (ready || loadFailed) return
    const timer = setTimeout(() => setLoadFailed(true), HELLO_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [ready, loadFailed, attempt])

  if (loadFailed) {
    return (
      <View style={styles.failed} accessibilityRole="alert">
        <AppText style={styles.failedText}>{t('checkout_card_load_failed')}</AppText>
        <Button label={t('checkout_card_retry')} variant="secondary" onPress={() => { helloed.current = false; setReady(false); setLoadFailed(false); setAttempt((n) => n + 1) }} />
      </View>
    )
  }

  return (
    <View style={{ height }}>
      <iframe
        key={attempt}
        ref={frameRef}
        src={src}
        title={t('checkout_card_title')}
        allow="payment *"
        // Tranzila: Google Pay in an iframe needs allowpaymentrequest (older browsers read it in place of `allow`).
        {...{ allowpaymentrequest: 'true' }}
        style={{ border: 0, width: '100%', height: '100%', background: 'transparent' }}
      />
      {!ready && (
        <View style={styles.loading} pointerEvents="none">
          <BrandLoader size="md" decorative />
          <AppText style={styles.loadingText}>{t('checkout_card_loading')}</AppText>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  loading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.white },
  loadingText: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  failed: { alignItems: 'stretch', gap: 12, paddingVertical: 8 },
  failedText: { fontSize: 14, lineHeight: 21, color: colors.danger, fontWeight: '600' },
})
