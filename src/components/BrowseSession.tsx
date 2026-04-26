'use client'

import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import ChartRenderer, { ChartData } from './ChartRenderer'

type BeatKind = 'slide' | 'bundle_section' | 'highlight_quote' | 'section_header'
type SlideType = 'text' | 'diagram' | 'chart'

type Beat = {
  id: string
  position: number
  kind: BeatKind
  slideType: SlideType | null
  title: string | null
  generated: {
    html?: string
    body?: string
    chartType?: 'bar' | 'line'
    title?: string
    xLabel?: string
    yLabel?: string
    data?: Array<{ label: string; value: number }>
    dataNote?: string | null
  } | null
  bundleId: string | null
  bundle: { id: string; title: string; generatedContent: string; published: boolean } | null
  sectionKey: string | null
  highlightId: string | null
  highlight: { id: string; anchorText: string; color: string; note: string | null } | null
  expandedBundle: { id: string; title: string; published: boolean } | null
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

export default function BrowseSession({
  courseId,
  beats,
}: {
  courseId: string
  beats: Beat[]
}) {
  return (
    <main className="browse-body">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32, maxWidth: 760, margin: '0 auto' }}>
        {beats.map((beat) => (
          <BeatBlock key={beat.id} beat={beat} courseId={courseId} />
        ))}
      </div>
    </main>
  )
}

function BeatBlock({ beat, courseId }: { beat: Beat; courseId: string }) {
  if (beat.kind === 'section_header') {
    const isDiscussion = (beat.title ?? '').toLowerCase().startsWith('discussion')
    return (
      <section style={{ marginTop: 24 }}>
        {isDiscussion && (
          <div
            style={{
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              color: 'var(--text-tertiary)',
              fontWeight: 600,
              marginBottom: 4,
            }}
          >
            Discussion
          </div>
        )}
        <h2
          style={{
            fontSize: 26,
            fontWeight: 600,
            margin: 0,
            paddingBottom: 8,
            borderBottom: '0.5px solid var(--border-1)',
          }}
        >
          {beat.title || 'Section'}
        </h2>
      </section>
    )
  }

  return (
    <article>
      {beat.kind === 'slide' && <SlideBlock beat={beat} />}
      {beat.kind === 'bundle_section' && <BundleSectionBlock beat={beat} />}
      {beat.kind === 'highlight_quote' && <HighlightBlock beat={beat} />}
      {beat.expandedBundle?.published && (
        <ExpandedBundleLink courseId={courseId} expanded={beat.expandedBundle} />
      )}
    </article>
  )
}

function SlideBlock({ beat }: { beat: Beat }) {
  if (!beat.generated) {
    return (
      <div style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
        (slide not generated)
      </div>
    )
  }

  if (beat.slideType === 'diagram' && beat.generated.html) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {beat.title && <h3 style={slideTitleStyle}>{beat.title}</h3>}
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16 / 9',
            border: '0.5px solid var(--border-1)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            background: '#0a0a0a',
          }}
        >
          <iframe
            srcDoc={beat.generated.html}
            sandbox="allow-scripts"
            title={beat.title ?? 'Diagram'}
            style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
          />
        </div>
      </div>
    )
  }

  if (beat.slideType === 'text' && beat.generated.body) {
    return (
      <div>
        {beat.title && <h3 style={slideTitleStyle}>{beat.title}</h3>}
        <div style={{ fontSize: 16, lineHeight: 1.65 }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{beat.generated.body}</ReactMarkdown>
        </div>
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
          padding: 16,
          border: '0.5px solid var(--border-1)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-secondary)',
        }}
      >
        <ChartRenderer chart={chart} theme="light" />
      </div>
    )
  }

  return null
}

function BundleSectionBlock({ beat }: { beat: Beat }) {
  if (!beat.bundle || !beat.bundle.published) {
    return null
  }
  const sections = splitByH2(beat.bundle.generatedContent)
  const section = sections.find((s) => s.heading === beat.sectionKey)
  if (!section) return null
  return (
    <div>
      <h3 style={slideTitleStyle}>{section.heading}</h3>
      <div style={{ fontSize: 16, lineHeight: 1.65 }}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.body}</ReactMarkdown>
      </div>
    </div>
  )
}

function HighlightBlock({ beat }: { beat: Beat }) {
  if (!beat.highlight) return null
  return (
    <blockquote
      style={{
        margin: 0,
        padding: '8px 16px',
        borderLeft: `4px solid ${highlightColor(beat.highlight.color)}`,
        fontSize: 18,
        fontStyle: 'italic',
        lineHeight: 1.5,
      }}
    >
      &ldquo;{beat.highlight.anchorText}&rdquo;
      {beat.highlight.note && (
        <div style={{ marginTop: 8, fontSize: 14, fontStyle: 'normal', color: 'var(--text-secondary)' }}>
          {beat.highlight.note}
        </div>
      )}
    </blockquote>
  )
}

function ExpandedBundleLink({
  courseId,
  expanded,
}: {
  courseId: string
  expanded: { id: string; title: string }
}) {
  return (
    <div style={{ marginTop: 12 }}>
      <Link
        href={`/browse/${courseId}/${expanded.id}`}
        style={{
          fontSize: 13,
          padding: '6px 12px',
          background: 'var(--bg-info)',
          color: 'var(--text-info)',
          borderRadius: 'var(--radius-md)',
          border: '0.5px solid var(--border-info)',
          textDecoration: 'none',
          display: 'inline-block',
        }}
      >
        Read the long-form companion: &ldquo;{expanded.title}&rdquo; →
      </Link>
    </div>
  )
}

const slideTitleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 600,
  margin: '0 0 12px 0',
}
