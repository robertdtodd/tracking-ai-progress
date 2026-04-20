import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { chatWithBundle, discussWithBundle } from '@/lib/claude'
import { getAllArticles } from '@/lib/getAllArticles'

export const maxDuration = 60

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const { message, mode = 'refine' } = await req.json()
  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message required' }, { status: 400 })
  }
  if (mode !== 'refine' && mode !== 'discuss') {
    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
  }

  const bundle = await prisma.bundle.findUnique({
    where: { id: params.id },
    include: {
      course: true,
      messages: {
        where: { mode },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!bundle) {
    return NextResponse.json({ error: 'Theme not found' }, { status: 404 })
  }

  const history = bundle.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }))

  const allArticles = await getAllArticles()

  if (mode === 'discuss') {
    const assistantMessage = await discussWithBundle(
      bundle.course.name,
      bundle.title,
      bundle.generatedContent,
      bundle.articleTitles,
      allArticles,
      history,
      message,
    )

    await prisma.$transaction([
      prisma.message.create({
        data: { bundleId: params.id, role: 'user', content: message, mode: 'discuss' },
      }),
      prisma.message.create({
        data: { bundleId: params.id, role: 'assistant', content: assistantMessage, mode: 'discuss' },
      }),
    ])

    return NextResponse.json({ assistantMessage })
  }

  const { assistantMessage, updatedContent } = await chatWithBundle(
    bundle.course.name,
    bundle.title,
    bundle.generatedContent,
    bundle.articleTitles,
    allArticles,
    history,
    message,
  )

  await prisma.$transaction([
    prisma.message.create({
      data: { bundleId: params.id, role: 'user', content: message, mode: 'refine' },
    }),
    prisma.message.create({
      data: {
        bundleId: params.id,
        role: 'assistant',
        content: assistantMessage,
        mode: 'refine',
      },
    }),
    prisma.bundle.update({
      where: { id: params.id },
      data: { generatedContent: updatedContent },
    }),
  ])

  return NextResponse.json({ assistantMessage, updatedContent })
}
