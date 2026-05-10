import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const styles = await prisma.style.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, body: true, updatedAt: true },
  })
  return NextResponse.json(styles)
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { name, body: styleBody } = body as { name?: string; body?: string }
  if (!name?.trim()) {
    return NextResponse.json({ error: 'name required' }, { status: 400 })
  }
  if (!styleBody?.trim()) {
    return NextResponse.json({ error: 'body required' }, { status: 400 })
  }
  try {
    const style = await prisma.style.create({
      data: { name: name.trim(), body: styleBody },
      select: { id: true, name: true },
    })
    return NextResponse.json(style)
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 },
    )
  }
}
