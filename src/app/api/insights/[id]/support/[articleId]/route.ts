import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; articleId: string } },
) {
  try {
    await prisma.articleSupport.delete({
      where: {
        insightId_articleId: { insightId: params.id, articleId: params.articleId },
      },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 404 })
  }
}
