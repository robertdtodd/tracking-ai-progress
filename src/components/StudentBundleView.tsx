'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type Highlight = {
  id: string
  anchorText: string
  color: string
  note: string | null
  position: number
}

type Message = {
  id: string
  role: string
  content: string
  createdAt: string
}

type ArticleRef = {
  title: string
  date: string
  section: string
  author: string | null
  source: string
  url: string | null
}

interface Props {
  title: string
  themes: string[]
  articleCount: number
  generatedContent: string
  highlights: Highlight[]
  messages: Message[]
  articles: ArticleRef[]
}

type Section = { heading: string; body: string }

function splitByH2(content: string): { preamble: string; sections: Section[] } {
  const lines = content.split('\n')
  const preambleLines: string[] = []
  const sections: Section[] = []
  let current: Section | null = null

  for (const line of lines) {
    const m = line.match(/^##\s+(.+?)\s*$/)
    if (m) {
      if (current) sections.push(current)
      current = { heading: m[1], body: '' }
    } else if (current) {
      current.body += (current.body ? '\n' : '') + line
    } else {
      preambleLines.push(line)
    }
  }
  if (current) sections.push(current)

  return {
    preamble: preambleLines.join('\n').trim(),
    sections,
  }
}

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

function sourceLabel(source: string): string {
  if (source === 'nyt') return 'NYT'
  if (source === 'guardian') return 'Guardian'
  return source
}

export default function StudentBundleView({
  title,
  themes,
  articleCount,
  generatedContent,
  highlights,
  messages,
  articles,
}: Props) {
  const { preamble, sections } = useMemo(
    () => splitByH2(generatedContent),
    [generatedContent],
  )
  const contentRef = useRef<HTMLDivElement>(null)

  const applyHighlights = useCallback(() => {
    const container = contentRef.current
    if (!container) return

    container.querySelectorAll('mark[data-hl-id]').forEach((mark) => {
      const parent = mark.parentNode
      if (!parent) return
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark)
      parent.removeChild(mark)
    })
    container.normalize()

    for (const hl of highlights) {
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
      let node: Node | null
      while ((node = walker.nextNode())) {
        const text = node.textContent || ''
        const idx = text.indexOf(hl.anchorText)
        if (idx < 0) continue
        const range = document.createRange()
        try {
          range.setStart(node, idx)
          range.setEnd(node, idx + hl.anchorText.length)
          const mark = document.createElement('mark')
          mark.setAttribute('data-hl-id', hl.id)
          mark.className = `hl hl-${hl.color}`
          if (hl.note) mark.title = hl.note
          range.surroundContents(mark)
          break
        } catch {
          break
        }
      }
    }
  }, [highlights])

  useEffect(() => {
    applyHighlights()
  }, [applyHighlights])

  return (
    <main className="student-bundle">
      <header className="student-bundle-head">
        <h1>{title}</h1>
        <div className="student-bundle-meta">
          {articleCount} articles
          {themes.length > 0 ? ` · ${themes.join(', ')}` : ''}
        </div>
      </header>

      <section className="student-content">
        <div ref={contentRef} className="content-box content-rendered student-content-rendered">
          {preamble && <ReactMarkdown remarkPlugins={[remarkGfm]}>{preamble}</ReactMarkdown>}
          {sections.length === 0 && !preamble && (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{generatedContent}</ReactMarkdown>
          )}
          {sections.map((section) => (
            <section key={section.heading} className="md-section">
              <h2 className="md-section-heading md-section-heading-static">
                {section.heading}
              </h2>
              <div className="md-section-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.body}</ReactMarkdown>
              </div>
            </section>
          ))}
        </div>
      </section>

      {messages.length > 0 && (
        <section className="student-discussion">
          <h2 className="student-discussion-title">Class discussion</h2>
          <div className="student-discussion-thread">
            {messages.map((m) => (
              <div key={m.id} className={`student-msg student-msg-${m.role}`}>
                <div className="student-msg-label">
                  {m.role === 'user' ? 'Question' : 'Claude'}
                </div>
                <div className="student-msg-body">{m.content}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="student-sources">
        <h2 className="student-sources-title">Source articles</h2>
        {articles.length === 0 ? (
          <div className="student-sources-empty">No sources linked.</div>
        ) : (
          <ul className="student-sources-list">
            {articles.map((a) => (
              <li key={a.title} className="student-sources-row">
                <span className="student-sources-date">{fmtDate(a.date)}</span>
                <span className="student-sources-title-cell">
                  {a.url ? (
                    <a href={a.url} target="_blank" rel="noopener noreferrer">
                      {a.title}
                    </a>
                  ) : (
                    a.title
                  )}
                  {a.author && (
                    <span className="student-sources-author"> — {a.author}</span>
                  )}
                </span>
                <span className="student-sources-pub">
                  {sourceLabel(a.source)} · {a.section}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
