import { describe, expect, it } from 'vitest'
import { parseHostedFieldsNotification } from '@/lib/payments/parseHostedFieldsNotification'
import { form, terminal } from '../helpers/paymentFixtures'

const post = (fields: Record<string, string>, query = '') => new Request(`https://landly.test/api/payments/tranzila-webhook${query}`, {
  method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields),
})

describe('parseHostedFieldsNotification', () => {
  it('accepts the canonical iframe fields', async () => {
    const { event, token } = await parseHostedFieldsNotification(post(form), terminal)
    expect(event).toEqual({ orderId: 'user_offer', terminal, tranzilaTxnId: '123', approved: true, responseCode: '000', amountAgorot: 1025, currency: 'ILS' })
    expect(token).toBeNull()
  })
  it('maps Hosted Fields names and takes the order from the signed URL', async () => {
    const { event, token } = await parseHostedFieldsNotification(post({
      terminal_name: terminal, transaction_id: '00123', processor_response_code: '000', amount: '10.25', currency_code: 'ILS', tran_mode: 'A',
    }, '?o=user_offer&t=abc'), terminal)
    expect(event).toMatchObject({ orderId: 'user_offer', tranzilaTxnId: '123', amountAgorot: 1025, approved: true })
    expect(token).toBe('abc')
  })
  it('rejects an order id that disagrees with the URL, and a missing one', async () => {
    await expect(parseHostedFieldsNotification(post(form, '?o=someone_else'), terminal)).rejects.toMatchObject({ status: 400 })
    const { orderId: _omit, ...noOrder } = form
    await expect(parseHostedFieldsNotification(post(noOrder), terminal)).rejects.toMatchObject({ status: 400 })
  })
  it('keeps the strict rules: a verification charge, a foreign terminal, a non-QSTR body, success fields', async () => {
    await expect(parseHostedFieldsNotification(post({ ...form, tranmode: 'V' }), terminal)).rejects.toMatchObject({ status: 400 })
    await expect(parseHostedFieldsNotification(post({ ...form, supplier: 'other' }), terminal)).rejects.toMatchObject({ status: 400 })
    await expect(parseHostedFieldsNotification(post({ ...form, success: 'true' }), terminal)).rejects.toMatchObject({ status: 400 })
    const json = new Request('https://landly.test/x', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    await expect(parseHostedFieldsNotification(json, terminal)).rejects.toMatchObject({ status: 415 })
  })
})
