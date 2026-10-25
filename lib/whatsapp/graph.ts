import 'server-only'

// The one place that talks to Meta's WhatsApp Cloud API: the phone-change
// code (lib/auth/phoneVerification.ts) and the support bot's replies
// (lib/whatsapp/supportBotHandler.ts) both send through sendWhatsAppMessage,
// and members' attachments are fetched here for lib/whatsapp/mediaStore.ts.
// The access token is read here only and never logged.

const WHATSAPP_TIMEOUT_MS = 10_000

/**
 * The Graph API version every call uses. v21.0 is supported until about
 * January 2027 (two years after its successor shipped); WHATSAPP_GRAPH_VERSION
 * moves to a newer one. A malformed value is ignored rather than sent.
 */
export const DEFAULT_GRAPH_VERSION = 'v21.0'

export function graphVersion(): string {
  const configured = process.env.WHATSAPP_GRAPH_VERSION?.trim()
  return configured && /^v\d+\.\d+$/.test(configured) ? configured : DEFAULT_GRAPH_VERSION
}

/**
 * Names the first missing Cloud API setting, or null when sending is
 * configured. `phoneNumberId` is the number to send from when the caller
 * knows it (the support bot answers from the number that was written to);
 * otherwise WHATSAPP_PHONE_NUMBER_ID.
 */
export function whatsappConfigProblem(phoneNumberId?: string): string | null {
  if (!process.env.WHATSAPP_ACCESS_TOKEN) return 'WHATSAPP_ACCESS_TOKEN is not configured'
  if (!phoneNumberId && !process.env.WHATSAPP_PHONE_NUMBER_ID) return 'WHATSAPP_PHONE_NUMBER_ID is not configured'
  return null
}

/**
 * Real messages leave in production; elsewhere only with
 * WHATSAPP_OTP_LIVE=true (to try the real thing from a laptop), and never
 * without credentials. Otherwise callers simulate by logging.
 */
export function whatsappLive(phoneNumberId?: string): boolean {
  const live = process.env.NODE_ENV === 'production' || process.env.WHATSAPP_OTP_LIVE === 'true'
  return live && !whatsappConfigProblem(phoneNumberId)
}

/** Meta refused the message or couldn't be reached; `code` is Meta's error code, or 'network' / 'not_configured'. */
export class WhatsAppApiError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'WhatsAppApiError'
  }
}

type ReplyButton = { type: 'reply'; reply: { id: string; title: string } }

/**
 * The message types Landly sends (https://developers.facebook.com/docs/whatsapp/cloud-api/messages).
 * No list messages: they open a bottom sheet on phones, so every choice is a reply button in the bubble.
 */
export type WhatsAppMessage =
  | { type: 'text'; text: { body: string; preview_url?: boolean } }
  | { type: 'template'; template: { name: string; language: { code: string }; components: unknown[] } }
  | {
      type: 'interactive'
      interactive: { type: 'button'; body: { text: string }; footer?: { text: string }; action: { buttons: ReplyButton[] } }
    }
  | {
      type: 'interactive'
      interactive: { type: 'cta_url'; body: { text: string }; action: { name: 'cta_url'; parameters: { display_text: string; url: string } } }
    }

/**
 * Sends one message to an E.164 number or a WhatsApp ID (digits, no "+"),
 * from `phoneNumberId` when given, else WHATSAPP_PHONE_NUMBER_ID. Resolves
 * to Meta's id for the sent message (wamid…), when the response has one.
 */
export async function sendWhatsAppMessage(to: string, message: WhatsAppMessage, phoneNumberId?: string): Promise<string | undefined> {
  const problem = whatsappConfigProblem(phoneNumberId)
  if (problem) throw new WhatsAppApiError('not_configured', problem)
  const from = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID
  const url = `https://graph.facebook.com/${graphVersion()}/${from}/messages`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), WHATSAPP_TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: to.replace(/^\+/, ''), ...message }),
      signal: controller.signal,
    })
  } catch (err) {
    throw new WhatsAppApiError('network', err instanceof Error ? err.message : String(err))
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { code?: number; message?: string } } | null
    throw new WhatsAppApiError(String(body?.error?.code ?? res.status), body?.error?.message ?? `HTTP ${res.status}`)
  }
  const sent = (await res.json().catch(() => null)) as { messages?: { id?: unknown }[] } | null
  const id = sent?.messages?.[0]?.id
  return typeof id === 'string' && id ? id : undefined
}

/** What Meta says about a member's attachment (GET /{version}/{media-id}); `url` lasts about five minutes and needs the token too. */
export interface WhatsAppMediaInfo {
  url: string
  mimeType?: string
  sha256?: string
  size?: number
}

// Meta serves attachments from its CDN; the token is never sent anywhere else.
const MEDIA_HOST = /(^|\.)(fbsbx\.com|facebook\.com|fbcdn\.net|whatsapp\.net)$/

/** The download URL and details of an attachment from the webhook; `signal` bounds the call. */
export async function fetchWhatsAppMediaInfo(mediaId: string, signal: AbortSignal): Promise<WhatsAppMediaInfo> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  if (!token) throw new WhatsAppApiError('not_configured', 'WHATSAPP_ACCESS_TOKEN is not configured')
  let res: Response
  try {
    res = await fetch(`https://graph.facebook.com/${graphVersion()}/${encodeURIComponent(mediaId)}`, { headers: { Authorization: `Bearer ${token}` }, signal })
  } catch (err) {
    throw new WhatsAppApiError('network', err instanceof Error ? err.message : String(err))
  }
  const body = (await res.json().catch(() => null)) as { url?: unknown; mime_type?: unknown; sha256?: unknown; file_size?: unknown; error?: { code?: number; message?: string } } | null
  if (!res.ok) throw new WhatsAppApiError(String(body?.error?.code ?? res.status), body?.error?.message ?? `HTTP ${res.status}`)
  const url = typeof body?.url === 'string' ? body.url : ''
  let host = ''
  try {
    const parsed = new URL(url)
    host = parsed.protocol === 'https:' ? parsed.hostname : ''
  } catch {}
  if (!MEDIA_HOST.test(host)) throw new WhatsAppApiError('bad_media_url', 'Meta returned no usable media URL')
  const size = Number(body?.file_size)
  return {
    url,
    ...(typeof body?.mime_type === 'string' && body.mime_type ? { mimeType: body.mime_type } : {}),
    ...(typeof body?.sha256 === 'string' && body.sha256 ? { sha256: body.sha256 } : {}),
    ...(Number.isFinite(size) && size >= 0 ? { size } : {}),
  }
}

/** Opens the attachment's bytes (a URL from fetchWhatsAppMediaInfo) as a stream; `signal` bounds the whole download. */
export async function downloadWhatsAppMedia(url: string, signal: AbortSignal): Promise<Response> {
  let res: Response
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` }, signal, redirect: 'error' })
  } catch (err) {
    throw new WhatsAppApiError('network', err instanceof Error ? err.message : String(err))
  }
  if (!res.ok || !res.body) {
    await res.body?.cancel().catch(() => {})
    throw new WhatsAppApiError(String(res.status), `Media download failed: HTTP ${res.status}`)
  }
  return res
}
