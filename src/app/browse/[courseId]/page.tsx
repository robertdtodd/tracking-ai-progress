import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { SESSION_COOKIE, verifySession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

async function isEditor(): Promise<boolean> {
  const secret = process.env.AUTH_SECRET
  if (!secret) return false
  const val = cookies().get(SESSION_COOKIE)?.value
  return verifySession(secret, val)
}

export default async function BrowseCoursePage({
  params,
}: {
  params: { courseId: string }
}) {
  const course = await prisma.course.findUnique({
    where: { id: params.courseId },
    include: {
      bundles: {
        where: { published: true },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          position: true,
          title: true,
          articleTitles: true,
          themes: true,
          publishedAt: true,
        },
      },
    },
  })

  if (!course) notFound()

  const editor = await isEditor()

  return (
    <div className="browse-view">
      {editor && (
        <div className="browse-topbar">
          <Link href="/" className="browse-editor-link">
            ← Editor
          </Link>
        </div>
      )}
      <header className="browse-header">
        <div className="browse-kicker">Course</div>
        <h1>{course.name}</h1>
        {course.description && <p className="browse-description">{course.description}</p>}
      </header>

      <main className="browse-body">
        {course.bundles.length === 0 ? (
          <div className="browse-empty">No published themes yet.</div>
        ) : (
          <ol className="browse-toc">
            {course.bundles.map((b) => (
              <li key={b.id}>
                <Link href={`/browse/${course.id}/${b.id}`} className="browse-toc-row">
                  <span className="browse-toc-num">{b.position + 1}</span>
                  <span className="browse-toc-body">
                    <span className="browse-toc-title">{b.title}</span>
                    <span className="browse-toc-meta">
                      {b.articleTitles.length} articles
                      {b.themes.length > 0 ? ` · ${b.themes.join(', ')}` : ''}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </main>
    </div>
  )
}
