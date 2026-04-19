import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateBundleContent } from '@/lib/claude'
import { getAllArticles } from '@/lib/getAllArticles'

export const maxDuration = 60

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const { articleTitles, themes, bundleTitle } = await req.json()

  if (!Array.isArray(articleTitles) || articleTitles.length === 0) {
    return NextResponse.json(
      { error: 'At least one article required' },
      { status: 400 },
    )
  }

  const course = await prisma.course.findUnique({ where: { id: params.id } })
  if (!course) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }

  const last = await prisma.bundle.findFirst({
    where: { courseId: params.id },
    orderBy: { position: 'desc' },
  })
  const position = (last?.position ?? -1) + 1

  const finalTitle =
    (bundleTitle && bundleTitle.trim()) ||
    (themes?.length ? themes.slice(0, 2).join(' + ') : `Theme ${position + 1}`)

  const allArticles = await getAllArticles()

  const generatedContent = await generateBundleContent(
    course.name,
    finalTitle,
    articleTitles,
    themes ?? [],
    allArticles,
  )

  const bundle = await prisma.bundle.create({
    data: {
      courseId: params.id,
      position,
      title: finalTitle,
      articleTitles,
      themes: themes ?? [],
      generatedContent,
    },
    include: { messages: true },
  })

  return NextResponse.json(bundle)
}
