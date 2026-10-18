import 'server-only'
import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after } from 'next/server'
import { type Firestore, Timestamp } from 'firebase-admin/firestore'
import { getAdminAuth } from '@/lib/firebase/admin'
import { applicationOrigin, isValidLang } from '@/lib/auth/requestContext'
import { EmailProviderError, emailConfigProblem, renderBrandedEmail } from '@/lib/email/brandedEmail'
import { buildOrderConfirmationEmail, sendOrderConfirmationEmail, type OrderConfirmationDetails } from '@/lib/email/sendOrderConfirmationEmail'
import { normalizeImageUrl } from '@/lib/offers/imageUrl'
import { normalizeDisplayOrderNumber } from './orderNumber'
import { isDocumentId } from './paymentValidation'

/** Where local dev writes order emails it can't send (no Resend credentials). */
export const EMAIL_PREVIEW_DIR = join(tmpdir(), 'landly-email-previews')

// Called by the settlement routes once claimOfferForOrder has freshly marked an
// order paid -- never from inside the transaction, which Firestore may retry,
// and never for a replay (alreadyProcessed), so a Tranzila retry doesn't email
// twice. `after` sends once the response is out; Vercel keeps the function
// alive until it finishes. The payment is committed by now, so scheduling must
// never fail the response: outside a request scope (where `after` throws) the
// send just starts in the background.
export function scheduleOrderConfirmation(db: Firestore, orderId: string): void {
  try {
    after(() => sendOrderConfirmation(db, orderId))
  } catch {
    void sendOrderConfirmation(db, orderId)
  }
}

// Emails the member their confirmation. Never throws: the payment is already
// settled, so a failure is only logged (order id, no address or card data).
export async function sendOrderConfirmation(db: Firestore, orderId: string): Promise<void> {
  try {
    const order = (await db.collection('orders').doc(orderId).get()).data()
    if (!order || order.status !== 'paid' || !isDocumentId(order.voucherId)
      || !isDocumentId(order.userId) || !isDocumentId(order.offerId)) {
      console.error('Order confirmation skipped', { orderId, reason: 'Order is not a settled, paid order' })
      return
    }
    const [user, userSnap, offerSnap] = await Promise.all([
      getAdminAuth().getUser(order.userId),
      db.collection('users').doc(order.userId).get(),
      db.collection('offers').doc(order.offerId).get(),
    ])
    if (!user.email) {
      console.error('Order confirmation skipped', { orderId, reason: 'Member has no email address' })
      return
    }
    const preferred = userSnap.data()?.preferredLanguage
    const lang = isValidLang(preferred) ? preferred : 'en'
    const origin = applicationOrigin()
    const rawImage = offerSnap.data()?.imageUrl
    const imageUrl = normalizeImageUrl(typeof rawImage === 'string' ? rawImage : '')
    const details: OrderConfirmationDetails = {
      orderId,
      displayOrderNumber: normalizeDisplayOrderNumber(order.displayOrderNumber),
      paidAt: order.paidAt instanceof Timestamp ? order.paidAt.toDate() : new Date(),
      businessName: typeof order.businessName === 'string' ? order.businessName : '',
      offerTitle: typeof order.offerTitle === 'string' ? order.offerTitle : '',
      // Mail clients only load https images; anything else drops the thumbnail.
      imageUrl: imageUrl.startsWith('https://') ? imageUrl : '',
      amount: order.amount,
      originalPrice: typeof order.originalPrice === 'number' && order.originalPrice > order.amount ? order.originalPrice : null,
      voucherLink: `${origin}/member/vouchers/${encodeURIComponent(order.voucherId)}`,
    }

    const problem = emailConfigProblem()
    if (problem) {
      if (process.env.NODE_ENV === 'production') {
        console.error('Order confirmation not sent', { orderId, reason: problem })
        return
      }
      // Local dev without Resend: keep the purchase flowing and leave the
      // rendered email on disk to open in a browser.
      const email = buildOrderConfirmationEmail(lang, details)
      await mkdir(EMAIL_PREVIEW_DIR, { recursive: true })
      const file = join(EMAIL_PREVIEW_DIR, `order-${orderId}.html`)
      await writeFile(file, renderBrandedEmail({ lang, origin, ...email }), 'utf8')
      console.info(`[email preview] ${problem}; order confirmation not sent`, {
        to: user.email, subject: email.subject, voucherLink: details.voucherLink, preview: file,
      })
      return
    }
    await sendOrderConfirmationEmail({ to: user.email, lang, origin, order: details })
  } catch (err) {
    console.error('Order confirmation email failed', {
      orderId,
      reason: err instanceof EmailProviderError ? err.code : err instanceof Error ? err.message : 'Unknown error',
    })
  }
}
