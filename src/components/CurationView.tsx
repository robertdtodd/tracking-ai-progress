'use client'

import { useState } from 'react'
import Link from 'next/link'

export type PendingArticle = {
  id: string
  title: string
  author: string | null
  date: string
  abstract: string | null
  description: string | null
  url: string | null
  source: string
  contentType: string
  topics: string[]
}

type Status = 'pending' | 'accepting' | 'rejecting' | 'accepted' | 'rejected' | 'error'

export default function CurationView({ articles }: { articles: PendingArticle[] }) {
  const [statusById, setStatusById] = useState<Record<string, Status>>({})
  const [errorById, setErrorById] = useState<Record<string, string>>({})

  async function handleAccept(id: string) {
    setStatusById((s) => ({ ...s, [id]: 'accepting' }))
    setErrorById((e) => {
      const { [id]: _drop, ...rest } = e
      return rest
    })
    try {
      const res = await fetch(`/api/articles/${id}/accept`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || res.statusText)
      }
      const data = await res.json()
      setStatusById((s) => ({ ...s, [id]: 'accepted' }))
      if (data.embedStatus === 'error') {
        setErrorById((e) => ({ ...e, [id]: `Accepted but embedding failed: ${data.embedError}` }))
      }
    } catch (err) {
      setStatusById((s) => ({ ...s, [id]: 'error' }))
      setErrorById((e) => ({ ...e, [id]: (err as Error).message }))
    }
  }

  async function handleReject(id: string) {
    setStatusById((s) => ({ ...s, [id]: 'rejecting' }))
    setErrorById((e) => {
      const { [id]: _drop, ...rest } = e
      return rest
    })
    try {
      const res = await fetch(`/api/articles/${id}/reject`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || res.statusText)
      }
      setStatusById((s) => ({ ...s, [id]: 'rejected' }))
    } catch (err) {
      setStatusById((s) => ({ ...s, [id]: 'error' }))
      setErrorById((e) => ({ ...e, [id]: (err as Error).message }))
    }
  }

  const visible = articles.filter((a) => {
    const s = statusById[a.id]
    return s !== 'accepted' && s !== 'rejected'
  })

  const remaining = visible.length
  const total = articles.length
  const reviewed = total - remaining

  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: '32px 24px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>Curation queue</h1>
          <div style={{ marginTop: 4, color: 'var(--text-secondary)', fontSize: 14 }}>
            {total === 0
              ? 'No pending articles.'
              : `${remaining} pending · ${reviewed} reviewed this session`}
          </div>
        </div>
        <Link href="/" style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none' }}>
          ← Back
        </Link>
      </div>

      {total === 0 && (
        <div style={emptyStyle}>
          Nothing waiting for review. Run <code>npm run ingest</code> to pull new candidates.
        </div>
      )}

      {visible.length === 0 && total > 0 && (
        <div style={emptyStyle}>You&rsquo;re caught up. Refresh to see any new arrivals.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {visible.map((a) => {
          const status = statusById[a.id] ?? 'pending'
          const busy = status === 'accepting' || status === 'rejecting'
          const error = errorById[a.id]
          return (
            <article key={a.id} style={cardStyle}>
              <div style={metaRowStyle}>
                <span style={pillStyle(a.contentType)}>{a.contentType}</span>
                <span style={metaTextStyle}>{a.date}</span>
                {a.author && <span style={metaTextStyle}>· {a.author}</span>}
                <span style={metaTextStyle}>· {a.source}</span>
              </div>
              <h2 style={titleStyle}>{a.title}</h2>
              {a.topics.length > 0 && (
                <div style={topicsRowStyle}>
                  {a.topics.map((t) => (
                    <span key={t} style={topicTagStyle}>{t}</span>
                  ))}
                </div>
              )}
              {(a.abstract || a.description) && (
                <p style={abstractStyle}>{a.abstract ?? a.description}</p>
              )}
              <div style={actionsRowStyle}>
                {a.url && (
                  <a href={a.url} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                    Open source ↗
                  </a>
                )}
                <div style={{ flex: 1 }} />
                <button
                  onClick={() => handleReject(a.id)}
                  disabled={busy}
                  style={rejectBtnStyle(busy)}
                >
                  {status === 'rejecting' ? 'Rejecting…' : 'Reject'}
                </button>
                <button
                  onClick={() => handleAccept(a.id)}
                  disabled={busy}
                  style={acceptBtnStyle(busy)}
                >
                  {status === 'accepting' ? 'Accepting…' : 'Accept'}
                </button>
              </div>
              {error && <div style={errorStyle}>{error}</div>}
            </article>
          )
        })}
      </div>
    </main>
  )
}

const cardStyle: React.CSSProperties = {
  border: '0.5px solid var(--border-1)',
  borderRadius: 'var(--radius-lg)',
  background: 'var(--bg-primary)',
  padding: 20,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
}

const metaRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 12,
  color: 'var(--text-tertiary)',
  flexWrap: 'wrap',
}

const metaTextStyle: React.CSSProperties = {
  color: 'var(--text-tertiary)',
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 17,
  fontWeight: 600,
  lineHeight: 1.35,
  color: 'var(--text-primary)',
}

const topicsRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  flexWrap: 'wrap',
}

const topicTagStyle: React.CSSProperties = {
  fontSize: 11,
  padding: '2px 8px',
  borderRadius: 999,
  background: 'var(--bg-accent)',
  color: 'var(--text-accent)',
}

const abstractStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.55,
  color: 'var(--text-secondary)',
}

const actionsRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  marginTop: 4,
}

const linkStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--text-info)',
  textDecoration: 'none',
}

function pillStyle(contentType: string): React.CSSProperties {
  const isPaper = contentType === 'paper'
  return {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    padding: '2px 8px',
    borderRadius: 999,
    background: isPaper ? 'var(--bg-info)' : 'var(--bg-secondary)',
    color: isPaper ? 'var(--text-info)' : 'var(--text-secondary)',
  }
}

function acceptBtnStyle(busy: boolean): React.CSSProperties {
  return {
    fontSize: 13,
    fontWeight: 500,
    padding: '6px 14px',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    background: '#7f77dd',
    color: '#fff',
    cursor: busy ? 'not-allowed' : 'pointer',
    opacity: busy ? 0.6 : 1,
  }
}

function rejectBtnStyle(busy: boolean): React.CSSProperties {
  return {
    fontSize: 13,
    fontWeight: 500,
    padding: '6px 14px',
    border: '1px solid var(--border-2)',
    borderRadius: 'var(--radius-md)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    cursor: busy ? 'not-allowed' : 'pointer',
    opacity: busy ? 0.6 : 1,
  }
}

const emptyStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: '48px 24px',
  color: 'var(--text-tertiary)',
  fontSize: 14,
  border: '0.5px dashed var(--border-1)',
  borderRadius: 'var(--radius-lg)',
  background: 'var(--bg-tertiary)',
}

const errorStyle: React.CSSProperties = {
  marginTop: 8,
  padding: '8px 12px',
  fontSize: 12,
  color: '#c0392b',
  background: 'rgba(192, 57, 43, 0.08)',
  border: '1px solid rgba(192, 57, 43, 0.2)',
  borderRadius: 'var(--radius-md)',
}
