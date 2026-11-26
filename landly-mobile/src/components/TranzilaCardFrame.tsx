import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'
import {
  CARD_FRAME_PATH, isAllowedCardFrameUrl, parseCardFrameEvent,
  type CardFrameErrorCode, type CardFrameEvent, type CardFrameInit, type CardFrameState, type HostedPaymentParams,
} from '@shared/payments/hostedFieldsProtocol'
import AppText from './AppText'
import Button from './Button'
import BrandLoader from './BrandLoader'
import { useLang } from '../i18n/LangProvider'
import { API_BASE_URL } from '../lib/env'
import { colors } from '../theme'

// How long the card page may take to say hello before the member is offered a retry.
const HELLO_TIMEOUT_MS = 15_000

export interface CardFrameProps {
  payment: HostedPaymentParams
  priceLabel: string
  /** The app is confirming the charge with the server: the frame's form is inert. */
  busy: boolean
  /** An error of the app's own (a failed confirmation) for the frame to show. */
  error: CardFrameErrorCode | null
  onEvent: (event: CardFrameEvent) => void
}

// Tranzila Hosted Fields inside the app: a WebView on GoLandly's own card page (app/checkout/card-frame), never the system
// browser. The page speaks the small bridge in lib/payments/hostedFieldsProtocol.ts: the card details stay in Tranzila's
// iframes inside it and never reach this code or its messages. Navigation of the WebView itself is limited to the GoLandly
// host and Tranzila; the 3-D Secure challenge runs in Tranzila's iframe inside the page.
export default function TranzilaCardFrame({ payment, priceLabel, busy, error, onEvent }: CardFrameProps) {
  const { lang, isRtl, t } = useLang()
  const webRef = useRef<WebView>(null)
  const helloed = useRef(false)
  const [height, setHeight] = useState(340)
  const [attempt, setAttempt] = useState(0)
  const [loadFailed, setLoadFailed] = useState(false)
  const [ready, setReady] = useState(false)
  const frameOrigin = useMemo(() => new URL(API_BASE_URL).origin, [])
  const uri = `${API_BASE_URL}${CARD_FRAME_PATH}`

  const post = useCallback((message: CardFrameInit | CardFrameState) => {
    // The message is a JSON string inside a JSON string, so no value can break out of the script.
    webRef.current?.injectJavaScript(`window.dispatchEvent(new MessageEvent('message',{data:${JSON.stringify(JSON.stringify(message))}}));true;`)
  }, [])

  const init = useMemo<CardFrameInit>(() => ({ v: 1, type: 'init', payment, lang, dir: isRtl ? 'rtl' : 'ltr', priceLabel }), [payment, lang, isRtl, priceLabel])
  const initRef = useRef(init)
  useEffect(() => { initRef.current = init }, [init])

  // A fresh thtk, the busy flag and any app-side error reach the page without reloading it (the member's typing stays).
  useEffect(() => { if (helloed.current) post(init) }, [init, post])
  useEffect(() => { if (helloed.current) post({ v: 1, type: 'state', busy, error }) }, [busy, error, post])

  useEffect(() => {
    if (ready || loadFailed) return
    const timer = setTimeout(() => setLoadFailed(true), HELLO_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [ready, loadFailed, attempt])

  const onMessage = (e: WebViewMessageEvent) => {
    const event = parseCardFrameEvent(e.nativeEvent.data)
    if (!event) return
    if (event.type === 'hello') {
      helloed.current = true
      post(initRef.current)
      return
    }
    if (event.type === 'height') { setHeight(Math.max(event.px, 200)); return }
    if (event.type === 'ready') setReady(true)
    onEvent(event)
  }

  const retry = () => {
    helloed.current = false
    setReady(false)
    setLoadFailed(false)
    setAttempt((n) => n + 1)
  }

  if (loadFailed) {
    return (
      <View style={styles.failed} accessibilityRole="alert">
        <AppText style={styles.failedText}>{t('checkout_card_load_failed')}</AppText>
        <Button label={t('checkout_card_retry')} variant="secondary" onPress={retry} />
      </View>
    )
  }

  return (
    <View style={{ height }}>
      <WebView
        key={attempt}
        ref={webRef}
        source={{ uri }}
        style={styles.web}
        onMessage={onMessage}
        onError={() => setLoadFailed(true)}
        onHttpError={() => setLoadFailed(true)}
        // Only the card page and Tranzila; anything else navigating the top frame is refused, never opened in a browser.
        onShouldStartLoadWithRequest={(request) => request.isTopFrame === false || isAllowedCardFrameUrl(request.url, frameOrigin)}
        originWhitelist={['https://*', frameOrigin]}
        javaScriptEnabled
        domStorageEnabled
        incognito
        sharedCookiesEnabled={false}
        setSupportMultipleWindows={false}
        mixedContentMode="never"
        allowFileAccess={false}
        allowsInlineMediaPlayback
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        automaticallyAdjustContentInsets={false}
        textZoom={100}
        accessibilityLabel={t('checkout_card_title')}
      />
      {!ready && (
        <View style={styles.loading} pointerEvents="none" accessibilityRole="progressbar" accessibilityLabel={t('checkout_card_loading')}>
          <BrandLoader size="md" decorative />
          <AppText style={styles.loadingText}>{t('checkout_card_loading')}</AppText>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: 'transparent' },
  loading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.white },
  loadingText: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  failed: { alignItems: 'stretch', gap: 12, paddingVertical: 8 },
  failedText: { fontSize: 14, lineHeight: 21, color: colors.danger, fontWeight: '600' },
})
