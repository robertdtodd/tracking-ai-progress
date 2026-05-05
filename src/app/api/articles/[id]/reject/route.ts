import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const article = await prisma.article.findUnique({
    where: { id: params.id },
    select: { id: true },
  })
  if (!article) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 })
  }

  await prisma.article.update({
    where: { id: params.id },
    data: { status: 'rejected', reviewedAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
