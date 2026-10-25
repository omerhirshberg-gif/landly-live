import 'server-only'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { SUPPORT_EMAIL } from '@/lib/config'
import { applicationOrigin } from '@/lib/auth/requestContext'
import { maskPhone } from '@/lib/auth/phoneVerification'
import { getAdminDb } from '@/lib/firebase/admin'
import type { Lang } from '@/lib/i18n/translations'
import { logMessages, MESSAGE_TTL_MS, snippetOf, type LoggedMessage } from './conversationLog'
import { notifyTeam } from './escalation'
import { sendWhatsAppMessage, whatsappLive, type WhatsAppMessage } from './graph'
import {
  alreadyEscalatedMessage,
  botLanguage,
  buttonTitle,
  currentStatus,
  CUSTOMER_SERVICE_WINDOW_MS,
  decide,
  escalatedMessage,
  followUpMessage,
  inquiryPromptMessage,
  isConversationStatus,
  isInquiryCategory,
  LANGUAGE_NAMES,
  languagePickerMessages,
  menuMessages,
  resolvedMessage,
  submenuMessage,
  textMessage,
  topicMessages,
  transcriptText,
  type BotContext,
} from './supportBot'
import { isBotLanguage, type InboundEvent } from './webhookPayload'

// The support bot's side effects, run by after() once the webhook has
// answered Meta (app/api/webhooks/whatsapp/route.ts). Server-only state:
//
// - whatsappInbound/{messageId}: one per message, created first, so a retried
//   delivery is answered once. Expires after INBOUND_TTL_MS (a Firestore TTL
//   policy on expiresAt deletes it).
// - whatsappConversations/{waId}: the matched member (uid, memberName), the
//   WhatsApp profile name, the language (picked when langSelectedAt is set),
//   the number they wrote to (phoneNumberId, where admin replies leave from),
//   the last text and lastSnippet for the inbox list, and the conversation's
//   state (lib/whatsapp/supportBot.ts): status (active |
//   awaiting_user_inquiry | escalated | resolved), lastMenuAt, lastNudgeAt,
//   inquiryPromptedAt, escalatedAt, resolvedAt, inquiryCategory (what
//   the latest request to the team is about), and the idle check-in's
//   idleCheckInAt / idleResume (lib/whatsapp/idleSweep.ts, cleared by any
//   message from the member). expiresAt is MESSAGE_TTL_MS (180 days) after
//   the latest message either way, so a Firestore TTL policy deletes the
//   conversation with its last message.
// - whatsappConversations/{waId}/messages: the message and the bot's replies
//   (lib/whatsapp/conversationLog.ts).
//
// Firestore is getAdminDb()'s project, which lib/firebase/envGuard.ts pins:
// the dev project locally and on Vercel Preview, production on Production.
//
// Replies leave from the number the member wrote to (the event's
// phoneNumberId), else WHATSAPP_PHONE_NUMBER_ID. Outside production (and
// without WHATSAPP_OTP_LIVE=true) they are only logged, like the phone-change
// code.

const INBOUND_TTL_MS = 7 * 24 * 60 * 60 * 1000
const ALREADY_EXISTS = 6

const millis = (value: unknown) => (value instanceof Timestamp ? value.toMillis() : undefined)
const nonEmpty = (value: unknown) => (typeof value === 'string' && value ? value : undefined)

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
  if (now - event.at > CUSTOMER_SERVICE_WINDOW_MS) return

  const conversationRef = db.collection('whatsappConversations').doc(event.waId)
  const [conversation, members] = await Promise.all([
    conversationRef.get(),
    db.collection('users').where('phone', '==', `+${event.waId}`).limit(1).get(),
  ])
  const member = members.empty ? undefined : members.docs[0]
  const firstName = nonEmpty(member?.get('firstName'))
  const memberName = nonEmpty(member?.get('displayName')) ?? firstName
  const storedStatus = conversation.get('status')
  // The stored lang counts as picked only once langSelectedAt is set; before
  // the picker existed it was the bot's guess.
  const picked = conversation.get('langSelectedAt') !== undefined ? conversation.get('lang') : undefined
  const profileLang = member?.get('preferredLanguage')
  const ctx: BotContext = {
    lang: botLanguage(picked, profileLang),
    origin: applicationOrigin(),
    memberFirstName: firstName,
    isMember: !!member,
    needsLanguage: !isBotLanguage(picked) && !isBotLanguage(profileLang),
    status: isConversationStatus(storedStatus) ? storedStatus : undefined,
    lastMenuAt: millis(conversation.get('lastMenuAt')),
    lastNudgeAt: millis(conversation.get('lastNudgeAt')),
    inquiryPromptedAt: millis(conversation.get('inquiryPromptedAt')),
    inquiryCategory: isInquiryCategory(conversation.get('inquiryCategory')) ? conversation.get('inquiryCategory') : undefined,
    escalatedAt: millis(conversation.get('escalatedAt')),
    idleCheckInAt: millis(conversation.get('idleCheckInAt')),
    idleResume: conversation.get('idleResume') === 'inquiry' ? 'inquiry' : undefined,
    now,
  }

  const inbound = inboundEntry(event, ctx.lang)
  const outbound: LoggedMessage[] = []
  // Replies sort after the message they answer, in the order sent.
  const sentAt = Math.max(now, event.at)
  const reply = async (...messages: WhatsAppMessage[]) => {
    for (const message of messages) {
      const result = await send(event, message)
      outbound.push({ ...result, direction: 'out', author: 'bot', kind: message.type === 'text' ? 'text' : 'interactive', text: transcriptText(message), at: sentAt + outbound.length + 1 })
    }
  }

  // Whatever comes next moves the conversation on: an inquiry prompt or a
  // resolution lasts one message, an escalation until it lapses.
  const status = currentStatus(ctx)
  const at = Timestamp.fromMillis(now)
  const clear = conversation.exists ? FieldValue.delete() : undefined
  const update: Record<string, unknown> = {
    lang: ctx.lang,
    lastInboundAt: Timestamp.fromMillis(event.at),
    lastSnippet: snippetOf(inbound),
    status: status === 'escalated' ? 'escalated' : 'active',
    ...(clear && ctx.inquiryPromptedAt !== undefined ? { inquiryPromptedAt: clear } : {}),
    // The member is back: the idle check-in, if any, is answered.
    ...(clear && conversation.get('idleCheckInAt') !== undefined ? { idleCheckInAt: clear } : {}),
    ...(clear && conversation.get('idleResume') !== undefined ? { idleResume: clear } : {}),
    ...(member ? { uid: member.id } : {}),
    ...(memberName ? { memberName } : {}),
    ...(event.name ? { profileName: event.name } : {}),
    ...(event.phoneNumberId ? { phoneNumberId: event.phoneNumberId } : {}),
    ...(event.kind === 'text' ? { lastText: event.text.slice(0, 1000) } : {}),
  }

  const decision = decide(event, ctx)
  // Saved even when a reply fails, so a team already emailed keeps the bot quiet.
  try {
    switch (decision.kind) {
      case 'menu':
        await reply(...menuMessages(ctx))
        update.lastMenuAt = at
        break
      case 'submenu':
        await reply(submenuMessage(decision.menu, ctx.lang))
        break
      case 'languagePicker':
        await reply(...languagePickerMessages())
        update.lastMenuAt = at
        break
      case 'languageChosen': {
        const lang = decision.lang
        Object.assign(update, { lang, langSelectedAt: at, lastMenuAt: at })
        // The member's profile follows the choice, so the site and emails match.
        if (member) await member.ref.set({ preferredLanguage: lang }, { merge: true })
        await reply(textMessage(lang, 'wa_bot_lang_changed'), ...menuMessages({ ...ctx, lang }))
        break
      }
      case 'nudge':
        await reply(textMessage(ctx.lang, 'wa_bot_nudge'))
        update.lastNudgeAt = at
        break
      case 'topic':
        await reply(...topicMessages(decision.topic, ctx))
        break
      case 'promptInquiry':
        update.status = 'awaiting_user_inquiry'
        update.inquiryPromptedAt = at
        update.inquiryCategory = decision.category
        await reply(inquiryPromptMessage(ctx.lang))
        break
      case 'alreadyEscalated':
        await reply(alreadyEscalatedMessage(ctx.lang))
        break
      case 'escalate': {
        const email = nonEmpty(member?.get('email'))
        const inquiry = event.kind === 'text' ? event.text : undefined
        try {
          await notifyTeam({
            waId: event.waId,
            lang: ctx.lang,
            name: memberName ?? event.name,
            uid: member?.id,
            email,
            inquiry,
            category: ctx.inquiryCategory ?? 'general',
            origin: ctx.origin,
          })
        } catch (err) {
          // The team never heard: say so, and don't silence the bot.
          console.error(`[whatsapp-bot] team notification for ${maskPhone(`+${event.waId}`)} failed:`, err instanceof Error ? err.message : err)
          await reply(textMessage(ctx.lang, 'wa_bot_team_failed', SUPPORT_EMAIL))
          break
        }
        update.status = 'escalated'
        update.escalatedAt = at
        await reply(escalatedMessage(ctx.lang))
        break
      }
      case 'resolve':
        update.status = 'resolved'
        update.resolvedAt = at
        // The next message starts over with a fresh menu.
        if (clear) Object.assign(update, { escalatedAt: clear, lastMenuAt: clear, lastNudgeAt: clear, inquiryPromptedAt: clear })
        await reply(resolvedMessage(ctx.lang))
        break
      case 'silent':
        break
    }
  } finally {
    if (outbound.length) update.lastOutboundAt = Timestamp.fromMillis(outbound.at(-1)!.at)
    update.expiresAt = Timestamp.fromMillis((outbound.at(-1)?.at ?? inbound.at) + MESSAGE_TTL_MS)
    await conversationRef.set(update, { merge: true })
    await logMessages(event.waId, [inbound, ...outbound]).catch((err) =>
      console.error(`[whatsapp-bot] transcript for ${maskPhone(`+${event.waId}`)} not saved:`, err instanceof Error ? err.message : err)
    )
  }
}

/** The member's message as the inbox shows it: their text, the button they tapped, or what kind of attachment it was. */
function inboundEntry(event: InboundEvent, lang: Lang): LoggedMessage {
  const base = { id: event.messageId, direction: 'in', author: 'member', at: event.at } as const
  switch (event.kind) {
    case 'text':
      return { ...base, kind: 'text', text: event.text }
    case 'button':
      return { ...base, kind: 'button', text: buttonTitle(lang, event.action) }
    case 'language':
      return { ...base, kind: 'language', text: LANGUAGE_NAMES[event.lang] }
    case 'other':
      return { ...base, kind: 'media', text: `(${event.media ?? 'attachment'})` }
  }
}

/** Sends one message (or logs it, when not live); a failed send throws. */
async function send({ waId, phoneNumberId }: InboundEvent, message: WhatsAppMessage): Promise<Pick<LoggedMessage, 'id' | 'simulated'>> {
  const to = maskPhone(`+${waId}`)
  if (!whatsappLive(phoneNumberId)) {
    console.info(`[whatsapp-bot] simulated reply to ${to}: ${JSON.stringify(message)}`)
    return { simulated: true }
  }
  const id = await sendWhatsAppMessage(waId, message, phoneNumberId)
  console.info(`[whatsapp-bot] sent ${message.type} reply to ${to} from ${phoneNumberId ?? 'WHATSAPP_PHONE_NUMBER_ID'}`)
  return { id }
}
