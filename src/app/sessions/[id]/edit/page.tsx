'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import ChartRenderer, { ChartData } from '@/components/ChartRenderer'

type BeatKind = 'slide' | 'bundle_section' | 'highlight_quote' | 'section_header'
type SlideType = 'text' | 'diagram' | 'chart'

type BundleRef = {
  id: string
  title: string
  generatedContent: string
}
type HighlightRef = {
  id: string
  anchorText: string
  color: string
  note: string | null
  bundleId: string
}
type Beat = {
  id: string
  position: number
  kind: BeatKind
  slideType: SlideType | null
  title: string | null
  outline: string | null
  generated:
    | {
        html?: string
        body?: string
        chartType?: 'bar' | 'line'
        title?: string
        xLabel?: string
        yLabel?: string
        data?: Array<{ label: string; value: number }>
        dataNote?: string | null
      }
    | null
  generatedAt: string | null
  bundleId: string | null
  sectionKey: string | null
  highlightId: string | null
  speakerNotes: string | null
  bundle: BundleRef | null
  highlight: HighlightRef | null
  expandedBundleId: string | null
  expandedBundle: { id: string; title: string } | null
}
type SessionData = {
  id: string
  courseId: string
  title: string
  description: string | null
  published: boolean
  course: {
    id: string
    name: string
    bundles: Array<{
      id: string
      title: string
      generatedContent: string
      highlights: Array<{
        id: string
        anchorText: string
        color: string
        note: string | null
      }>
    }>
  }
  beats: Beat[]
}

function splitByH2(content: string): { heading: string; body: string }[] {
  const lines = content.split('\n')
  const sections: { heading: string; body: string }[] = []
  let current: { heading: string; body: string } | null = null
  for (const line of lines) {
    const m = line.match(/^##\s+(.+?)\s*$/)
    if (m) {
      if (current) sections.push(current)
      current = { heading: m[1], body: '' }
    } else if (current) {
      current.body += (current.body ? '\n' : '') + line
    }
  }
  if (current) sections.push(current)
  return sections
}

export default function SessionEditor({ params }: { params: { id: string } }) {
  const [session, setSession] = useState<SessionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingMeta, setSavingMeta] = useState(false)

  const fetchSession = useCallback(async () => {
    const res = await fetch(`/api/sessions/${params.id}`)
    if (!res.ok) {
      setError('Failed to load session')
      setLoading(false)
      return
    }
    const data = await res.json()
    setSession(data)
    setLoading(false)
  }, [params.id])

  useEffect(() => {
    fetchSession()
  }, [fetchSession])

  async function saveMeta(patch: Partial<Pick<SessionData, 'title' | 'description'>>) {
    setSavingMeta(true)
    await fetch(`/api/sessions/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    setSavingMeta(false)
    fetchSession()
  }

  async function addBeat(body: Record<string, unknown>) {
    const res = await fetch(`/api/sessions/${params.id}/beats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const b = await res.json().catch(() => ({}))
      alert(b.error ?? 'Failed to add beat')
      return
    }
    fetchSession()
  }

  async function updateBeat(beatId: string, patch: Record<string, unknown>) {
    await fetch(`/api/sessions/${params.id}/beats/${beatId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    fetchSession()
  }

  async function deleteBeat(beatId: string) {
    if (!confirm('Delete this beat?')) return
    await fetch(`/api/sessions/${params.id}/beats/${beatId}`, { method: 'DELETE' })
    fetchSession()
  }

  async function moveBeat(beatId: string, direction: -1 | 1) {
    if (!session) return
    const idx = session.beats.findIndex((b) => b.id === beatId)
    const newIdx = idx + direction
    if (idx < 0 || newIdx < 0 || newIdx >= session.beats.length) return
    const reordered = [...session.beats]
    const [moved] = reordered.splice(idx, 1)
    reordered.splice(newIdx, 0, moved)
    const beatIds = reordered.map((b) => b.id)
    // Optimistic
    setSession({ ...session, beats: reordered.map((b, i) => ({ ...b, position: i })) })
    await fetch(`/api/sessions/${params.id}/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ beatIds }),
    })
    fetchSession()
  }

  async function generateBeat(beatId: string) {
    const res = await fetch(`/api/sessions/${params.id}/beats/${beatId}/generate`, {
      method: 'POST',
    })
    if (!res.ok) {
      const b = await res.json().catch(() => ({}))
      alert(b.error ?? 'Generation failed')
      return
    }
    fetchSession()
  }

  async function expandOutline(beatId: string): Promise<string | null> {
    const res = await fetch(`/api/sessions/${params.id}/beats/${beatId}/expand-outline`, {
      method: 'POST',
    })
    if (!res.ok) {
      const b = await res.json().catch(() => ({}))
      alert(b.error ?? 'Expansion failed')
      return null
    }
    const data = await res.json()
    return typeof data.outline === 'string' ? data.outline : null
  }

  async function expandBeat(beatId: string): Promise<{ id: string; title: string } | null> {
    const res = await fetch(`/api/sessions/${params.id}/beats/${beatId}/expand`, {
      method: 'POST',
    })
    if (!res.ok) {
      const b = await res.json().catch(() => ({}))
      alert(b.error ?? 'Expansion failed')
      return null
    }
    const result = await res.json()
    fetchSession()
    return result
  }

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>
  if (error || !session) return <div style={{ padding: 24, color: '#c0392b' }}>{error || 'Not found'}</div>

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link href="/" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          ← Back to editor
        </Link>
        <div style={{ flex: 1 }} />
        <button
          onClick={async () => {
            await fetch(`/api/sessions/${params.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ published: !session.published }),
            })
            fetchSession()
          }}
          style={{
            fontSize: 12,
            background: session.published ? 'var(--bg-info)' : undefined,
            color: session.published ? 'var(--text-info)' : undefined,
          }}
          title={
            session.published
              ? 'Unpublish — students will no longer see this session in /browse'
              : 'Publish — students will see this session in /browse'
          }
        >
          {session.published ? '● Published' : '○ Publish'}
        </button>
        {session.published && (
          <Link
            href={`/browse/${session.course.id}/sessions/${session.id}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              textDecoration: 'none',
            }}
          >
            View in browse ↗
          </Link>
        )}
        <Link
          href={`/present/${session.id}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 12,
            padding: '6px 12px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-accent)',
            color: 'var(--text-accent)',
            textDecoration: 'none',
          }}
        >
          Present ↗
        </Link>
      </div>

      <SessionMeta session={session} onSave={saveMeta} saving={savingMeta} />

      <h2 style={{ fontSize: 16, marginTop: 32, marginBottom: 12 }}>
        Beats ({session.beats.length})
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {session.beats.map((beat, i) => (
          <BeatCard
            key={beat.id}
            beat={beat}
            index={i}
            total={session.beats.length}
            bundles={session.course.bundles}
            courseId={session.course.id}
            onUpdate={(patch) => updateBeat(beat.id, patch)}
            onDelete={() => deleteBeat(beat.id)}
            onMove={(dir) => moveBeat(beat.id, dir)}
            onGenerate={() => generateBeat(beat.id)}
            onExpandOutline={() => expandOutline(beat.id)}
            onExpand={() => expandBeat(beat.id)}
          />
        ))}
      </div>

      <AddBeat bundles={session.course.bundles} onAdd={addBeat} />
    </div>
  )
}

function SessionMeta({
  session,
  onSave,
  saving,
}: {
  session: SessionData
  onSave: (patch: Partial<Pick<SessionData, 'title' | 'description'>>) => void
  saving: boolean
}) {
  const [title, setTitle] = useState(session.title)
  const [description, setDescription] = useState(session.description ?? '')

  useEffect(() => {
    setTitle(session.title)
    setDescription(session.description ?? '')
  }, [session.id, session.title, session.description])

  const dirty = title !== session.title || description !== (session.description ?? '')

  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
        Session · {session.course.name}
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{
          fontSize: 22,
          fontWeight: 600,
          width: '100%',
          padding: '6px 8px',
          border: '0.5px solid transparent',
          borderRadius: 'var(--radius-md)',
          background: 'transparent',
          color: 'var(--text-primary)',
        }}
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Optional description (what's this session about?)"
        rows={2}
        style={{
          width: '100%',
          marginTop: 4,
          padding: 8,
          fontSize: 13,
          border: '0.5px solid var(--border-1)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-secondary)',
          color: 'var(--text-primary)',
          font: 'inherit',
          resize: 'vertical',
        }}
      />
      {dirty && (
        <button
          onClick={() => onSave({ title, description: description || null })}
          disabled={saving}
          style={{ marginTop: 8 }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      )}
    </div>
  )
}

function BeatCard({
  beat,
  index,
  total,
  bundles,
  courseId,
  onUpdate,
  onDelete,
  onMove,
  onGenerate,
  onExpandOutline,
  onExpand,
}: {
  beat: Beat
  index: number
  total: number
  bundles: SessionData['course']['bundles']
  courseId: string
  onUpdate: (patch: Record<string, unknown>) => void
  onDelete: () => void
  onMove: (dir: -1 | 1) => void
  onGenerate: () => void
  onExpandOutline: () => Promise<string | null>
  onExpand: () => Promise<{ id: string; title: string } | null>
}) {
  const [generating, setGenerating] = useState(false)

  async function runGenerate() {
    setGenerating(true)
    await onGenerate()
    setGenerating(false)
  }

  return (
    <div
      style={{
        border: '0.5px solid var(--border-1)',
        borderRadius: 'var(--radius-lg)',
        padding: 16,
        background: 'var(--bg-primary)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 8,
          fontSize: 11,
          color: 'var(--text-secondary)',
        }}
      >
        <span style={{ fontWeight: 600 }}>#{index + 1}</span>
        <span>·</span>
        <span>{beatKindLabel(beat)}</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => onMove(-1)} disabled={index === 0} title="Move up">
          ↑
        </button>
        <button onClick={() => onMove(1)} disabled={index === total - 1} title="Move down">
          ↓
        </button>
        <button onClick={onDelete} title="Delete">
          ✕
        </button>
      </div>

      {beat.kind === 'slide' && (
        <SlideBeatEditor
          beat={beat}
          bundles={bundles}
          courseId={courseId}
          onUpdate={onUpdate}
          onGenerate={runGenerate}
          onExpandOutline={onExpandOutline}
          onExpand={onExpand}
          generating={generating}
        />
      )}
      {beat.kind === 'bundle_section' && (
        <BundleSectionEditor beat={beat} bundles={bundles} onUpdate={onUpdate} />
      )}
      {beat.kind === 'highlight_quote' && <HighlightQuoteEditor beat={beat} />}
      {beat.kind === 'section_header' && (
        <SectionHeaderEditor beat={beat} onUpdate={onUpdate} />
      )}

      {beat.kind !== 'section_header' && (
        <SpeakerNotesEditor beat={beat} onUpdate={onUpdate} />
      )}
    </div>
  )
}

function beatKindLabel(beat: Beat): string {
  if (beat.kind === 'slide') return `${beat.slideType} slide`
  if (beat.kind === 'bundle_section') return 'Bundle section'
  if (beat.kind === 'highlight_quote') return 'Highlight quote'
  if (beat.kind === 'section_header') return 'Section header'
  return beat.kind
}

function SlideBeatEditor({
  beat,
  bundles,
  courseId,
  onUpdate,
  onGenerate,
  onExpandOutline,
  onExpand,
  generating,
}: {
  beat: Beat
  bundles: SessionData['course']['bundles']
  courseId: string
  onUpdate: (patch: Record<string, unknown>) => void
  onGenerate: () => void
  onExpandOutline: () => Promise<string | null>
  onExpand: () => Promise<{ id: string; title: string } | null>
  generating: boolean
}) {
  const [title, setTitle] = useState(beat.title ?? '')
  const [outline, setOutline] = useState(beat.outline ?? '')
  const [expanding, setExpanding] = useState(false)
  const [outlineExpanding, setOutlineExpanding] = useState(false)
  useEffect(() => {
    setTitle(beat.title ?? '')
    setOutline(beat.outline ?? '')
  }, [beat.id, beat.title, beat.outline])

  const dirty = title !== (beat.title ?? '') || outline !== (beat.outline ?? '')

  async function runExpand() {
    setExpanding(true)
    await onExpand()
    setExpanding(false)
  }

  async function runExpandOutline() {
    if (!outline.trim()) return
    setOutlineExpanding(true)
    const expanded = await onExpandOutline()
    setOutlineExpanding(false)
    if (expanded) setOutline(expanded)
  }

  function changeType(newType: SlideType) {
    if (newType === beat.slideType) return
    if (beat.generated && !confirm('Switching slide type will clear the generated content. Continue?')) return
    onUpdate({ slideType: newType })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {(['text', 'diagram', 'chart'] as SlideType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => changeType(t)}
            style={{
              fontSize: 11,
              padding: '3px 10px',
              background: beat.slideType === t ? 'var(--bg-accent)' : 'var(--bg-primary)',
              color: beat.slideType === t ? 'var(--text-accent)' : 'var(--text-secondary)',
              borderColor: beat.slideType === t ? 'var(--border-accent)' : 'var(--border-1)',
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={
          beat.slideType === 'diagram'
            ? 'Internal label (not shown on the slide)'
            : 'Slide title (optional — LLM will suggest one)'
        }
        style={textInputStyle}
      />
      <textarea
        value={outline}
        onChange={(e) => setOutline(e.target.value)}
        placeholder={
          beat.slideType === 'diagram'
            ? 'Describe the visual. e.g. "animated diagram of a neural net"'
            : beat.slideType === 'chart'
              ? 'Describe the chart. e.g. "AI spend as % of IT budgets, 2020–2026, bar chart"'
              : 'What should this slide say? A short prompt for the LLM.'
        }
        rows={3}
        style={textareaStyle}
      />
      {(beat.slideType === 'text' || beat.slideType === 'chart') && (
        <select
          value={beat.bundleId ?? ''}
          onChange={(e) => onUpdate({ bundleId: e.target.value || null })}
          style={textInputStyle}
        >
          <option value="">No grounding bundle</option>
          {bundles.map((b) => (
            <option key={b.id} value={b.id}>
              Ground in: {b.title}
            </option>
          ))}
        </select>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {dirty && (
          <button onClick={() => onUpdate({ title: title || null, outline: outline || null })}>
            Save
          </button>
        )}
        <button
          onClick={runExpandOutline}
          disabled={outlineExpanding || generating || !outline.trim()}
          style={{ fontSize: 12 }}
          title="Have Claude research the topic on the web and rewrite this outline with current facts. You can review and edit before generating the slide."
        >
          {outlineExpanding ? 'Researching…' : 'Expand with search ↻'}
        </button>
        <button
          onClick={onGenerate}
          disabled={generating || !outline.trim() || dirty}
          style={{ background: 'var(--bg-accent)', color: 'var(--text-accent)' }}
          title={dirty ? 'Save first' : undefined}
        >
          {generating ? 'Generating…' : beat.generated ? 'Regenerate' : 'Generate'}
        </button>
        {beat.generatedAt && !generating && (
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            Generated {new Date(beat.generatedAt).toLocaleString()}
          </span>
        )}
        {beat.slideType === 'text' && (
          <button
            onClick={runExpand}
            disabled={expanding || !outline.trim() || dirty}
            title={dirty ? 'Save first' : 'Generate a long-form bundle from this slide outline'}
            style={{ fontSize: 12 }}
          >
            {expanding ? 'Expanding…' : 'Expand into bundle'}
          </button>
        )}
      </div>

      {beat.expandedBundle && (
        <a
          href={`/browse/${courseId}/${beat.expandedBundle.id}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 12,
            padding: '6px 10px',
            background: 'var(--bg-info)',
            color: 'var(--text-info)',
            borderRadius: 'var(--radius-md)',
            border: '0.5px solid var(--border-info)',
            textDecoration: 'none',
            display: 'inline-block',
            width: 'fit-content',
          }}
        >
          Long-form companion: &ldquo;{beat.expandedBundle.title}&rdquo; ↗
        </a>
      )}

      {beat.generated && <SlidePreview beat={beat} />}
    </div>
  )
}

function SlidePreview({ beat }: { beat: Beat }) {
  if (!beat.generated) return null
  if (beat.slideType === 'diagram' && beat.generated.html) {
    return (
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16 / 9',
          border: '0.5px solid var(--border-2)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          background: '#0a0a0a',
          marginTop: 4,
        }}
      >
        <iframe
          srcDoc={beat.generated.html}
          sandbox="allow-scripts"
          title={beat.title ?? 'Diagram slide'}
          style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
        />
      </div>
    )
  }
  if (beat.slideType === 'text' && beat.generated.body) {
    return (
      <div
        style={{
          border: '0.5px solid var(--border-2)',
          borderRadius: 'var(--radius-md)',
          padding: 16,
          background: 'var(--bg-secondary)',
          marginTop: 4,
        }}
      >
        {beat.title && <h3 style={{ marginTop: 0, marginBottom: 8 }}>{beat.title}</h3>}
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{beat.generated.body}</ReactMarkdown>
      </div>
    )
  }
  if (beat.slideType === 'chart' && beat.generated.chartType && beat.generated.data) {
    const chart: ChartData = {
      chartType: beat.generated.chartType,
      title: beat.title ?? beat.generated.title,
      xLabel: beat.generated.xLabel,
      yLabel: beat.generated.yLabel,
      data: beat.generated.data,
      dataNote: beat.generated.dataNote,
    }
    return (
      <div
        style={{
          border: '0.5px solid var(--border-2)',
          borderRadius: 'var(--radius-md)',
          padding: 16,
          background: 'var(--bg-secondary)',
          marginTop: 4,
        }}
      >
        <ChartRenderer chart={chart} theme="light" />
      </div>
    )
  }
  return null
}

function BundleSectionEditor({
  beat,
  bundles,
  onUpdate,
}: {
  beat: Beat
  bundles: SessionData['course']['bundles']
  onUpdate: (patch: Record<string, unknown>) => void
}) {
  const currentBundle = bundles.find((b) => b.id === beat.bundleId)
  const sections = useMemo(
    () => (currentBundle ? splitByH2(currentBundle.generatedContent) : []),
    [currentBundle],
  )
  const currentSection = sections.find((s) => s.heading === beat.sectionKey)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select
          value={beat.bundleId ?? ''}
          onChange={(e) => onUpdate({ bundleId: e.target.value || null, sectionKey: null })}
          style={{ ...textInputStyle, flex: 1, minWidth: 200 }}
        >
          <option value="">— pick a bundle —</option>
          {bundles.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title}
            </option>
          ))}
        </select>
        <select
          value={beat.sectionKey ?? ''}
          onChange={(e) => onUpdate({ sectionKey: e.target.value || null })}
          disabled={!currentBundle}
          style={{ ...textInputStyle, flex: 1, minWidth: 200 }}
        >
          <option value="">— pick a section —</option>
          {sections.map((s) => (
            <option key={s.heading} value={s.heading}>
              {s.heading}
            </option>
          ))}
        </select>
      </div>
      {currentSection && (
        <div
          style={{
            border: '0.5px solid var(--border-2)',
            borderRadius: 'var(--radius-md)',
            padding: 16,
            background: 'var(--bg-secondary)',
          }}
        >
          <h3 style={{ marginTop: 0 }}>{currentSection.heading}</h3>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentSection.body}</ReactMarkdown>
        </div>
      )}
      {beat.bundleId && !currentBundle && (
        <div style={{ color: '#c0392b', fontSize: 12 }}>
          The referenced bundle was deleted. Pick another.
        </div>
      )}
    </div>
  )
}

function HighlightQuoteEditor({ beat }: { beat: Beat }) {
  if (!beat.highlight) {
    return (
      <div style={{ color: '#c0392b', fontSize: 12 }}>
        The referenced highlight is missing. Delete this beat and re-add it.
      </div>
    )
  }
  return (
    <div
      style={{
        borderLeft: `3px solid ${highlightColor(beat.highlight.color)}`,
        paddingLeft: 12,
        fontSize: 15,
        lineHeight: 1.5,
      }}
    >
      <div style={{ fontStyle: 'italic', color: 'var(--text-primary)' }}>
        &ldquo;{beat.highlight.anchorText}&rdquo;
      </div>
      {beat.highlight.note && (
        <div
          style={{ marginTop: 8, fontSize: 13, color: 'var(--text-secondary)' }}
        >
          {beat.highlight.note}
        </div>
      )}
    </div>
  )
}

function highlightColor(name: string): string {
  switch (name) {
    case 'yellow': return '#f1c40f'
    case 'green': return '#27ae60'
    case 'blue': return '#3498db'
    case 'pink': return '#e91e63'
    default: return '#888'
  }
}

function SectionHeaderEditor({
  beat,
  onUpdate,
}: {
  beat: Beat
  onUpdate: (patch: Record<string, unknown>) => void
}) {
  const [title, setTitle] = useState(beat.title ?? '')
  useEffect(() => {
    setTitle(beat.title ?? '')
  }, [beat.id, beat.title])
  const dirty = title !== (beat.title ?? '')
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Section header text"
        style={{ ...textInputStyle, fontSize: 20, fontWeight: 600, flex: 1 }}
      />
      {dirty && <button onClick={() => onUpdate({ title })}>Save</button>}
    </div>
  )
}

function SpeakerNotesEditor({
  beat,
  onUpdate,
}: {
  beat: Beat
  onUpdate: (patch: Record<string, unknown>) => void
}) {
  const [notes, setNotes] = useState(beat.speakerNotes ?? '')
  const [open, setOpen] = useState(Boolean(beat.speakerNotes))
  useEffect(() => {
    setNotes(beat.speakerNotes ?? '')
  }, [beat.id, beat.speakerNotes])
  const dirty = notes !== (beat.speakerNotes ?? '')

  return (
    <div style={{ marginTop: 12, borderTop: '0.5px solid var(--border-1)', paddingTop: 12 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          fontSize: 11,
          color: 'var(--text-secondary)',
          padding: '2px 6px',
        }}
      >
        {open ? '▾' : '▸'} Speaker notes {beat.speakerNotes ? '' : '(empty)'}
      </button>
      {open && (
        <div style={{ marginTop: 8 }}>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What you say aloud when showing this beat."
            rows={3}
            style={textareaStyle}
          />
          {dirty && (
            <button
              onClick={() => onUpdate({ speakerNotes: notes || null })}
              style={{ marginTop: 4 }}
            >
              Save notes
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function AddBeat({
  bundles,
  onAdd,
}: {
  bundles: SessionData['course']['bundles']
  onAdd: (body: Record<string, unknown>) => void
}) {
  const [mode, setMode] = useState<
    null | 'slide' | 'bundle_section' | 'highlight_quote' | 'section_header'
  >(null)

  if (mode === null) {
    return (
      <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
          Add a beat
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setMode('slide')}>+ Slide</button>
          <button onClick={() => setMode('bundle_section')}>+ Bundle section</button>
          <button onClick={() => setMode('highlight_quote')}>+ Highlight quote</button>
          <button onClick={() => setMode('section_header')}>+ Section header</button>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        marginTop: 24,
        padding: 16,
        border: '0.5px dashed var(--border-2)',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      {mode === 'slide' && (
        <AddSlideForm
          bundles={bundles}
          onCancel={() => setMode(null)}
          onSubmit={(body) => {
            onAdd(body)
            setMode(null)
          }}
        />
      )}
      {mode === 'bundle_section' && (
        <AddBundleSectionForm
          bundles={bundles}
          onCancel={() => setMode(null)}
          onSubmit={(body) => {
            onAdd(body)
            setMode(null)
          }}
        />
      )}
      {mode === 'highlight_quote' && (
        <AddHighlightForm
          bundles={bundles}
          onCancel={() => setMode(null)}
          onSubmit={(body) => {
            onAdd(body)
            setMode(null)
          }}
        />
      )}
      {mode === 'section_header' && (
        <AddSectionHeaderForm
          onCancel={() => setMode(null)}
          onSubmit={(body) => {
            onAdd(body)
            setMode(null)
          }}
        />
      )}
    </div>
  )
}

function AddSlideForm({
  bundles,
  onCancel,
  onSubmit,
}: {
  bundles: SessionData['course']['bundles']
  onCancel: () => void
  onSubmit: (body: Record<string, unknown>) => void
}) {
  const [slideType, setSlideType] = useState<SlideType>('text')
  const [title, setTitle] = useState('')
  const [outline, setOutline] = useState('')
  const [bundleId, setBundleId] = useState<string>('')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {(['text', 'diagram', 'chart'] as SlideType[]).map((t) => (
          <button
            key={t}
            onClick={() => setSlideType(t)}
            style={{
              background: slideType === t ? 'var(--bg-accent)' : undefined,
              color: slideType === t ? 'var(--text-accent)' : undefined,
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={
          slideType === 'diagram'
            ? 'Internal label (not shown on the slide)'
            : 'Slide title (optional — LLM will suggest one)'
        }
        style={textInputStyle}
      />
      <textarea
        value={outline}
        onChange={(e) => setOutline(e.target.value)}
        rows={3}
        placeholder={
          slideType === 'diagram'
            ? 'Describe the visual'
            : slideType === 'chart'
              ? 'Describe the chart, e.g. "AI spend as % of IT budgets, 2020–2026"'
              : 'What should this slide say?'
        }
        style={textareaStyle}
      />
      {(slideType === 'text' || slideType === 'chart') && (
        <select
          value={bundleId}
          onChange={(e) => setBundleId(e.target.value)}
          style={textInputStyle}
        >
          <option value="">No grounding bundle</option>
          {bundles.map((b) => (
            <option key={b.id} value={b.id}>
              Ground in: {b.title}
            </option>
          ))}
        </select>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() =>
            onSubmit({
              kind: 'slide',
              slideType,
              title: title || null,
              outline: outline || null,
              bundleId: bundleId || null,
            })
          }
          style={{ background: 'var(--bg-accent)', color: 'var(--text-accent)' }}
        >
          Add slide
        </button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

function AddBundleSectionForm({
  bundles,
  onCancel,
  onSubmit,
}: {
  bundles: SessionData['course']['bundles']
  onCancel: () => void
  onSubmit: (body: Record<string, unknown>) => void
}) {
  const [bundleId, setBundleId] = useState('')
  const [sectionKey, setSectionKey] = useState('')
  const currentBundle = bundles.find((b) => b.id === bundleId)
  const sections = useMemo(
    () => (currentBundle ? splitByH2(currentBundle.generatedContent) : []),
    [currentBundle],
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <select
        value={bundleId}
        onChange={(e) => {
          setBundleId(e.target.value)
          setSectionKey('')
        }}
        style={textInputStyle}
      >
        <option value="">— pick a bundle —</option>
        {bundles.map((b) => (
          <option key={b.id} value={b.id}>
            {b.title}
          </option>
        ))}
      </select>
      <select
        value={sectionKey}
        onChange={(e) => setSectionKey(e.target.value)}
        disabled={!currentBundle}
        style={textInputStyle}
      >
        <option value="">— pick a section —</option>
        {sections.map((s) => (
          <option key={s.heading} value={s.heading}>
            {s.heading}
          </option>
        ))}
      </select>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() =>
            onSubmit({
              kind: 'bundle_section',
              bundleId,
              sectionKey: sectionKey || null,
            })
          }
          disabled={!bundleId}
          style={{ background: 'var(--bg-accent)', color: 'var(--text-accent)' }}
        >
          Add bundle section
        </button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

function AddHighlightForm({
  bundles,
  onCancel,
  onSubmit,
}: {
  bundles: SessionData['course']['bundles']
  onCancel: () => void
  onSubmit: (body: Record<string, unknown>) => void
}) {
  const [bundleId, setBundleId] = useState('')
  const [highlightId, setHighlightId] = useState('')
  const currentBundle = bundles.find((b) => b.id === bundleId)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <select
        value={bundleId}
        onChange={(e) => {
          setBundleId(e.target.value)
          setHighlightId('')
        }}
        style={textInputStyle}
      >
        <option value="">— pick a bundle —</option>
        {bundles.map((b) => (
          <option key={b.id} value={b.id}>
            {b.title} ({b.highlights.length} highlights)
          </option>
        ))}
      </select>
      {currentBundle && currentBundle.highlights.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          No highlights on this bundle.
        </div>
      )}
      {currentBundle && currentBundle.highlights.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 300, overflowY: 'auto' }}>
          {currentBundle.highlights.map((h) => (
            <label
              key={h.id}
              style={{
                display: 'block',
                padding: 8,
                borderRadius: 'var(--radius-md)',
                border: '0.5px solid var(--border-1)',
                cursor: 'pointer',
                borderLeftWidth: 3,
                borderLeftColor: highlightColor(h.color),
                background: highlightId === h.id ? 'var(--bg-accent)' : 'var(--bg-primary)',
              }}
            >
              <input
                type="radio"
                name="hl"
                value={h.id}
                checked={highlightId === h.id}
                onChange={() => setHighlightId(h.id)}
                style={{ marginRight: 6 }}
              />
              <span style={{ fontSize: 13 }}>
                &ldquo;{h.anchorText.slice(0, 120)}{h.anchorText.length > 120 ? '…' : ''}&rdquo;
              </span>
              {h.note && (
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, marginLeft: 18 }}>
                  Note: {h.note}
                </div>
              )}
            </label>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => onSubmit({ kind: 'highlight_quote', highlightId })}
          disabled={!highlightId}
          style={{ background: 'var(--bg-accent)', color: 'var(--text-accent)' }}
        >
          Add quote
        </button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

function AddSectionHeaderForm({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void
  onSubmit: (body: Record<string, unknown>) => void
}) {
  const [title, setTitle] = useState('')
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Section header text"
        style={{ ...textInputStyle, flex: 1 }}
      />
      <button
        onClick={() => onSubmit({ kind: 'section_header', title })}
        disabled={!title.trim()}
        style={{ background: 'var(--bg-accent)', color: 'var(--text-accent)' }}
      >
        Add
      </button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  )
}

const textInputStyle: React.CSSProperties = {
  width: '100%',
  padding: 8,
  border: '0.5px solid var(--border-2)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  font: 'inherit',
  fontSize: 13,
}

const textareaStyle: React.CSSProperties = {
  ...textInputStyle,
  resize: 'vertical',
  lineHeight: 1.5,
}
