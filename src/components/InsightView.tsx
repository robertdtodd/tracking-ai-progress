'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export type InsightDetail = {
  id: string
  title: string
  stance: string
  bottomLine: string
  rationale: string
  openQuestions: string
  topicIds: string[]
  updatedAt: string
}

export type SupportingArticle = {
  articleId: string
  title: string
  date: string
  source: string
  url: string | null
  description: string | null
  abstract: string | null
  summary: string | null
  contentType: string
  relevance: string
  excerpt: string | null
}

type Topic = { id: string; name: string }

type SearchHit = {
  articleId: string
  title: string
  date: string
  source: string
  url: string | null
  description: string | null
  abstract: string | null
  summary: string | null
  contentType: string
  similarity: number
}

const STANCES = [
  { value: 'open_question', label: 'Open question' },
  { value: 'working_hypothesis', label: 'Working hypothesis' },
  { value: 'current_claim', label: 'Current claim' },
]

const SECTIONS: Array<{ key: keyof Pick<InsightDetail, 'bottomLine' | 'rationale' | 'openQuestions'>; title: string; placeholder: string }> = [
  { key: 'bottomLine', title: 'Bottom line', placeholder: 'TL;DR of where this stands today.' },
  { key: 'rationale', title: 'Rationale', placeholder: 'Why you think this — the case for the current view.' },
  { key: 'openQuestions', title: 'Open questions', placeholder: 'What you still don\'t know.' },
]

const RELEVANCE_OPTIONS: Array<{ value: 'supports' | 'contradicts' | 'context'; label: string; color: { bg: string; fg: string } }> = [
  { value: 'supports', label: 'Supports', color: { bg: '#e6f5e9', fg: '#1f6e3a' } },
  { value: 'contradicts', label: 'Contradicts', color: { bg: '#fdecea', fg: '#a02e21' } },
  { value: 'context', label: 'Context', color: { bg: 'var(--bg-secondary)', fg: 'var(--text-secondary)' } },
]

export default function InsightView({
  insight,
  supports: initialSupports,
  allTopics,
}: {
  insight: InsightDetail
  supports: SupportingArticle[]
  allTopics: Topic[]
}) {
  const router = useRouter()

  const [draft, setDraft] = useState({
    title: insight.title,
    stance: insight.stance,
    bottomLine: insight.bottomLine,
    rationale: insight.rationale,
    openQuestions: insight.openQuestions,
    topicIds: new Set(insight.topicIds),
  })
  const [savingMeta, setSavingMeta] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const [supports, setSupports] = useState<SupportingArticle[]>(initialSupports)

  const [overrideQuery, setOverrideQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [hits, setHits] = useState<SearchHit[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)
  const [lastQueryUsed, setLastQueryUsed] = useState<string | null>(null)

  const supportedIds = new Set(supports.map((s) => s.articleId))

  function setField<K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  function toggleTopic(id: string) {
    setDraft((d) => {
      const next = new Set(d.topicIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { ...d, topicIds: next }
    })
  }

  async function saveMeta() {
    setSavingMeta(true)
    try {
      const res = await fetch(`/api/insights/${insight.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: draft.title,
          stance: draft.stance,
          bottomLine: draft.bottomLine,
          rationale: draft.rationale,
          openQuestions: draft.openQuestions,
          topicIds: Array.from(draft.topicIds),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || res.statusText)
      }
      setSavedAt(new Date().toISOString())
      router.refresh()
    } catch (err) {
      alert('Save failed: ' + (err as Error).message)
    } finally {
      setSavingMeta(false)
    }
  }

  function buildBodyQuery(): string {
    const parts = [draft.title, draft.bottomLine, draft.rationale, draft.openQuestions]
      .map((s) => s.trim())
      .filter(Boolean)
    return parts.join('\n\n')
  }

  async function runSearch(query: string) {
    if (!query.trim() || searching) return
    setSearching(true)
    setSearchError(null)
    setLastQueryUsed(query)
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          topicIds: draft.topicIds.size > 0 ? Array.from(draft.topicIds) : undefined,
          k: 10,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || res.statusText)
      }
      const data = await res.json()
      setHits(data.hits ?? [])
    } catch (err) {
      setSearchError((err as Error).message)
    } finally {
      setSearching(false)
    }
  }

  async function runHypothesisSearch() {
    const q = buildBodyQuery()
    if (!q) {
      setSearchError('Write at least a title or one body section first.')
      return
    }
    await runSearch(q)
  }

  async function runOverrideSearch() {
    if (!overrideQuery.trim()) return
    await runSearch(overrideQuery.trim())
  }

  async function attach(hit: SearchHit, relevance: 'supports' | 'contradicts' | 'context') {
    try {
      const res = await fetch(`/api/insights/${insight.id}/support`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: hit.articleId, relevance }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || res.statusText)
      }
      const next: SupportingArticle = {
        articleId: hit.articleId,
        title: hit.title,
        date: hit.date,
        source: hit.source,
        url: hit.url,
        description: hit.description,
        abstract: hit.abstract,
        summary: hit.summary,
        contentType: hit.contentType,
        relevance,
        excerpt: null,
      }
      setSupports((s) => [next, ...s.filter((x) => x.articleId !== hit.articleId)])
    } catch (err) {
      alert('Attach failed: ' + (err as Error).message)
    }
  }

  async function detach(articleId: string) {
    try {
      const res = await fetch(`/api/insights/${insight.id}/support/${articleId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || res.statusText)
      }
      setSupports((s) => s.filter((x) => x.articleId !== articleId))
    } catch (err) {
      alert('Detach failed: ' + (err as Error).message)
    }
  }

  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: '32px 24px 80px' }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/insights" style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none' }}>
          ← Insights
        </Link>
      </div>

      <input
        type="text"
        value={draft.title}
        onChange={(e) => setField('title', e.target.value)}
        style={titleInputStyle}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <select
          value={draft.stance}
          onChange={(e) => setField('stance', e.target.value)}
          style={selectStyle}
        >
          {STANCES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>·</span>
        {allTopics.map((t) => {
          const on = draft.topicIds.has(t.id)
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => toggleTopic(t.id)}
              style={{
                fontSize: 12,
                padding: '3px 10px',
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 32 }}>
        {SECTIONS.map((s) => (
          <div key={s.key}>
            <div style={sectionHeaderStyle}>{s.title}</div>
            <textarea
              value={draft[s.key]}
              onChange={(e) => setField(s.key, e.target.value)}
              placeholder={s.placeholder}
              rows={4}
              style={textareaStyle}
            />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
        <button onClick={saveMeta} disabled={savingMeta} style={primaryBtn(savingMeta)}>
          {savingMeta ? 'Saving…' : 'Save changes'}
        </button>
        {savedAt && (
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            Saved {new Date(savedAt).toLocaleTimeString()}
          </span>
        )}
      </div>

      <hr style={{ margin: '40px 0', border: 0, borderTop: '1px solid var(--border-1)' }} />

      <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 12px 0' }}>
        Supporting articles ({supports.length})
      </h2>
      {supports.length === 0 && (
        <div
          style={{
            padding: 16,
            border: '0.5px dashed var(--border-1)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-tertiary)',
            fontSize: 13,
            background: 'var(--bg-tertiary)',
          }}
        >
          No articles attached yet. Use the search below to find evidence.
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {supports.map((s) => {
          const rel = RELEVANCE_OPTIONS.find((r) => r.value === s.relevance) ?? RELEVANCE_OPTIONS[0]
          return (
            <div key={s.articleId} style={supportCardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                <span style={pillStyle(rel.color.bg, rel.color.fg)}>{rel.label}</span>
                <span>{s.date}</span>
                <span>· {s.source}</span>
                <div style={{ flex: 1 }} />
                <button onClick={() => detach(s.articleId)} style={iconBtnStyle} title="Detach">×</button>
              </div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{s.title}</div>
              {(s.summary || s.abstract || s.description) && (
                <div style={{ marginTop: 4, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {(s.summary ?? s.abstract ?? s.description)?.slice(0, 400)}
                  {((s.summary ?? s.abstract ?? s.description) ?? '').length > 400 ? '…' : ''}
                </div>
              )}
              {s.url && (
                <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--text-info)', textDecoration: 'none' }}>
                  Open source ↗
                </a>
              )}
            </div>
          )
        })}
      </div>

      <hr style={{ margin: '40px 0', border: 0, borderTop: '1px solid var(--border-1)' }} />

      <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 12px 0' }}>Find articles</h2>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
        Uses the title + body sections above as the query
        {draft.topicIds.size > 0 ? ', filtered to selected topics' : ''}.
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={runHypothesisSearch}
          disabled={searching}
          style={primaryBtn(searching)}
        >
          {searching ? 'Searching…' : 'Find articles for this hypothesis'}
        </button>
        <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>or</span>
        <input
          type="text"
          value={overrideQuery}
          onChange={(e) => setOverrideQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              runOverrideSearch()
            }
          }}
          placeholder="search a specific phrase…"
          style={{ ...inputStyle, flex: 1, minWidth: 200 }}
        />
        <button
          onClick={runOverrideSearch}
          disabled={searching || !overrideQuery.trim()}
          style={secondaryBtn(searching || !overrideQuery.trim())}
        >
          Search
        </button>
      </div>
      {lastQueryUsed && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>
          Searched: <em>{lastQueryUsed.slice(0, 140)}{lastQueryUsed.length > 140 ? '…' : ''}</em>
        </div>
      )}
      {searchError && (
        <div style={{ marginTop: 8, fontSize: 13, color: '#c0392b' }}>{searchError}</div>
      )}
      {hits.length > 0 && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {hits.map((h) => {
            const already = supportedIds.has(h.articleId)
            return (
              <div key={h.articleId} style={hitCardStyle(already)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>
                  <span>sim {h.similarity.toFixed(3)}</span>
                  <span>· {h.date}</span>
                  <span>· {h.source}</span>
                  <span>· {h.contentType}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, marginTop: 4 }}>{h.title}</div>
                {(h.summary || h.abstract || h.description) && (
                  <div style={{ marginTop: 4, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {(h.summary ?? h.abstract ?? h.description)?.slice(0, 400)}
                    {((h.summary ?? h.abstract ?? h.description) ?? '').length > 400 ? '…' : ''}
                  </div>
                )}
                <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                  {already ? (
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Already attached</span>
                  ) : (
                    RELEVANCE_OPTIONS.map((r) => (
                      <button
                        key={r.value}
                        onClick={() => attach(h, r.value)}
                        style={attachBtnStyle(r.color)}
                      >
                        Attach as {r.label.toLowerCase()}
                      </button>
                    ))
                  )}
                  {h.url && (
                    <>
                      <div style={{ flex: 1 }} />
                      <a href={h.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--text-info)', textDecoration: 'none', alignSelf: 'center' }}>
                        Open ↗
                      </a>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}

const titleInputStyle: React.CSSProperties = {
  width: '100%',
  fontSize: 24,
  fontWeight: 600,
  color: 'var(--text-primary)',
  background: 'transparent',
  border: 'none',
  outline: 'none',
  padding: 0,
  fontFamily: 'inherit',
}

const selectStyle: React.CSSProperties = {
  fontSize: 12,
  padding: '4px 8px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-1)',
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  fontFamily: 'inherit',
}

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 0.5,
  textTransform: 'uppercase',
  color: 'var(--text-tertiary)',
  marginBottom: 6,
}

const textareaStyle: React.CSSProperties = {
  width: '100%',
  padding: 10,
  fontSize: 14,
  lineHeight: 1.55,
  fontFamily: 'inherit',
  border: '1px solid var(--border-1)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  resize: 'vertical',
  boxSizing: 'border-box',
}

const inputStyle: React.CSSProperties = {
  padding: 8,
  fontSize: 14,
  fontFamily: 'inherit',
  border: '1px solid var(--border-1)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  outline: 'none',
}

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    fontSize: 13,
    fontWeight: 500,
    padding: '8px 16px',
    background: '#7f77dd',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  }
}

function secondaryBtn(disabled: boolean): React.CSSProperties {
  return {
    fontSize: 13,
    fontWeight: 500,
    padding: '8px 14px',
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-1)',
    borderRadius: 'var(--radius-md)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  }
}

const supportCardStyle: React.CSSProperties = {
  padding: 12,
  border: '0.5px solid var(--border-1)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--bg-primary)',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}

function hitCardStyle(faded: boolean): React.CSSProperties {
  return {
    padding: 12,
    border: '0.5px solid var(--border-1)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg-tertiary)',
    opacity: faded ? 0.55 : 1,
  }
}

function pillStyle(bg: string, fg: string): React.CSSProperties {
  return {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    padding: '2px 8px',
    borderRadius: 999,
    background: bg,
    color: fg,
  }
}

function attachBtnStyle(color: { bg: string; fg: string }): React.CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 500,
    padding: '4px 10px',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    background: color.bg,
    color: color.fg,
    cursor: 'pointer',
  }
}

const iconBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  fontSize: 16,
  color: 'var(--text-tertiary)',
  cursor: 'pointer',
  padding: 2,
  lineHeight: 1,
}
