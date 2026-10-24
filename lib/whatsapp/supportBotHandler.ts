import 'server-only'
import { Timestamp } from 'firebase-admin/firestore'
import { SUPPORT_EMAIL } from '@/lib/config'
import { applicationOrigin } from '@/lib/auth/requestContext'
import { maskPhone } from '@/lib/auth/phoneVerification'
import { getAdminDb } from '@/lib/firebase/admin'
import { notifyTeam } from './escalation'
import { sendWhatsAppMessage, whatsappLive, type WhatsAppMessage } from './graph'
import { botLanguage, decide, linkMessage, menuMessage, textMessage, type BotContext } from './supportBot'
import type { InboundEvent } from './webhookPayload'

// The support bot's side effects, run by after() once the webhook has
// answered Meta (app/api/webhooks/whatsapp/route.ts). Server-only state:
//
// - whatsappInbound/{messageId}: one per message, created first, so a retried
//   delivery is answered once. Expires after INBOUND_TTL_MS (a Firestore TTL
//   policy on expiresAt deletes it).
// - whatsappConversations/{waId}: the matched member, language, when the menu
//   was last sent, when the member asked for the team, and the last text.
//
// Replies leave from the number the member wrote to (the event's
// phoneNumberId), else WHATSAPP_PHONE_NUMBER_ID. Outside production (and
// without WHATSAPP_OTP_LIVE=true) they are only logged, like the phone-change
// code.

const INBOUND_TTL_MS = 7 * 24 * 60 * 60 * 1000
/** Meta allows free-form replies for 24 hours after the member's message; older retries get none. */
const REPLY_WINDOW_MS = 24 * 60 * 60 * 1000
const ALREADY_EXISTS = 6

const millis = (value: unknown) => (value instanceof Timestamp ? value.toMillis() : undefined)

/** Handles each event in turn; never throws (its failures are logged). */
export async function handleInboundEvents(events: InboundEvent[]): Promise<void> {
  for (const event of events) {
    try {
      await handleInboundEvent(event)
    } catch (err) {
      console.error(`[whatsapp-bot] ${event.messageId} from ${maskPhone(`+${event.waId}`)} failed:`, err instanceof Error ? err.message : err)
    }
  }
}

export async function handleInboundEvent(event: InboundEvent, now = Date.now()): Promise<void> {
  const db = getAdminDb()
  try {
    await db.collection('whatsappInbound').doc(event.messageId).create({
      receivedAt: Timestamp.fromMillis(now),
      expiresAt: Timestamp.fromMillis(now + INBOUND_TTL_MS),
    })
  } catch (err) {
    if ((err as { code?: unknown })?.code === ALREADY_EXISTS) return
    throw err
  }
  if (now - event.at > REPLY_WINDOW_MS) return

  const conversationRef = db.collection('whatsappConversations').doc(event.waId)
  const [conversation, members] = await Promise.all([
    conversationRef.get(),
    db.collection('users').where('phone', '==', `+${event.waId}`).limit(1).get(),
  ])
  const member = members.empty ? undefined : members.docs[0]
  const firstName = typeof member?.get('firstName') === 'string' && member.get('firstName') ? (member.get('firstName') as string) : undefined
  const ctx: BotContext = {
    lang: botLanguage(event.waId, member?.get('preferredLanguage')),
    origin: applicationOrigin(),
    memberFirstName: firstName,
    isMember: !!member,
    lastMenuAt: millis(conversation.get('lastMenuAt')),
    escalatedAt: millis(conversation.get('escalatedAt')),
    now,
  }

  const lastText = event.kind === 'text' ? event.text : (conversation.get('lastText') as string | undefined)
  const update: Record<string, unknown> = {
    lang: ctx.lang,
    lastInboundAt: Timestamp.fromMillis(event.at),
    ...(member ? { uid: member.id } : {}),
    ...(event.kind === 'text' ? { lastText: event.text.slice(0, 1000) } : {}),
  }

  const decision = decide(event, ctx)
  // Saved even when a reply fails, so a team already emailed keeps the bot quiet.
  try {
    switch (decision.kind) {
      case 'menu':
        await reply(event, menuMessage(ctx))
        update.lastMenuAt = Timestamp.fromMillis(now)
        break
      case 'link':
        await reply(event, linkMessage(decision.action, ctx))
        break
      case 'alreadyEscalated':
        await reply(event, textMessage(ctx.lang, 'wa_bot_team_already'))
        break
      case 'escalate': {
        const displayName = typeof member?.get('displayName') === 'string' && member.get('displayName') ? (member.get('displayName') as string) : event.name
        const email = typeof member?.get('email') === 'string' ? (member.get('email') as string) || undefined : undefined
        try {
          await notifyTeam({ waId: event.waId, lang: ctx.lang, name: displayName, uid: member?.id, email, lastText })
        } catch (err) {
          // The team never heard: say so, and don't silence the bot.
          console.error(`[whatsapp-bot] team notification for ${maskPhone(`+${event.waId}`)} failed:`, err instanceof Error ? err.message : err)
          await reply(event, textMessage(ctx.lang, 'wa_bot_team_failed', SUPPORT_EMAIL))
          break
        }
        update.escalatedAt = Timestamp.fromMillis(now)
        await reply(event, textMessage(ctx.lang, 'wa_bot_team_confirm'))
        break
      }
      case 'silent':
        break
    }
  } finally {
    await conversationRef.set(update, { merge: true })
  }
}

async function reply({ waId, phoneNumberId }: InboundEvent, message: WhatsAppMessage): Promise<void> {
  const to = maskPhone(`+${waId}`)
  if (!whatsappLive(phoneNumberId)) {
    console.info(`[whatsapp-bot] simulated reply to ${to}: ${JSON.stringify(message)}`)
    return
  }
  await sendWhatsAppMessage(waId, message, phoneNumberId)
  console.info(`[whatsapp-bot] sent ${message.type} reply to ${to} from ${phoneNumberId ?? 'WHATSAPP_PHONE_NUMBER_ID'}`)
}
