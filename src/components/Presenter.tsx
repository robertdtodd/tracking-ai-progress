'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import ChartRenderer, { ChartData } from './ChartRenderer'
import DiscussPanel, { BeatChatMessage } from './DiscussPanel'

type BeatKind = 'slide' | 'bundle_section' | 'highlight_quote' | 'section_header'
type SlideType = 'text' | 'diagram' | 'chart'

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
  bundleId: string | null
  sectionKey: string | null
  highlightId: string | null
  speakerNotes: string | null
  bundle: { id: string; title: string; generatedContent: string } | null
  highlight: {
    id: string
    anchorText: string
    color: string
    note: string | null
    bundleId: string
  } | null
  expandedBundle: { id: string; title: string } | null
  messages: BeatChatMessage[]
}

type SessionData = {
  id: string
  title: string
  course: { id: string; name: string }
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

function highlightColor(name: string): string {
  switch (name) {
    case 'yellow': return '#f1c40f'
    case 'green': return '#27ae60'
    case 'blue': return '#3498db'
    case 'pink': return '#e91e63'
    default: return '#888'
  }
}

export default function Presenter({ session }: { session: SessionData }) {
  const [idx, setIdx] = useState(0)
  const [showThumbs, setShowThumbs] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [showDiscuss, setShowDiscuss] = useState(false)

  const initialThreads = useMemo<Record<string, BeatChatMessage[]>>(() => {
    const map: Record<string, BeatChatMessage[]> = {}
    for (const b of session.beats) map[b.id] = b.messages ?? []
    return map
  }, [session.beats])
  const [threads, setThreads] = useState<Record<string, BeatChatMessage[]>>(initialThreads)

  const total = session.beats.length

  const next = useCallback(() => setIdx((i) => Math.min(i + 1, Math.max(total - 1, 0))), [total])
  const prev = useCallback(() => setIdx((i) => Math.max(i - 1, 0)), [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Don't intercept while user is typing in an input.
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        // Allow Escape to close overlays even while typing
        if (e.key === 'Escape') {
          setShowDiscuss(false)
          setShowNotes(false)
          setShowThumbs(false)
        }
        return
      }

      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        prev()
      } else if (e.key === 'Home') {
        e.preventDefault()
        setIdx(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        setIdx(Math.max(total - 1, 0))
      } else if (e.key === 't' || e.key === 'T') {
        setShowThumbs((s) => !s)
      } else if (e.key === 'n' || e.key === 'N') {
        setShowNotes((s) => !s)
      } else if (e.key === 'd' || e.key === 'D') {
        setShowDiscuss((s) => !s)
      } else if (e.key === 'Escape') {
        // exit handled by Link below; just close overlays first
        setShowDiscuss(false)
        setShowNotes(false)
        setShowThumbs(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, total])

  // Lock page scroll while presenting
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [])

  if (total === 0) {
    return (
      <div style={{ ...rootStyle, justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center', color: '#666' }}>
          <div style={{ fontSize: 24, marginBottom: 12 }}>This session has no beats yet.</div>
          <Link
            href={`/sessions/${session.id}/edit`}
            style={{ color: '#7f77dd', fontSize: 14 }}
          >
            ← Back to editor
          </Link>
        </div>
      </div>
    )
  }

  const beat = session.beats[Math.min(idx, total - 1)]

  return (
    <div style={rootStyle}>
      <div style={topBarStyle}>
        <Link
          href={`/sessions/${session.id}/edit`}
          style={controlLinkStyle}
          title="Exit (Esc)"
        >
          ← Exit
        </Link>
        <div style={{ flex: 1, textAlign: 'center', color: '#666', fontSize: 12 }}>
          {session.course.name} · {session.title}
        </div>
        <div style={{ color: '#666', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
          {idx + 1} / {total}
        </div>
      </div>

      <div style={contentRowStyle}>
        <div
          style={beatAreaStyle}
          onClick={(e) => {
            // Advance only on clicks in the empty surrounding area, not on inner content.
            if (e.target === e.currentTarget) next()
          }}
        >
          <BeatRenderer beat={beat} />
        </div>

        {showDiscuss && (
          <DiscussPanel
            beatId={beat.id}
            beatLabel={beatLabel(beat)}
            messages={threads[beat.id] ?? []}
            onMessagesChange={(next) =>
              setThreads((prev) => ({ ...prev, [beat.id]: next }))
            }
            onClose={() => setShowDiscuss(false)}
          />
        )}
      </div>

      <div style={hintBarStyle}>
        <kbd style={kbdStyle}>←</kbd>
        <kbd style={kbdStyle}>→</kbd>
        <span>navigate</span>
        <span style={{ opacity: 0.5 }}>·</span>
        <kbd style={kbdStyle}>T</kbd>
        <span>thumbnails</span>
        <span style={{ opacity: 0.5 }}>·</span>
        <kbd style={kbdStyle}>N</kbd>
        <span>notes</span>
        <span style={{ opacity: 0.5 }}>·</span>
        <kbd style={kbdStyle}>D</kbd>
        <span>discuss</span>
        <span style={{ opacity: 0.5 }}>·</span>
        <kbd style={kbdStyle}>Esc</kbd>
        <span>exit</span>
      </div>

      {showNotes && beat.speakerNotes && (
        <div style={notesOverlayStyle}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 6, letterSpacing: 0.5 }}>
            SPEAKER NOTES
          </div>
          <div style={{ color: '#1a1a1a', fontSize: 16, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
            {beat.speakerNotes}
          </div>
        </div>
      )}
      {showNotes && !beat.speakerNotes && (
        <div style={notesOverlayStyle}>
          <div style={{ color: '#666', fontStyle: 'italic' }}>No speaker notes for this beat.</div>
        </div>
      )}

      {showThumbs && (
        <div style={thumbStripStyle}>
          {session.beats.map((b, i) => (
            <button
              key={b.id}
              onClick={() => setIdx(i)}
              style={{
                ...thumbStyle,
                borderColor: i === idx ? '#7f77dd' : '#ddd',
                background: i === idx ? '#7f77dd' : '#f5f5f5',
                color: i === idx ? '#fff' : '#666',
              }}
              title={beatLabel(b)}
            >
              <div style={{ fontSize: 10, opacity: 0.6 }}>{i + 1}</div>
              <div style={{ fontSize: 11, marginTop: 2, lineHeight: 1.2 }}>
                {beatThumbTitle(b)}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function beatLabel(b: Beat): string {
  if (b.kind === 'slide') return `${b.slideType} slide`
  if (b.kind === 'bundle_section') return `Bundle section: ${b.sectionKey ?? '?'}`
  if (b.kind === 'highlight_quote') return 'Highlight quote'
  if (b.kind === 'section_header') return 'Section'
  return b.kind
}

function beatThumbTitle(b: Beat): string {
  if (b.kind === 'section_header') return b.title || 'Section'
  if (b.kind === 'slide') return b.title || (b.slideType ?? '') + ' slide'
  if (b.kind === 'bundle_section') return b.sectionKey || b.bundle?.title || 'Section'
  if (b.kind === 'highlight_quote') return 'Quote'
  return ''
}

function BeatRenderer({ beat }: { beat: Beat }) {
  if (beat.kind === 'section_header') {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 56, fontWeight: 600, color: '#1a1a1a', lineHeight: 1.15 }}>
          {beat.title || 'Section'}
        </div>
      </div>
    )
  }

  if (beat.kind === 'slide' && beat.slideType === 'diagram' && beat.generated?.html) {
    return (
      <iframe
        srcDoc={beat.generated.html}
        sandbox="allow-scripts"
        title={beat.title ?? 'Diagram'}
        style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
      />
    )
  }

  if (beat.kind === 'slide' && beat.slideType === 'text' && beat.generated?.body) {
    return (
      <div style={textSlideContainerStyle}>
        {beat.title && <div style={slideTitleStyle}>{beat.title}</div>}
        <div style={textSlideBodyStyle}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{beat.generated.body}</ReactMarkdown>
        </div>
      </div>
    )
  }

  if (
    beat.kind === 'slide' &&
    beat.slideType === 'chart' &&
    beat.generated?.chartType &&
    beat.generated?.data
  ) {
    const chart: ChartData = {
      chartType: beat.generated.chartType,
      title: beat.title ?? beat.generated.title,
      xLabel: beat.generated.xLabel,
      yLabel: beat.generated.yLabel,
      data: beat.generated.data,
      dataNote: beat.generated.dataNote,
    }
    return (
      <div style={{ width: '100%', maxWidth: 1200 }}>
        <ChartRenderer chart={chart} theme="light" />
      </div>
    )
  }

  if (beat.kind === 'slide' && !beat.generated) {
    return (
      <div style={{ textAlign: 'center', color: '#666' }}>
        <div style={{ fontSize: 18, marginBottom: 8 }}>Slide not generated yet</div>
        {beat.outline && (
          <div style={{ fontSize: 14, fontStyle: 'italic', maxWidth: 600 }}>
            Outline: {beat.outline}
          </div>
        )}
      </div>
    )
  }

  if (beat.kind === 'bundle_section') {
    if (!beat.bundle) {
      return <MissingRef label="bundle" />
    }
    const sections = splitByH2(beat.bundle.generatedContent)
    const section = sections.find((s) => s.heading === beat.sectionKey)
    if (!section) {
      return (
        <MissingRef
          label={`section "${beat.sectionKey ?? '?'}" in ${beat.bundle.title}`}
        />
      )
    }
    return (
      <div style={textSlideContainerStyle}>
        <div style={slideTitleStyle}>{section.heading}</div>
        <div style={textSlideBodyStyle}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.body}</ReactMarkdown>
        </div>
      </div>
    )
  }

  if (beat.kind === 'highlight_quote') {
    if (!beat.highlight) return <MissingRef label="highlight" />
    return (
      <div
        style={{
          maxWidth: 1100,
          padding: 40,
          borderLeft: `6px solid ${highlightColor(beat.highlight.color)}`,
          paddingLeft: 40,
        }}
      >
        <div
          style={{
            fontSize: 40,
            fontStyle: 'italic',
            lineHeight: 1.35,
            color: '#1a1a1a',
            fontWeight: 300,
          }}
        >
          &ldquo;{beat.highlight.anchorText}&rdquo;
        </div>
        {beat.highlight.note && (
          <div
            style={{
              marginTop: 24,
              fontSize: 18,
              color: '#666',
              lineHeight: 1.5,
            }}
          >
            {beat.highlight.note}
          </div>
        )}
      </div>
    )
  }

  return <div style={{ color: '#888' }}>Unsupported beat</div>
}

function MissingRef({ label }: { label: string }) {
  return (
    <div style={{ color: '#c0392b', textAlign: 'center' }}>
      <div style={{ fontSize: 24, marginBottom: 6 }}>Missing reference</div>
      <div style={{ fontSize: 14, color: '#888' }}>The {label} this beat points to is gone.</div>
    </div>
  )
}

const rootStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: '#ffffff',
  color: '#1a1a1a',
  display: 'flex',
  flexDirection: 'column',
  zIndex: 9999,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
}

const topBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 20px',
  borderBottom: '1px solid #e5e5e5',
}

const controlLinkStyle: React.CSSProperties = {
  color: '#444',
  textDecoration: 'none',
  fontSize: 13,
  padding: '4px 10px',
  border: '1px solid #e5e5e5',
  borderRadius: 6,
  background: '#f5f5f5',
}

const contentRowStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'row',
  minHeight: 0,
}

const beatAreaStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '40px 60px',
  minHeight: 0,
  minWidth: 0,
  cursor: 'pointer',
}

const slideTitleStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 600,
  color: '#1a1a1a',
  marginBottom: 24,
  textAlign: 'center',
}

const textSlideContainerStyle: React.CSSProperties = {
  maxWidth: 1100,
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
}

const textSlideBodyStyle: React.CSSProperties = {
  fontSize: 22,
  lineHeight: 1.55,
  color: '#1a1a1a',
  width: '100%',
}

const hintBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  padding: '8px 12px',
  fontSize: 11,
  color: '#666',
  borderTop: '1px solid #e5e5e5',
}

const kbdStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '1px 6px',
  border: '1px solid #ddd',
  borderRadius: 4,
  background: '#f5f5f5',
  color: '#666',
  fontFamily: 'inherit',
  fontSize: 10,
}

const notesOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  left: 24,
  right: 24,
  bottom: 80,
  padding: 20,
  background: 'rgba(255, 255, 255, 0.97)',
  border: '1px solid #e5e5e5',
  borderRadius: 12,
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
  maxHeight: '40vh',
  overflowY: 'auto',
}

const thumbStripStyle: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 32,
  display: 'flex',
  gap: 8,
  padding: '12px 20px',
  background: 'rgba(255, 255, 255, 0.97)',
  borderTop: '1px solid #e5e5e5',
  boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.06)',
  overflowX: 'auto',
}

const thumbStyle: React.CSSProperties = {
  flex: '0 0 auto',
  width: 110,
  height: 70,
  border: '1px solid #ddd',
  borderRadius: 6,
  background: '#f5f5f5',
  color: '#666',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  justifyContent: 'flex-start',
  padding: 6,
  textAlign: 'left',
  cursor: 'pointer',
  font: 'inherit',
  overflow: 'hidden',
}
