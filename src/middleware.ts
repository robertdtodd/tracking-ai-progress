import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, verifySession } from '@/lib/auth'

const PUBLIC_PATH_PREFIXES = [
  '/login',
  '/browse',
  '/api/auth',
  '/api/public',
  '/_next',
  '/favicon',
]

function isPublic(pathname: string): boolean {
  if (pathname === '/robots.txt' || pathname === '/sitemap.xml') return true
  for (const prefix of PUBLIC_PATH_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return true
  }
  return false
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (isPublic(pathname)) return NextResponse.next()

  const secret = process.env.AUTH_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: 'AUTH_SECRET not configured' },
      { status: 500 },
    )
  }

  const cookie = req.cookies.get(SESSION_COOKIE)?.value
  const ok = await verifySession(secret, cookie)
  if (ok) return NextResponse.next()

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = req.nextUrl.clone()
  url.pathname = '/login'
  url.searchParams.set('next', pathname)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
