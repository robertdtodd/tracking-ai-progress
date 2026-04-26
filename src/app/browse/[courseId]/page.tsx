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
      sessions: {
        where: { published: true },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          position: true,
          title: true,
          description: true,
          publishedAt: true,
          _count: { select: { beats: true } },
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
        {course.sessions.length > 0 && (
          <section style={{ marginBottom: 32 }}>
            <h2
              style={{
                fontSize: 14,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 0.6,
                color: 'var(--text-secondary)',
                marginBottom: 12,
              }}
            >
              Sessions
            </h2>
            <ol className="browse-toc">
              {course.sessions.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/browse/${course.id}/sessions/${s.id}`}
                    className="browse-toc-row"
                  >
                    <span className="browse-toc-num">{s.position + 1}</span>
                    <span className="browse-toc-body">
                      <span className="browse-toc-title">{s.title}</span>
                      <span className="browse-toc-meta">
                        {s._count.beats} beats
                        {s.description ? ` · ${s.description.slice(0, 80)}${s.description.length > 80 ? '…' : ''}` : ''}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        )}

        {course.bundles.length === 0 && course.sessions.length === 0 ? (
          <div className="browse-empty">No published material yet.</div>
        ) : course.bundles.length > 0 ? (
          <section>
            <h2
              style={{
                fontSize: 14,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 0.6,
                color: 'var(--text-secondary)',
                marginBottom: 12,
              }}
            >
              Topics
            </h2>
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
          </section>
        ) : null}
      </main>
    </div>
  )
}
