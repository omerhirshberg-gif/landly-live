import 'server-only'
import { getAdminAuth } from './admin'

// Shared by user-authenticated API routes (as opposed to the admin-password
// gate in lib/admin/checkAdminPassword.ts). Client callers send
// `Authorization: Bearer ${await user.getIdToken()}`.
export async function getUidFromRequest(request: Request): Promise<string | null> {
  const authHeader = request.headers.get('authorization') ?? ''
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null
  if (!idToken) return null

  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken)
    return decoded.uid
  } catch {
    return null
  }
}
