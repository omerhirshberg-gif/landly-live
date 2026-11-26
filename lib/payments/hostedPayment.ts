import 'server-only'
import type { Firestore } from 'firebase-admin/firestore'
import { takeHandshake } from './handshakeBudget'
import { buildNotifyUrl } from './notifyToken'
import { amountInAgorot } from './paymentValidation'
import type { HostedPaymentParams } from './hostedFieldsProtocol'
import { notifyOrigin, type TranzilaLiveConfig } from './tranzilaConfig'
import { requestHandshake } from './tranzilaHandshake'

/** What the client needs to run Hosted Fields for one frozen order (CheckoutOrder.payment in lib/payments/checkoutClient.ts). */
export type HostedPayment = HostedPaymentParams

/** Handshake for an order as frozen at checkout: the amount is re-derived from the order's own price, never from a request. */
export async function issueHostedPayment(
  db: Firestore, order: { orderId: string; amount: number }, config: TranzilaLiveConfig,
): Promise<HostedPayment> {
  const amountAgorot = amountInAgorot(order.amount)
  const claims = { orderId: order.orderId, terminal: config.terminal, amountAgorot }
  // Built first: a missing public origin must fail before a handshake is spent.
  const notifyUrl = buildNotifyUrl(notifyOrigin(), claims, config.webhookSecret)
  await takeHandshake(db, order.orderId)
  const { thtk, expiresAtMs } = await requestHandshake(claims, config)
  return {
    provider: 'tranzila-hosted-fields', terminal: config.terminal, thtk, expiresAtMs,
    amountAgorot, currency: 'ILS', notifyUrl, wallets: config.wallets,
  }
}
