import { notFound } from 'next/navigation'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { SESSION_COOKIE, verifySession } from '@/lib/auth'
import StudentBundleView from '@/components/StudentBundleView'

export const dynamic = 'force-dynamic'

async function isEditor(): Promise<boolean> {
  const secret = process.env.AUTH_SECRET
  if (!secret) return false
  const val = cookies().get(SESSION_COOKIE)?.value
  return verifySession(secret, val)
}

export default async function BrowseBundlePage({
  params,
}: {
  params: { courseId: string; bundleId: string }
}) {
  const bundle = await prisma.bundle.findUnique({
    where: { id: params.bundleId },
    include: {
      course: { select: { id: true, name: true, description: true } },
      messages: {
        where: { mode: 'discuss' },
        orderBy: { createdAt: 'asc' },
      },
      highlights: { orderBy: { position: 'asc' } },
    },
  })

  if (!bundle || !bundle.published || bundle.courseId !== params.courseId) {
    notFound()
  }

  const editor = await isEditor()

  const articles = await prisma.userArticle.findMany({
    where: { title: { in: bundle.articleTitles } },
    select: {
      title: true,
      date: true,
      section: true,
      author: true,
      source: true,
      url: true,
    },
    orderBy: { date: 'desc' },
  })
  const seen = new Set<string>()
  const uniqueArticles = articles.filter((a) => {
    if (seen.has(a.title)) return false
    seen.add(a.title)
    return true
  })

  return (
    <div className="browse-view">
      <header className="browse-bundle-header">
        <Link href={`/browse/${params.courseId}`} className="browse-back">
          ← {bundle.course.name}
        </Link>
        <div style={{ flex: 1 }} />
        {bundle.publishedAt && (
          <span className="browse-published-on">
            Published{' '}
            {new Date(bundle.publishedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        )}
        {editor && (
          <Link href="/" className="browse-editor-link">
            Editor ↗
          </Link>
        )}
      </header>

      <StudentBundleView
        title={bundle.title}
        themes={bundle.themes}
        articleCount={bundle.articleTitles.length}
        generatedContent={bundle.generatedContent}
        highlights={bundle.highlights.map((h) => ({
          id: h.id,
          anchorText: h.anchorText,
          color: h.color,
          note: h.note,
          position: h.position,
        }))}
        messages={bundle.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt.toISOString(),
        }))}
        articles={uniqueArticles.map((a) => ({
          title: a.title,
          date: a.date,
          section: a.section,
          author: a.author,
          source: a.source,
          url: a.url,
        }))}
      />
    </div>
  )
}
