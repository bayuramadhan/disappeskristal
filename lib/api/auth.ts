import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiUnauthorized, apiError } from './response'

export type SessionUser = {
  id: string
  name?: string | null
  email?: string | null
  role: string
}

/** Returns the session user or a 401 response. Call at the top of each handler. */
export async function requireAuth(): Promise<
  { user: SessionUser; error: null } | { user: null; error: ReturnType<typeof apiUnauthorized> }
> {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return { user: null, error: apiUnauthorized() }
  }

  return {
    user: {
      id:    (session.user as any).id,
      name:  session.user.name,
      email: session.user.email,
      role:  (session.user as any).role ?? 'OPERATOR',
    },
    error: null,
  }
}

/** Additional role guard — use after requireAuth(). */
export function requireRole(user: SessionUser, allowed: string[]) {
  if (!allowed.includes(user.role)) {
    return apiError('Akses ditolak: role tidak diizinkan', 403)
  }
  return null
}
