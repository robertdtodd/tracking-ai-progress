import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const bundle = await prisma.bundle.findUnique({ where: { id: params.id } })
  if (!bundle) {
    return NextResponse.json({ error: 'Theme not found' }, { status: 404 })
  }
  await prisma.bundle.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const body = await req.json()
  const data: {
    generatedContent?: string
    published?: boolean
    publishedAt?: Date | null
  } = {}

  if (typeof body.generatedContent === 'string') {
    data.generatedContent = body.generatedContent
  }
  if (typeof body.published === 'boolean') {
    data.published = body.published
    data.publishedAt = body.published ? new Date() : null
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 })
  }

  const bundle = await prisma.bundle.update({
    where: { id: params.id },
    data,
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      highlights: { orderBy: { position: 'asc' } },
    },
  })
  return NextResponse.json(bundle)
}
