import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LangContext } from '@/lib/i18n/LangProvider'
import { RTL_LANGS, translations, type Lang, type TranslationKey } from '@/lib/i18n/translations'
vi.mock('@/lib/firebase/vouchers', () => ({ voucherRedeemUrl: (id: string) => `https://landly.test/redeem/${id}` }))
import { CodeReveal, QrReveal } from '@/components/member/VoucherReveal'
import CheckoutSuccessPage from '@/app/checkout/success/page'

const LANGS = Object.keys(translations) as Lang[]
const NEW_KEYS: TranslationKey[] = [
  'success_celebration_title', 'success_voucher_ready', 'success_view_voucher', 'success_to_my_pass',
  'success_keep_exploring', 'success_copy_order_id', 'success_order_id_copied', 'voucher_qr_tap_reveal',
]
const read = (path: string) => readFileSync(path, 'utf8')
const mobile = (path: string) => read(`landly-mobile/src/${path}`)

function render(lang: Lang, element: ReactElement) {
  const dict = translations[lang] as Record<string, string>
  const t = (key: TranslationKey) => dict[key] ?? key
  const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
  return renderToStaticMarkup(createElement(LangContext.Provider, { value: { lang, setLang: () => {}, t, isRtl } }, element))
}

async function redirectTarget(searchParams: Record<string, string | string[]>): Promise<string> {
  try {
    await CheckoutSuccessPage({ searchParams: Promise.resolve(searchParams) })
  } catch (err) {
    // next/navigation's redirect() throws; its digest carries the target.
    return String((err as { digest?: string }).digest).split(';')[2]
  }
  throw new Error('expected a redirect')
}

describe('order confirmation (web)', () => {
  it('sends the old /checkout/success return URL on to /order-success, keeping only the orderId', async () => {
    expect(await redirectTarget({ orderId: 'u_o' })).toBe('/order-success?orderId=u_o')
    expect(await redirectTarget({ orderId: ['a b', 'x'], amount: '1' })).toBe('/order-success?orderId=a%20b')
    expect(await redirectTarget({})).toBe('/order-success')
  })

  it('replaces the sandbox checkout with the confirmation, so back skips the payment step', () => {
    expect(read('components/checkout/DevSandboxPaymentWidget.tsx')).toContain('router.replace(`/order-success?orderId=${encodeURIComponent(orderId)}`)')
  })

  it('celebrates only a paid order read from Firestore, with the order number, the voucher and My Pass', () => {
    const page = read('app/order-success/page.tsx')
    expect(page).toContain('subscribeToOrder(orderId, setOrder)')
    expect(page).toContain('{paid && <Confetti />}')
    // The sequential order number (#1001, ...) is shown and copied; the document id only for orders from before it.
    expect(page).toContain('{orderReference(order.displayOrderNumber, orderId)}')
    expect(page).toContain('<CopyOrderIdButton value={order.displayOrderNumber ?? orderId} />')
    expect(page).toContain('href={`/member/vouchers/${encodeURIComponent(voucherId)}`}')
    expect(page).toContain('href="/member"')
    expect(page).toContain('env(safe-area-inset-bottom)')
  })

  it('draws confetti on a canvas that removes itself and respects reduced motion', () => {
    const confetti = read('components/checkout/Confetti.tsx')
    expect(confetti).toContain("matchMedia('(prefers-reduced-motion: reduce)')")
    expect(confetti).toContain('cancelAnimationFrame(frame)')
    expect(confetti).toContain('pointer-events-none')
  })
})

describe('voucher flip cards (web)', () => {
  it('starts on the front: the back is inert and holds neither the QR nor the code', () => {
    const qr = render('en', createElement(QrReveal, { voucherId: 'user_offer' }))
    expect(qr).toContain('class="flip-card ')
    expect(qr).toContain('Tap to reveal at the counter')
    expect(qr).toMatch(/flip-face flip-face-back" inert=""/)
    expect(qr).not.toContain('<img')

    const code = render('en', createElement(CodeReveal, { code: '48213907' }))
    expect(code).toMatch(/flip-face flip-face-back" inert=""/)
    expect(code).not.toContain('48213907')
    expect(code).not.toContain('Copy code')
  })

  it('turns in 3D with a crossfade under reduced motion, mirrored in Hebrew', () => {
    const css = read('app/globals.css')
    expect(css).toContain('.flip-card{ perspective:1200px; }')
    expect(css).toContain('transform-style:preserve-3d')
    expect(css).toContain('-webkit-backface-visibility:hidden')
    expect(css).toContain('[dir="rtl"] .flip-card.is-flipped .flip-card-inner{ transform:rotateY(-180deg); }')
    expect(css).toMatch(/prefers-reduced-motion: reduce\)\{\s*\.flip-card-inner/)
    expect(render('he', createElement(QrReveal, { voucherId: 'v' }))).toContain('לחצו לחשיפת קוד ה-QR בקופה')
  })
})

describe('order confirmation and flip cards (app)', () => {
  it('registers the confirmation screen, which checkout replaces itself with', () => {
    expect(mobile('app/_layout.tsx')).toContain('<Stack.Screen name="order-success/[orderId]" options={pageFlipOptions(isRtl)} />')
    expect(mobile('app/checkout/[offerId].tsx')).toContain("router.replace({ pathname: '/order-success/[orderId]', params: { orderId } })")
  })

  it('celebrates once with confetti and the success haptic, and leads on to the voucher, My Pass or Explore', () => {
    const screen = mobile('app/order-success/[orderId].tsx')
    expect(screen).toContain('subscribeToOrder(orderId, setOrder)')
    expect(screen).toContain('<Confetti />')
    expect(screen).toContain('success()')
    expect(screen).toContain('useSafeAreaInsets()')
    expect(screen).toContain("router.push({ pathname: '/voucher/[voucherId]', params: { voucherId } })")
    expect(screen).toContain("router.navigate('/wallet')")
    expect(screen).toContain("router.navigate('/')")
    expect(mobile('lib/haptics.ts')).toContain("Platform.OS !== 'web'")
  })

  it('turns the voucher cards on a Reanimated spring with perspective, falling back to a fade', () => {
    const reveal = mobile('components/VoucherReveal.tsx')
    expect(reveal).toContain('const FLIP_SPRING = { damping: 14, stiffness: 90 }')
    expect(reveal).toContain('{ perspective: 1200 }')
    expect(reveal).toContain("backfaceVisibility: 'hidden'")
    expect(reveal).toContain('useReducedMotion()')
    expect(reveal).toContain('const direction = isRtl ? -1 : 1')
    const confetti = mobile('components/Confetti.tsx')
    expect(confetti).toContain('useReducedMotion()')
    expect(confetti).toContain('pointerEvents="none"')
  })
})

describe('celebration strings', () => {
  it.each(LANGS)('are translated in %s', (lang) => {
    const dict = translations[lang] as Record<string, string>
    for (const key of NEW_KEYS) expect(dict[key], `${lang}.${key}`).toBeTruthy()
  })

  it('reads as briefed in Hebrew', () => {
    expect(translations.he.success_celebration_title).toBe('איזה כיף, ההזמנה אושרה!')
    expect(translations.he.success_view_voucher).toBe('צפה בשובר עכשיו')
  })
})
