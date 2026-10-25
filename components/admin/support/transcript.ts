import type { InboxMessage } from '@/lib/whatsapp/adminInbox'
import { sameDay } from './time'

// How the support inbox lays out a chat (ChatTranscript.tsx): what the member
// wrote and what the team answered stay full bubbles; each run of bot menus,
// links and the member's taps on them folds into one "automation" row, so a
// long self-service exchange takes one line until it's opened.

/** A message in the open chat; `pending` while the team's reply is still on its way. */
export type TranscriptMessage = InboxMessage & { pending?: true }

export type TranscriptItem =
  | { type: 'message'; message: TranscriptMessage }
  | {
      type: 'automation'
      /** The first step's id: stable while the run grows. */
      id: string
      steps: TranscriptMessage[]
      /** How many of the bot's sends Meta refused. */
      failed: number
      /** The member's last tap in the run (a button, row or language), if any. */
      lastChoice: string | null
      /** The last step's time. */
      at: string
    }

/** A bot send, or the member tapping one of its buttons or picking a row. */
export const isAutomation = (message: InboxMessage) =>
  message.author === 'bot' || (message.direction === 'in' && (message.kind === 'button' || message.kind === 'language'))

/** Runs of automation fold into one item; a run never spans two days, so the day separators stay right. */
export function groupTranscript(messages: readonly TranscriptMessage[]): TranscriptItem[] {
  const items: TranscriptItem[] = []
  for (const message of messages) {
    if (!isAutomation(message)) {
      items.push({ type: 'message', message })
      continue
    }
    const last = items.at(-1)
    const run = last?.type === 'automation' && sameDay(last.at, message.at) ? last : null
    const choice = message.direction === 'in' ? message.text : null
    if (run) {
      run.steps.push(message)
      if (message.error) run.failed++
      if (choice) run.lastChoice = choice
      run.at = message.at
    } else {
      items.push({ type: 'automation', id: message.id, steps: [message], failed: message.error ? 1 : 0, lastChoice: choice, at: message.at })
    }
  }
  return items
}

/** The day an item belongs to, for the separators. */
export const itemAt = (item: TranscriptItem) => (item.type === 'message' ? item.message.at : item.steps[0].at)

/**
 * A logged interactive message ("Body\n[Button] [Button]", or "Body\n[Label] https://…"
 * for a link card; lib/whatsapp/supportBot.ts transcriptText) split back into
 * its body, its choices and its link. Plain text comes back as the body.
 */
export function parseInteractive(text: string): { body: string; choices: string[]; link: string | null } {
  const newline = text.lastIndexOf('\n')
  const tail = text.slice(newline + 1)
  if (!/^\[[^\]]+\]/.test(tail)) return { body: text, choices: [], link: null }
  const choices = [...tail.matchAll(/\[([^\]]+)\]/g)].map((match) => match[1])
  const link = tail.match(/\]\s+(https?:\/\/\S+)\s*$/)?.[1] ?? null
  return { body: newline === -1 ? '' : text.slice(0, newline), choices, link }
}
