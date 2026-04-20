'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Bundle, Highlight } from './CoursePanel'
import HighlightToolbar, { type ToolbarState } from './HighlightToolbar'

interface Props {
  bundle: Bundle
  engageOpen: boolean
  onToggleEngage: () => void
  presenting: boolean
  onTogglePresent: () => void
  onUpdated: (b: Bundle) => void
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

export default function BundleDetail({
  bundle,
  engageOpen,
  onToggleEngage,
  presenting,
  onTogglePresent,
  onUpdated,
}: Props) {
  const { preamble, sections } = useMemo(
    () => splitByH2(bundle.generatedContent),
    [bundle.generatedContent],
  )

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [highlights, setHighlights] = useState<Highlight[]>(bundle.highlights ?? [])
  const [toolbar, setToolbar] = useState<ToolbarState>(null)
  const [regenerating, setRegenerating] = useState(false)
  const [regenElapsed, setRegenElapsed] = useState(0)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!regenerating) {
      setRegenElapsed(0)
      return
    }
    const start = Date.now()
    const id = setInterval(() => {
      setRegenElapsed(Math.floor((Date.now() - start) / 1000))
    }, 250)
    return () => clearInterval(id)
  }, [regenerating])

  const fmtElapsed = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  async function handleRegenerate() {
    if (regenerating) return
    const ok = confirm(
      `Regenerate "${bundle.title}"?\n\nContent will be replaced with a fresh generation.\nAll Refine and Discuss chat history for this theme will be DELETED.\nHighlights stay in the DB but may stop rendering if anchor text changes.`,
    )
    if (!ok) return

    setRegenerating(true)
    try {
      const res = await fetch(`/api/bundles/${bundle.id}/regenerate`, {
        method: 'POST',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert('Regeneration failed: ' + (err.error || res.statusText))
        return
      }
      const updated: Bundle = await res.json()
      onUpdated(updated)
    } catch (err) {
      alert('Regeneration failed: ' + (err as Error).message)
    } finally {
      setRegenerating(false)
    }
  }

  const [publishing, setPublishing] = useState(false)

  async function handleTogglePublish() {
    if (publishing) return
    const willPublish = !bundle.published
    setPublishing(true)
    try {
      const res = await fetch(`/api/bundles/${bundle.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: willPublish }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert('Failed: ' + (err.error || res.statusText))
        return
      }
      const updated: Bundle = await res.json()
      onUpdated(updated)
    } finally {
      setPublishing(false)
    }
  }

  useEffect(() => {
    setCollapsed(new Set())
    setHighlights(bundle.highlights ?? [])
    setToolbar(null)
  }, [bundle.id])

  useEffect(() => {
    setHighlights(bundle.highlights ?? [])
  }, [bundle.highlights])

  function toggleSection(heading: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(heading)) next.delete(heading)
      else next.add(heading)
      return next
    })
  }

  const allCollapsed = sections.length > 0 && collapsed.size === sections.length

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
  }, [applyHighlights, collapsed, bundle.generatedContent])

  useEffect(() => {
    function handleMouseUp(e: MouseEvent) {
      const target = e.target as HTMLElement | null
      if (target?.closest('.hl-toolbar')) return

      const sel = window.getSelection()
      if (!sel || sel.isCollapsed) return

      const container = contentRef.current
      if (!container) return

      const range = sel.getRangeAt(0)
      if (!container.contains(range.commonAncestorContainer)) return

      const ancestor = range.commonAncestorContainer
      const ancestorEl =
        ancestor.nodeType === Node.ELEMENT_NODE
          ? (ancestor as HTMLElement)
          : ancestor.parentElement
      if (ancestorEl?.closest('mark[data-hl-id]')) return

      const text = sel.toString().trim()
      if (text.length < 3) return

      const rect = range.getBoundingClientRect()
      setToolbar({
        mode: 'create',
        anchorText: text,
        x: rect.left + rect.width / 2,
        y: rect.top - 8,
      })
    }

    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null
      const mark = target?.closest('mark[data-hl-id]') as HTMLElement | null
      if (!mark) return
      e.preventDefault()
      e.stopPropagation()
      const id = mark.getAttribute('data-hl-id')
      const hl = highlights.find((h) => h.id === id)
      if (!hl) return
      const rect = mark.getBoundingClientRect()
      setToolbar({
        mode: 'edit',
        highlight: hl,
        x: rect.left + rect.width / 2,
        y: rect.top - 8,
      })
    }

    document.addEventListener('mouseup', handleMouseUp)
    const c = contentRef.current
    c?.addEventListener('click', handleClick)
    return () => {
      document.removeEventListener('mouseup', handleMouseUp)
      c?.removeEventListener('click', handleClick)
    }
  }, [highlights])

  async function handleCreate(color: string, note: string | null) {
    if (toolbar?.mode !== 'create') return
    const anchorText = toolbar.anchorText
    setToolbar(null)
    window.getSelection()?.removeAllRanges()

    const res = await fetch(`/api/bundles/${bundle.id}/highlights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anchorText, color, note }),
    })
    if (!res.ok) return
    const created: Highlight = await res.json()
    setHighlights((prev) => [...prev, created])
  }

  async function handleUpdate(id: string, patch: { color?: string; note?: string | null }) {
    setHighlights((prev) => prev.map((h) => (h.id === id ? { ...h, ...patch } : h)))
    const res = await fetch(`/api/highlights/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) return
    const updated: Highlight = await res.json()
    setHighlights((prev) => prev.map((h) => (h.id === id ? updated : h)))
    if (toolbar?.mode === 'edit' && toolbar.highlight.id === id) {
      setToolbar({ ...toolbar, highlight: updated })
    }
  }

  async function handleDelete(id: string) {
    setHighlights((prev) => prev.filter((h) => h.id !== id))
    setToolbar(null)
    await fetch(`/api/highlights/${id}`, { method: 'DELETE' })
  }

  return (
    <div className="bundle-detail">
      <div className="bundle-detail-header">
        <div style={{ minWidth: 0 }}>
          <h2 className="title">{bundle.title}</h2>
          <div className="article-refs">
            {bundle.articleTitles.length} articles
            {bundle.themes.length > 0 ? ` · ${bundle.themes.join(', ')}` : ''}
            {highlights.length > 0 ? ` · ${highlights.length} highlight${highlights.length === 1 ? '' : 's'}` : ''}
            {' · '}
            <span className={`publish-badge publish-badge-${bundle.published ? 'published' : 'draft'}`}>
              {bundle.published ? 'Published' : 'Draft'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button
            className={`engage-btn${bundle.published ? ' active' : ''}`}
            onClick={handleTogglePublish}
            disabled={publishing}
            title={
              bundle.published
                ? 'Unpublish — students can no longer access this theme'
                : 'Publish — make this theme visible to students'
            }
          >
            {publishing ? '…' : bundle.published ? 'Unpublish' : 'Publish'}
          </button>
          <button
            className="engage-btn"
            onClick={handleRegenerate}
            disabled={regenerating}
            title="Regenerate this theme — chat history will be deleted"
          >
            {regenerating ? (
              <>
                <span className="spinner" />
                Regenerating {fmtElapsed(regenElapsed)}
              </>
            ) : (
              'Regenerate'
            )}
          </button>
          <button
            className={`engage-btn${presenting ? ' active' : ''}`}
            onClick={onTogglePresent}
          >
            {presenting ? 'Exit present' : 'Present'}
          </button>
          <button
            className={`engage-btn${engageOpen ? ' active' : ''}`}
            onClick={onToggleEngage}
          >
            {engageOpen ? 'Close engage' : 'Engage'}
          </button>
        </div>
      </div>

      {sections.length > 1 && (
        <div className="section-controls">
          <button
            className="section-controls-btn"
            onClick={() =>
              setCollapsed(allCollapsed ? new Set() : new Set(sections.map((s) => s.heading)))
            }
          >
            {allCollapsed ? 'Expand all' : 'Collapse all'}
          </button>
        </div>
      )}

      <div className="content-area">
        <div ref={contentRef} className="content-box content-rendered">
          {preamble && <ReactMarkdown remarkPlugins={[remarkGfm]}>{preamble}</ReactMarkdown>}
          {sections.length === 0 && !preamble && (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{bundle.generatedContent}</ReactMarkdown>
          )}
          {sections.map((section) => {
            const isCollapsed = collapsed.has(section.heading)
            return (
              <section key={section.heading} className="md-section">
                <h2
                  className={`md-section-heading${isCollapsed ? ' collapsed' : ''}`}
                  onClick={() => toggleSection(section.heading)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      toggleSection(section.heading)
                    }
                  }}
                >
                  <span className="md-section-chevron">{isCollapsed ? '▸' : '▾'}</span>
                  {section.heading}
                </h2>
                {!isCollapsed && (
                  <div className="md-section-body">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.body}</ReactMarkdown>
                  </div>
                )}
              </section>
            )
          })}
        </div>
      </div>

      <HighlightToolbar
        state={toolbar}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onClose={() => setToolbar(null)}
      />
    </div>
  )
}
