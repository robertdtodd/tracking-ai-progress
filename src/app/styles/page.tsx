import Link from 'next/link'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function StylesListPage() {
  const styles = await prisma.style.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { sessions: true } } },
  })

  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: '32px 24px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>Styles</h1>
          <div style={{ marginTop: 4, color: 'var(--text-secondary)', fontSize: 14 }}>
            {styles.length === 0 ? 'No styles.' : `${styles.length} styles`}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link
            href="/styles/new"
            style={{
              fontSize: 13,
              fontWeight: 500,
              padding: '8px 16px',
              background: '#7f77dd',
              color: '#fff',
              borderRadius: 'var(--radius-md)',
              textDecoration: 'none',
            }}
          >
            + New style
          </Link>
          <Link href="/" style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none' }}>
            ← Back
          </Link>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {styles.map((s) => (
          <Link
            key={s.id}
            href={`/styles/${s.id}`}
            style={{
              display: 'block',
              textDecoration: 'none',
              color: 'inherit',
              padding: 16,
              border: '0.5px solid var(--border-1)',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--bg-primary)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{s.name}</div>
              <div style={{ flex: 1 }} />
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                used by {s._count.sessions} session{s._count.sessions === 1 ? '' : 's'}
              </div>
            </div>
            <div
              style={{
                marginTop: 8,
                fontSize: 13,
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {s.body}
            </div>
          </Link>
        ))}
      </div>
    </main>
  )
}
