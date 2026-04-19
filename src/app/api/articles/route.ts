import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const userArticles = await prisma.userArticle.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json(
    userArticles.map((ua) => ({
      d: ua.date,
      sec: ua.section,
      t: ua.title,
      by: ua.author,
      th: ua.themes,
    })),
  )
}

export async function POST(req: Request) {
  const { title, author, date, section, themes } = await req.json()

  if (!title?.trim() || !date || !section?.trim()) {
    return NextResponse.json(
      { error: 'Title, date, and section are required' },
      { status: 400 },
    )
  }

  const ua = await prisma.userArticle.create({
    data: {
      title: title.trim(),
      author: author?.trim() || null,
      date,
      section: section.trim(),
      themes: themes || {},
    },
  })

  return NextResponse.json({
    d: ua.date,
    sec: ua.section,
    t: ua.title,
    by: ua.author,
    th: ua.themes,
  })
}
