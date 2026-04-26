import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const { beatIds } = await req.json()
  if (!Array.isArray(beatIds) || beatIds.some((x) => typeof x !== 'string')) {
    return NextResponse.json({ error: 'beatIds must be string[]' }, { status: 400 })
  }

  const existing = await prisma.beat.findMany({
    where: { sessionId: params.id },
    select: { id: true },
  })
  const existingIds = new Set(existing.map((b) => b.id))
  if (beatIds.length !== existing.length || !beatIds.every((id) => existingIds.has(id))) {
    return NextResponse.json({ error: 'beatIds must match session beats exactly' }, { status: 400 })
  }

  await prisma.$transaction(
    beatIds.map((id, i) =>
      prisma.beat.update({ where: { id }, data: { position: i } }),
    ),
  )
  return NextResponse.json({ ok: true })
}
