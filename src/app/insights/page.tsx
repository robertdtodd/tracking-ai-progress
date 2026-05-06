import Link from 'next/link'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

const STANCE_LABEL: Record<string, string> = {
  open_question: 'Open question',
  working_hypothesis: 'Working hypothesis',
  current_claim: 'Current claim',
}

const STANCE_COLOR: Record<string, { bg: string; fg: string }> = {
  open_question: { bg: 'var(--bg-secondary)', fg: 'var(--text-secondary)' },
  working_hypothesis: { bg: 'var(--bg-info)', fg: 'var(--text-info)' },
  current_claim: { bg: 'var(--bg-accent)', fg: 'var(--text-accent)' },
}

export default async function InsightsListPage() {
  const insights = await prisma.insight.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      topics: { include: { topic: { select: { name: true } } } },
      _count: { select: { supports: true } },
    },
  })

  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: '32px 24px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>Insights</h1>
          <div style={{ marginTop: 4, color: 'var(--text-secondary)', fontSize: 14 }}>
            {insights.length === 0
              ? 'No insights yet.'
              : `${insights.length} insight${insights.length === 1 ? '' : 's'}`}
          </div>
        </div>
        <Link
          href="/insights/new"
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
          + New insight
        </Link>
      </div>

      {insights.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '48px 24px',
            color: 'var(--text-tertiary)',
            fontSize: 14,
            border: '0.5px dashed var(--border-1)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-tertiary)',
          }}
        >
          Insights are the wiki pages where you track open questions, working hypotheses, and
          current claims as evidence accumulates. Create your first one to start.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {insights.map((i) => {
          const stance = STANCE_COLOR[i.stance] ?? STANCE_COLOR.working_hypothesis
          return (
            <Link
              key={i.id}
              href={`/insights/${i.id}`}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: stance.bg,
                    color: stance.fg,
                  }}
                >
                  {STANCE_LABEL[i.stance] ?? i.stance}
                </span>
                {i.topics.map((t) => (
                  <span
                    key={t.topicId}
                    style={{
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {t.topic.name}
                  </span>
                ))}
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                  {i._count.supports} supporting · updated {i.updatedAt.toISOString().slice(0, 10)}
                </span>
              </div>
              <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>{i.title}</div>
              {i.bottomLine && (
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 14,
                    lineHeight: 1.5,
                    color: 'var(--text-secondary)',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {i.bottomLine}
                </div>
              )}
            </Link>
          )
        })}
      </div>
    </main>
  )
}
