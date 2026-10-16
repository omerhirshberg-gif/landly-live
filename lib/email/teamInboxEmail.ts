import 'server-only'
import { SUPPORT_EMAIL } from '@/lib/config'
import { EmailProviderError, emailConfigProblem, escapeHtml, getResend } from './brandedEmail'

// Shared shell for the public contact forms (/support, /business, /olim) that
// land in the team inbox: a plain internal email (not the branded customer
// shell) listing the fields, the free-text message, and Reply-To set to the
// sender so answering from Gmail reaches them directly.

export interface TeamInboxRow {
  label: string
  value: string
  /** Makes the value a link (mailto:, tel:). */
  href?: string
}

export interface TeamInboxEmail {
  subject: string
  heading: string
  rows: TeamInboxRow[]
  /** Free text, shown in its own block with line breaks kept. */
  message: string
  /** Who the footer says Reply reaches, e.g. the sender's name. */
  replyName: string
  /** Which form it came from, for the footer ("the Landly support form"). */
  source: string
  replyTo: string
}

export function buildTeamInboxEmail(email: Omit<TeamInboxEmail, 'replyTo'>) {
  const { subject, heading, rows, message, replyName, source } = email
  const text = [...rows.map((r) => `${r.label}: ${r.value}`), '', 'Message:', message].join('\n')
  const cell = (r: TeamInboxRow) =>
    r.href ? `<a href="${escapeHtml(r.href)}" style="color:#2563EB;">${escapeHtml(r.value)}</a>` : escapeHtml(r.value)
  // dir="auto" on the values and message so Hebrew text renders right-to-left.
  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:24px;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0F172A;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:12px;">
<tr><td style="padding:24px 28px;">
<h1 style="margin:0 0 16px 0;font-size:18px;">${escapeHtml(heading)}</h1>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;line-height:20px;">
${rows.map((r) => `<tr><td style="padding:2px 16px 2px 0;color:#64748B;font-weight:600;vertical-align:top;white-space:nowrap;">${escapeHtml(r.label)}</td><td dir="auto" style="padding:2px 0;">${cell(r)}</td></tr>`).join('\n')}
</table>
<div dir="auto" style="margin-top:20px;padding:16px;background:#F1F5F9;border-radius:8px;font-size:15px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(message)}</div>
<p style="margin:16px 0 0 0;font-size:12px;color:#94A3B8;">Sent from ${escapeHtml(source)}. Reply to this email to answer ${escapeHtml(replyName)} directly.</p>
</td></tr></table>
</body></html>`
  return { subject, text, html }
}

export async function sendToTeamInbox(email: TeamInboxEmail): Promise<void> {
  const problem = emailConfigProblem()
  if (problem) throw new Error(problem)
  const { subject, text, html } = buildTeamInboxEmail(email)
  const { error } = await getResend().emails.send({
    from: process.env.EMAIL_FROM!,
    to: SUPPORT_EMAIL,
    replyTo: email.replyTo,
    subject,
    text,
    html,
  })
  if (error) throw new EmailProviderError(error.name, error.statusCode, error.message)
}
