import 'server-only'
import { readNotificationForm } from './parseTranzilaNotification'
import { isDocumentId, PaymentError } from './paymentValidation'

// Notify for a Hosted Fields charge is only a TRIGGER. Tranzila's docs do not specify its payload (only the Base44 guide shows
// a QSTR POST with Response/sum/TranzilaTK/ConfirmationCode), so nothing in the body is required or trusted: the order id
// and amount come from the signed notify_url (`o`, `a`, `t`), and what happened is read from Tranzila by the verifier
// (settleOrderById). A body with an `orderId` is accepted only as the order id for the optional header gate.
export interface NotifyTrigger {
  orderId: string
  /** The signed amount from the URL; null when the call came without one (header gate). */
  amountAgorot: number | null
  token: string | null
}

export async function parseNotifyTrigger(request: Request): Promise<NotifyTrigger> {
  const query = new URL(request.url).searchParams
  let bodyOrder: string | null = null
  // Whatever Tranzila posts (QSTR, or nothing) is ignored unless it carries our orderId; a malformed body is not an error.
  try {
    bodyOrder = (await readNotificationForm(request)).get('orderId')
  } catch (err) {
    if (err instanceof PaymentError && err.status === 413) throw err
  }
  const queryOrder = query.get('o')
  if (queryOrder && bodyOrder && queryOrder !== bodyOrder) throw new PaymentError('Conflicting order identifiers.', 400)
  const orderId = queryOrder ?? bodyOrder
  if (!isDocumentId(orderId)) throw new PaymentError('Invalid orderId.', 400)
  const rawAmount = query.get('a')
  const amountAgorot = rawAmount !== null && /^\d{1,12}$/.test(rawAmount) ? Number(rawAmount) : null
  return { orderId, amountAgorot, token: query.get('t') }
}
