import { NextResponse } from 'next/server'
import { checkAdminPasswordWithRateLimit } from '@/lib/admin/adminAuth'
import { issueAdminSessionToken } from '@/lib/admin/sessionToken'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const password = typeof body?.password === 'string' ? body.password : null

  const denied = checkAdminPasswordWithRateLimit(request, password)
  if (denied) return denied
  return NextResponse.json({ ok: true, token: issueAdminSessionToken() })
}
