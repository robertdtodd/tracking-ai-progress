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
  const { generatedContent } = await req.json()
  if (typeof generatedContent !== 'string') {
    return NextResponse.json({ error: 'generatedContent required' }, { status: 400 })
  }
  const bundle = await prisma.bundle.update({
    where: { id: params.id },
    data: { generatedContent },
  })
  return NextResponse.json(bundle)
}
