import 'server-only'
import { SUPPORT_EMAIL } from '@/lib/config'
import { EmailProviderError, emailConfigProblem, escapeHtml, getResend } from '@/lib/email/brandedEmail'
import { getAdminProjectId } from '@/lib/firebase/admin'
import { recordUsage } from '@/lib/usage/recordUsage'
import { usageEnvOf } from '@/lib/usage/usageTypes'
import type { AlertKind, AlertRun } from './alerts'

// One email to the team when the daily inventory check raised something new. Like the Raayonit sync alert, only the production
// project with a Resend key really sends; elsewhere the send is counted and simulated. Counts only: never a voucher code.
const TITLES: Record<AlertKind, string> = {
  expiry_30: 'Unsold stock expiring within 30 days',
  expiry_7: 'Unsold stock expiring within 7 days',
  low_stock: 'Low stock',
  balance_discrepancy: 'Balance not explained by the ledger',
  sync_failures: 'Supplier failed 3 times in a row',
}

export function inventoryAlertContent(run: AlertRun, day: string): { subject: string; text: string; html: string } {
  const lines = run.raised.map((k) => `${TITLES[k]}: ${run.counts[k]}`)
  const subject = `Inventory alerts ${day}: ${run.raised.length} to review`
  const text = [`Inventory check ${day}`, ...lines, 'Open Admin > Inventory > Alerts.'].join('\n')
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;line-height:1.5;color:#0f172a"><h2 style="margin:0 0 12px">Inventory check ${escapeHtml(day)}</h2><ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul><p>Open Admin &gt; Inventory &gt; Alerts.</p></div>`
  return { subject, text, html }
}

export type InventoryAlertOutcome = 'sent' | 'simulated' | 'none'

export async function sendInventoryAlertEmail(run: AlertRun, day: string): Promise<InventoryAlertOutcome> {
  if (run.raised.length === 0) return 'none'
  const { subject, text, html } = inventoryAlertContent(run, day)
  if (!(process.env.RESEND_API_KEY && usageEnvOf(getAdminProjectId()) === 'prod')) {
    recordUsage('resend.simulated')
    return 'simulated'
  }
  const problem = emailConfigProblem()
  if (problem) throw new Error(problem)
  const { error } = await getResend().emails.send({ from: process.env.EMAIL_FROM!, to: process.env.COSTS_REPORT_EMAIL?.trim() || SUPPORT_EMAIL, subject, text, html }, { idempotencyKey: `inventory-alerts-${day}` })
  if (error) throw new EmailProviderError(error.name, error.statusCode, error.message)
  return 'sent'
}
