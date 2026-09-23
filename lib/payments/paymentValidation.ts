import 'server-only'

export class PaymentError extends Error {
  constructor(message: string, public readonly status: number = 409) {
    super(message)
  }
}

export function isDocumentId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 512
    && !value.includes('/') && value !== '.' && value !== '..'
}

export function paymentTerminal(): string {
  const terminal = process.env.TRANZILA_TERMINAL
  if (!terminal || !/^[A-Za-z0-9_-]{1,100}$/.test(terminal)) {
    throw new PaymentError('Payment terminal is not configured.', 503)
  }
  return terminal
}

// Decimal parsing, never parseFloat or rounding: 10.005 is not a 10.01 payment.
export function amountInAgorot(value: unknown): number {
  const text = typeof value === 'number' ? String(value) : value
  if (typeof text !== 'string' || !/^\d{1,12}(?:\.\d{1,2})?$/.test(text)) {
    throw new PaymentError('Invalid payment amount.', 400)
  }
  const [whole, fraction = ''] = text.split('.')
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new PaymentError('Invalid payment amount.', 400)
  return amount
}
