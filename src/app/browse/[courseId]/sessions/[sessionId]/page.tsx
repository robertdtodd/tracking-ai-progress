import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { SESSION_COOKIE, verifySession } from '@/lib/auth'
import BrowseSession from '@/components/BrowseSession'

export const dynamic = 'force-dynamic'

async function isEditor(): Promise<boolean> {
  const secret = process.env.AUTH_SECRET
  if (!secret) return false
  const val = cookies().get(SESSION_COOKIE)?.value
  return verifySession(secret, val)
}

export default async function BrowseSessionPage({
  params,
}: {
  params: { courseId: string; sessionId: string }
}) {
  const session = await prisma.session.findUnique({
    where: { id: params.sessionId },
    include: {
      course: { select: { id: true, name: true } },
      beats: {
        orderBy: { position: 'asc' },
        select: {
          id: true,
          position: true,
          kind: true,
          slideType: true,
          title: true,
          generated: true,
          bundleId: true,
          bundle: { select: { id: true, title: true, generatedContent: true, published: true } },
          sectionKey: true,
          highlightId: true,
          highlight: {
            select: { id: true, anchorText: true, color: true, note: true },
          },
          expandedBundle: { select: { id: true, title: true, published: true } },
        },
      },
    },
  })

  if (!session || !session.published || session.courseId !== params.courseId) {
    notFound()
  }

  const editor = await isEditor()

  return (
    <div className="browse-view">
      {editor && (
        <div className="browse-topbar">
          <Link href={`/sessions/${session.id}/edit`} className="browse-editor-link">
            ← Editor
          </Link>
        </div>
      )}
      <header className="browse-header">
        <div className="browse-kicker">
          <Link href={`/browse/${session.course.id}`} style={{ color: 'inherit' }}>
            {session.course.name}
          </Link>
          {' · Session'}
        </div>
        <h1>{session.title}</h1>
        {session.description && <p className="browse-description">{session.description}</p>}
      </header>

      <BrowseSession
        courseId={session.course.id}
        beats={JSON.parse(JSON.stringify(session.beats))}
      />
    </div>
  )
}
