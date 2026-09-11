import { NextResponse } from 'next/server'
import { isAdminPassword } from '@/lib/admin/checkAdminPassword'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const password = typeof body?.password === 'string' ? body.password : null

  if (!isAdminPassword(password)) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  return NextResponse.json({ ok: true })
}
