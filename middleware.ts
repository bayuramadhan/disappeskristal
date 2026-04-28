import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

// ─── Rate limiter (in-memory, resets per Edge worker) ────────────────────────
const RATE_LIMIT = 120
const WINDOW_MS  = 60_000

const ipStore = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string) {
  const now = Date.now()
  let entry = ipStore.get(ip)
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + WINDOW_MS }
    ipStore.set(ip, entry)
  }
  entry.count++
  return { ok: entry.count <= RATE_LIMIT, remaining: Math.max(0, RATE_LIMIT - entry.count), resetAt: entry.resetAt }
}

// ─── Role-based access control ────────────────────────────────────────────────
// ADMIN      → full access
// SUPERVISOR → GET only; no delivery-logs, no production writes
// OPERATOR   → GET (except finance/production), POST orders + delivery-logs only
function checkRoleAccess(pathname: string, method: string, role: string): boolean {
  if (role === 'ADMIN') return true

  if (role === 'SUPERVISOR') {
    if (method !== 'GET') return false
    if (pathname.startsWith('/api/delivery-logs')) return false
    return true
  }

  if (role === 'OPERATOR') {
    if (method === 'GET') {
      if (pathname.startsWith('/api/finance'))     return false
      if (pathname.startsWith('/api/production'))  return false
      return true
    }
    if (method === 'POST') {
      return pathname.startsWith('/api/orders') ||
             pathname.startsWith('/api/delivery-logs') ||
             pathname.startsWith('/api/fleet')
    }
    return false
  }

  // DRIVER, SALES — no API access
  return false
}

const PUBLIC_API = ['/api/auth']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const start = Date.now()

  // ── Page auth guard ────────────────────────────────────────────────────────
  if (!pathname.startsWith('/api/')) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })

    if (pathname === '/login') {
      if (token) return NextResponse.redirect(new URL('/dashboard', req.url))
      return NextResponse.next()
    }

    if (!token) {
      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }

    return NextResponse.next()
  }

  // ── API routes ─────────────────────────────────────────────────────────────
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown'

  // ── Rate limit ─────────────────────────────────────────────────────────────
  const rl = checkRateLimit(ip)
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, message: 'Terlalu banyak permintaan. Coba lagi dalam 1 menit.' },
      { status: 429, headers: { 'Retry-After': Math.ceil((rl.resetAt - Date.now()) / 1000).toString() } },
    )
  }

  // ── Skip auth for public routes ────────────────────────────────────────────
  if (PUBLIC_API.some(p => pathname.startsWith(p))) {
    return withHeaders(NextResponse.next(), rl.remaining, start, req)
  }

  // ── JWT auth check ─────────────────────────────────────────────────────────
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token) {
    return NextResponse.json({ success: false, message: 'Tidak terautentikasi' }, { status: 401 })
  }

  // ── RBAC check ─────────────────────────────────────────────────────────────
  const role = (token.role as string) ?? 'OPERATOR'
  if (!checkRoleAccess(pathname, req.method, role)) {
    return NextResponse.json({ success: false, message: 'Akses ditolak' }, { status: 403 })
  }

  const res = withHeaders(NextResponse.next(), rl.remaining, start, req)
  res.headers.set('x-user-id',   token.sub ?? '')
  res.headers.set('x-user-role', role)
  return res
}

function withHeaders(res: NextResponse, remaining: number, start: number, req: NextRequest) {
  console.log(`[API] ${req.method} ${req.nextUrl.pathname} — ${Date.now() - start}ms`)
  res.headers.set('X-RateLimit-Limit',     RATE_LIMIT.toString())
  res.headers.set('X-RateLimit-Remaining', remaining.toString())
  return res
}

export const config = {
  matcher: [
    '/api/:path*',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}

