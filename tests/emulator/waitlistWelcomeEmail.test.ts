import { afterAll, beforeEach, expect, it, vi } from 'vitest'
import { Firestore } from 'firebase-admin/firestore'

const send = vi.hoisted(() => vi.fn())
vi.mock('resend', () => ({ Resend: class { emails = { send } } }))

import { sendWaitlistWelcomeEmail } from '@/lib/email/sendWaitlistWelcomeEmail'

if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8787') {
  throw new Error('Run npm run test:emulator; only the isolated loopback emulator is permitted.')
}
const admin = new Firestore({ projectId: 'demo-landly-payments' })
const ref = admin.doc('prelaunch_leads/welcome-lead')

beforeEach(async () => {
  vi.stubEnv('RESEND_API_KEY', 're_test')
  vi.stubEnv('EMAIL_FROM', 'Landly <noreply@golandly.com>')
  send.mockReset().mockResolvedValue({ data: { id: 'm1' }, error: null })
  await ref.set({ firstName: 'Noa', email: 'noa@example.com', lang: 'he' })
})
afterAll(async () => {
  await ref.delete()
  await admin.terminate()
})

it('eight parallel runs send one email', async () => {
  const results = await Promise.all(Array.from({ length: 8 }, () => sendWaitlistWelcomeEmail(admin, 'welcome-lead')))
  expect(send).toHaveBeenCalledTimes(1)
  expect(results.filter((r) => r === 'sent')).toHaveLength(1)
  expect((await ref.get()).data()?.welcomeEmailSent).toBe(true)
})

it('a failed send releases the claim', async () => {
  send.mockResolvedValue({ data: null, error: { name: 'application_error', message: 'x', statusCode: 500 } })
  vi.spyOn(console, 'error').mockImplementation(() => {})
  expect(await sendWaitlistWelcomeEmail(admin, 'welcome-lead')).toBe('failed')
  const data = (await ref.get()).data()
  expect(data).not.toHaveProperty('welcomeEmailSent')
  expect(data).not.toHaveProperty('welcomeEmailSentAt')
})
