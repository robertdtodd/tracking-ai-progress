'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Props =
  | { mode: 'create'; initialId?: undefined; initialName?: undefined; initialBody?: undefined }
  | { mode: 'edit'; initialId: string; initialName: string; initialBody: string }

export default function StyleEditor(props: Props) {
  const router = useRouter()
  const [name, setName] = useState(props.initialName ?? '')
  const [body, setBody] = useState(props.initialBody ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dirty = props.mode === 'create'
    ? name.trim() || body.trim()
    : name !== props.initialName || body !== props.initialBody

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !body.trim() || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      if (props.mode === 'create') {
        const res = await fetch('/api/styles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), body }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || res.statusText)
        }
        const data = await res.json()
        router.push(`/styles/${data.id}`)
      } else {
        const res = await fetch(`/api/styles/${props.initialId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), body }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || res.statusText)
        }
        router.refresh()
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (props.mode !== 'edit') return
    if (!confirm(`Delete style "${props.initialName}"? Sessions using it will fall back to no style.`)) return
    const res = await fetch(`/api/styles/${props.initialId}`, { method: 'DELETE' })
    if (res.ok) router.push('/styles')
    else {
      const err = await res.json().catch(() => ({}))
      alert('Delete failed: ' + (err.error || res.statusText))
    }
  }

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px 80px' }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/styles" style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none' }}>
          ← Styles
        </Link>
        <h1 style={{ margin: '8px 0 0 0', fontSize: 22, fontWeight: 600 }}>
          {props.mode === 'create' ? 'New style' : 'Edit style'}
        </h1>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={labelStyle}>Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Editorial — newspaper"
            style={inputStyle}
            autoFocus
          />
        </div>

        <div>
          <label style={labelStyle}>
            Style guide
            <span style={{ marginLeft: 8, fontWeight: 400, color: 'var(--text-tertiary)' }}>
              palette, typography, layout, mood — free-form
            </span>
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={20}
            style={textareaStyle}
            placeholder={`Editorial print style, inspired by the Financial Times.

Palette:
- Background: warm cream #faf6ed
- Primary ink: near-black #1a1a1a
- Accent (data, highlights): terracotta #c45e3e

Typography:
- Headlines: large serif, tight letter-spacing
- Body: sans-serif, comfortable line height

Layout: single big idea per slide, generous padding.
Avoid: drop shadows, rounded boxes, illustrative icons.`}
          />
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

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="submit"
            disabled={!name.trim() || !body.trim() || !dirty || submitting}
            style={{
              fontSize: 14,
              fontWeight: 500,
              padding: '10px 20px',
              background: '#7f77dd',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: submitting ? 'wait' : 'pointer',
              opacity: !name.trim() || !body.trim() || !dirty || submitting ? 0.5 : 1,
            }}
          >
            {submitting ? 'Saving…' : props.mode === 'create' ? 'Create style' : 'Save changes'}
          </button>
          <Link
            href="/styles"
            style={{
              fontSize: 14,
              padding: '10px 16px',
              color: 'var(--text-secondary)',
              textDecoration: 'none',
            }}
          >
            Cancel
          </Link>
          <div style={{ flex: 1 }} />
          {props.mode === 'edit' && (
            <button
              type="button"
              onClick={handleDelete}
              style={{
                fontSize: 13,
                color: '#c0392b',
                background: 'transparent',
                border: '1px solid rgba(192, 57, 43, 0.3)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 14px',
                cursor: 'pointer',
              }}
            >
              Delete
            </button>
          )}
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

const textareaStyle: React.CSSProperties = {
  width: '100%',
  padding: 12,
  fontSize: 13,
  lineHeight: 1.5,
  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
  border: '1px solid var(--border-1)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  resize: 'vertical',
  boxSizing: 'border-box',
}
