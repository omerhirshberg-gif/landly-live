import 'server-only'
import { NextResponse } from 'next/server'
import { applicationOrigin } from '@/lib/auth/requestContext'
import { parseAudienceFilter } from './audience.server'
import { validateNewsletterContent, type ContentCheck } from '@/lib/email/newsletterEmail'

export const NO_STORE = { 'Cache-Control': 'no-store' }

export const jsonError = (error: string, status: number) => NextResponse.json({ error }, { status, headers: NO_STORE })

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json()
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export { parseAudienceFilter, validateNewsletterContent }
export type { ContentCheck }

/** The origin links in the emails point to; a preview falls back to the request's own when APP_URL is unset. */
export function emailOrigin(request: Request): string {
  try {
    return applicationOrigin()
  } catch {
    return new URL(request.url).origin
  }
}
