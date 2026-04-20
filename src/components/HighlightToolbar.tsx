'use client'

import { useEffect, useRef, useState } from 'react'
import type { Highlight } from './CoursePanel'

export type ToolbarState =
  | { mode: 'create'; anchorText: string; x: number; y: number }
  | { mode: 'edit'; highlight: Highlight; x: number; y: number }
  | null

interface Props {
  state: ToolbarState
  onCreate: (color: string, note: string | null) => void
  onUpdate: (id: string, patch: { color?: string; note?: string | null }) => void
  onDelete: (id: string) => void
  onClose: () => void
}

const COLORS = [
  { id: 'yellow', label: 'Yellow' },
  { id: 'red', label: 'Red' },
  { id: 'blue', label: 'Blue' },
  { id: 'green', label: 'Green' },
]

export default function HighlightToolbar({
  state,
  onCreate,
  onUpdate,
  onDelete,
  onClose,
}: Props) {
  const [note, setNote] = useState('')
  const [showNote, setShowNote] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (state?.mode === 'edit') {
      setNote(state.highlight.note ?? '')
      setShowNote(Boolean(state.highlight.note))
    } else {
      setNote('')
      setShowNote(false)
    }
  }, [state])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!state) return
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [state, onClose])

  if (!state) return null

  const isCreate = state.mode === 'create'
  const currentColor = state.mode === 'edit' ? state.highlight.color : null

  const positionStyle: React.CSSProperties = {
    position: 'fixed',
    left: state.x,
    top: state.y,
    transform: 'translate(-50%, -100%)',
    zIndex: 100,
  }

  return (
    <div ref={ref} className="hl-toolbar" style={positionStyle}>
      <div className="hl-toolbar-row">
        {COLORS.map((c) => (
          <button
            key={c.id}
            className={`hl-swatch hl-swatch-${c.id}${currentColor === c.id ? ' active' : ''}`}
            onClick={() => {
              if (isCreate) onCreate(c.id, note.trim() || null)
              else onUpdate(state.highlight.id, { color: c.id })
            }}
            title={c.label}
            aria-label={c.label}
          />
        ))}
        <div className="hl-toolbar-divider" />
        <button
          className="hl-toolbar-btn"
          onClick={() => setShowNote((v) => !v)}
          title={showNote ? 'Hide note' : 'Add note'}
          aria-label="Toggle note"
        >
          {showNote ? '−' : '+'} note
        </button>
        {state.mode === 'edit' && (
          <button
            className="hl-toolbar-btn hl-toolbar-delete"
            onClick={() => onDelete(state.highlight.id)}
            title="Delete highlight"
          >
            ×
          </button>
        )}
      </div>
      {showNote && (
        <div className="hl-toolbar-note">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note (visible on hover)…"
            autoFocus
          />
          {state.mode === 'edit' && (
            <button
              className="hl-toolbar-btn"
              onClick={() => onUpdate(state.highlight.id, { note: note.trim() || null })}
            >
              Save note
            </button>
          )}
          {state.mode === 'create' && (
            <button
              className="hl-toolbar-btn"
              onClick={() => onCreate('yellow', note.trim() || null)}
              title="Save with default color (yellow)"
            >
              Save with note
            </button>
          )}
        </div>
      )}
    </div>
  )
}
