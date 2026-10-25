import 'server-only'
import { Timestamp } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase/admin'

// The transcript the support inbox (/admin/support) shows:
// whatsappConversations/{waId}/messages/{id}, one doc per message in either
// direction, written by the bot (lib/whatsapp/supportBotHandler.ts) and the
// admin reply routes (lib/whatsapp/adminInbox.ts). The id is Meta's message
// id when there is one, so a retried delivery is stored once. Each doc
// expires MESSAGE_TTL_MS (180 days) after it was written (a Firestore TTL
// policy on expiresAt deletes it); the conversation doc's own expiresAt
// follows its latest message, so it goes with the last of them.

export const MESSAGE_TTL_MS = 180 * 24 * 60 * 60 * 1000

export type MessageAuthor = 'member' | 'bot' | 'admin'
export type MessageKind = 'text' | 'button' | 'language' | 'interactive' | 'media'

export interface LoggedMessage {
  /** Meta's message id (wamid…); missing for a simulated or failed send. */
  id?: string
  direction: 'in' | 'out'
  author: MessageAuthor
  kind: MessageKind
  text: string
  /** In ms. */
  at: number
  /** Only logged, not sent: outside production without WHATSAPP_OTP_LIVE. */
  simulated?: boolean
  /** Meta refused it or couldn't be reached. */
  error?: string
}

const MAX_TEXT = 4096

/** The conversation's lastSnippet for a message: the inbox list shows it under the name. */
export const snippetOf = (message: LoggedMessage) => ({
  text: message.text.slice(0, 200),
  direction: message.direction,
  at: Timestamp.fromMillis(message.at),
})

/** Writes the messages in one batch. */
export async function logMessages(waId: string, messages: LoggedMessage[]): Promise<void> {
  if (!messages.length) return
  const db = getAdminDb()
  const collection = db.collection('whatsappConversations').doc(waId).collection('messages')
  const batch = db.batch()
  for (const { id, at, text, simulated, error, ...rest } of messages) {
    batch.set(id ? collection.doc(id) : collection.doc(), {
      ...rest,
      text: text.slice(0, MAX_TEXT),
      at: Timestamp.fromMillis(at),
      expiresAt: Timestamp.fromMillis(at + MESSAGE_TTL_MS),
      ...(simulated ? { simulated: true } : {}),
      ...(error ? { error: error.slice(0, 500) } : {}),
    })
  }
  await batch.commit()
}
