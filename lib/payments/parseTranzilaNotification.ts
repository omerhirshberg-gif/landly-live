import 'server-only'
import { amountInAgorot, isDocumentId, PaymentError } from './paymentValidation'

export interface TranzilaNotification {
  orderId: string
  terminal: string
  tranzilaTxnId: string
  responseCode: string
  approved: boolean
  amountAgorot: number
  currency: 'ILS'
}

// Iframe Notify: POST, QSTR (application/x-www-form-urlencoded).
// https://docs.tranzila.com/docs/vibe-coding/closing-an-order-in-base44-using-notify-page
// https://docs.tranzila.com/docs/payments-and-billing/iframe-integration-directng
// orderId is OUR required echoed custom field, not a built-in Tranzila field.
export async function parseTranzilaNotification(request: Request, terminal: string): Promise<TranzilaNotification> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/x-www-form-urlencoded') {
    throw new PaymentError('Expected a QSTR form notification.', 415)
  }
  // Bound the stream itself, including requests without Content-Length.
  const reader = request.body?.getReader()
  if (!reader) throw new PaymentError('Missing notification.', 400)
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > 65536) {
      await reader.cancel()
      throw new PaymentError('Notification is too large.', 413)
    }
    chunks.push(value)
  }
  const form = new URLSearchParams(Buffer.concat(chunks).toString('utf8'))
  const field = (name: string): string => {
    const values = form.getAll(name)
    if (values.length !== 1 || !values[0]) throw new PaymentError(`Missing or duplicate ${name}.`, 400)
    return values[0]
  }
  if (form.has('success')) throw new PaymentError('Unsupported success field.', 400)
  const orderId = field('orderId')
  if (!isDocumentId(orderId)) throw new PaymentError('Invalid orderId.', 400)
  if (field('supplier') !== terminal) throw new PaymentError('Unexpected payment terminal.', 400)
  const index = field('index')
  if (!/^\d{1,20}$/.test(index) || /^0+$/.test(index)) throw new PaymentError('Invalid transaction index.', 400)
  const tranzilaTxnId = index.replace(/^0+/, '')
  if (form.has('transaction_id')) {
    const alias = field('transaction_id')
    if (!/^\d{1,20}$/.test(alias) || alias.replace(/^0+/, '') !== tranzilaTxnId) {
      throw new PaymentError('Conflicting transaction identifiers.', 400)
    }
  }
  const response = field('Response')
  if (!/^-?\d{1,3}$/.test(response)) throw new PaymentError('Invalid response code.', 400)
  const approved = response === '000' || response === '0'
  if (field('currency') !== '1') throw new PaymentError('Expected ILS currency.', 400)
  // A successful card verification/tokenization is NOT a successful charge.
  if (field('tranmode') !== 'A') throw new PaymentError('Expected a standard charge.', 400)
  return {
    orderId, terminal, tranzilaTxnId, approved,
    responseCode: approved ? '000' : response,
    amountAgorot: amountInAgorot(field('sum')),
    currency: 'ILS',
  }
}
