'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Topic = { id: string; name: string }

const STANCES = [
  { value: 'open_question', label: 'Open question — I don\'t know yet, but I\'m watching' },
  { value: 'working_hypothesis', label: 'Working hypothesis — I think this is probably true' },
  { value: 'current_claim', label: 'Current claim — I think this is true based on current evidence' },
]

export default function NewInsightForm({ topics }: { topics: Topic[] }) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [stance, setStance] = useState<string>('working_hypothesis')
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleTopic(id: string) {
    setSelectedTopics((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          stance,
          topicIds: Array.from(selectedTopics),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || res.statusText)
      }
      const data = await res.json()
      router.push(`/insights/${data.id}`)
    } catch (err) {
      setError((err as Error).message)
      setSubmitting(false)
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px 80px' }}>
      <div style={{ marginBottom: 24 }}>
        <Link href="/insights" style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none' }}>
          ← Insights
        </Link>
        <h1 style={{ margin: '8px 0 0 0', fontSize: 24, fontWeight: 600 }}>New insight</h1>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label style={labelStyle}>Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. AI fluency reshapes what good teaching looks like"
            style={inputStyle}
            autoFocus
          />
        </div>

        <div>
          <label style={labelStyle}>Stance</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {STANCES.map((s) => (
              <label key={s.value} style={radioRowStyle(stance === s.value)}>
                <input
                  type="radio"
                  name="stance"
                  value={s.value}
                  checked={stance === s.value}
                  onChange={() => setStance(s.value)}
                  style={{ marginRight: 10 }}
                />
                <span>{s.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label style={labelStyle}>
            Topics (optional — narrows retrieval to articles tagged with these)
          </label>
          {topics.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
              No topics yet. Insight will retrieve from the whole corpus.
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {topics.map((t) => {
                const on = selectedTopics.has(t.id)
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTopic(t.id)}
                    style={{
                      fontSize: 12,
                      padding: '4px 12px',
                      borderRadius: 999,
                      border: `1px solid ${on ? '#7f77dd' : 'var(--border-1)'}`,
                      background: on ? 'var(--bg-accent)' : 'var(--bg-primary)',
                      color: on ? 'var(--text-accent)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    {t.name}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {error && (
          <div
            style={{
              padding: '8px 12px',
              fontSize: 13,
              color: '#c0392b',
              background: 'rgba(192, 57, 43, 0.08)',
              border: '1px solid rgba(192, 57, 43, 0.2)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="submit"
            disabled={!title.trim() || submitting}
            style={{
              fontSize: 14,
              fontWeight: 500,
              padding: '10px 20px',
              background: '#7f77dd',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: submitting || !title.trim() ? 'not-allowed' : 'pointer',
              opacity: submitting || !title.trim() ? 0.5 : 1,
            }}
          >
            {submitting ? 'Creating…' : 'Create insight'}
          </button>
          <Link
            href="/insights"
            style={{
              fontSize: 14,
              padding: '10px 20px',
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              borderRadius: 'var(--radius-md)',
            }}
          >
            Cancel
          </Link>
        </div>
      </form>
    </main>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--text-secondary)',
  marginBottom: 8,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 10,
  fontSize: 16,
  fontFamily: 'inherit',
  border: '1px solid var(--border-1)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  boxSizing: 'border-box',
}

function radioRowStyle(on: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'flex-start',
    padding: 10,
    border: `1px solid ${on ? '#7f77dd' : 'var(--border-1)'}`,
    borderRadius: 'var(--radius-md)',
    background: on ? 'var(--bg-accent)' : 'var(--bg-primary)',
    fontSize: 13,
    cursor: 'pointer',
  }
}
