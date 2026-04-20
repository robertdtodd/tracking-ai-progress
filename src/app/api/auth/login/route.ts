import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession } from '@/lib/auth'

export async function POST(req: Request) {
  const { password } = await req.json().catch(() => ({ password: '' }))
  const expected = process.env.EDITOR_PASSWORD
  const secret = process.env.AUTH_SECRET

  if (!expected || !secret) {
    return NextResponse.json(
      { error: 'Auth not configured (set EDITOR_PASSWORD and AUTH_SECRET in .env)' },
      { status: 500 },
    )
  }
  if (typeof password !== 'string' || password !== expected) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
  }

  const token = await signSession(secret)
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  })

  return NextResponse.json({ ok: true })
}
