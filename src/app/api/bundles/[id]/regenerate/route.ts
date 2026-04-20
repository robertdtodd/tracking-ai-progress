import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateBundleContent } from '@/lib/claude'
import { getAllArticles } from '@/lib/getAllArticles'

export const maxDuration = 120

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const bundle = await prisma.bundle.findUnique({
    where: { id: params.id },
    include: { course: true },
  })
  if (!bundle) {
    return NextResponse.json({ error: 'Theme not found' }, { status: 404 })
  }

  const allArticles = await getAllArticles()

  const generatedContent = await generateBundleContent(
    bundle.course.name,
    bundle.title,
    bundle.articleTitles,
    bundle.themes,
    allArticles,
  )

  await prisma.$transaction([
    prisma.message.deleteMany({ where: { bundleId: params.id } }),
    prisma.bundle.update({
      where: { id: params.id },
      data: { generatedContent },
    }),
  ])

  const updated = await prisma.bundle.findUnique({
    where: { id: params.id },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      highlights: { orderBy: { position: 'asc' } },
    },
  })
  return NextResponse.json(updated)
}
