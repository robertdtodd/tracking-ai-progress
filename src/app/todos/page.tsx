'use client'

import { useEffect, useRef, useState } from 'react'

type Todo = { id: string; text: string; done: boolean }

export default function TodosPage() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/todos')
      .then((r) => r.json())
      .then((data) => { setTodos(data); setLoading(false) })
  }, [])

  async function addTodo(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return
    const res = await fetch('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: input }),
    })
    const todo = await res.json()
    setTodos((prev) => [...prev, todo])
    setInput('')
    inputRef.current?.focus()
  }

  async function toggleDone(id: string, done: boolean) {
    const res = await fetch(`/api/todos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: !done }),
    })
    const updated = await res.json()
    setTodos((prev) => prev.map((t) => (t.id === id ? updated : t)))
  }

  async function deleteTodo(id: string) {
    await fetch(`/api/todos/${id}`, { method: 'DELETE' })
    setTodos((prev) => prev.filter((t) => t.id !== id))
  }

  function startEdit(todo: Todo) {
    setEditingId(todo.id)
    setEditText(todo.text)
  }

  async function saveEdit(id: string) {
    if (!editText.trim()) return
    const res = await fetch(`/api/todos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: editText.trim() }),
    })
    const updated = await res.json()
    setTodos((prev) => prev.map((t) => (t.id === id ? updated : t)))
    setEditingId(null)
  }

  const remaining = todos.filter((t) => !t.done).length

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-tertiary)', padding: '40px 16px' }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>
          To-do list
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 24, marginTop: 0, fontSize: 13 }}>
          {loading ? 'Loading…' : `${remaining} item${remaining !== 1 ? 's' : ''} remaining`}
        </p>

        <form onSubmit={addTodo} style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Add a new task…"
            style={{
              flex: 1,
              padding: '8px 12px',
              border: '0.5px solid var(--border-2)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: 14,
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          <button type="submit" className="primary" disabled={!input.trim()}>
            Add
          </button>
        </form>

        {!loading && todos.length === 0 && (
          <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 40 }}>
            No tasks yet. Add one above.
          </p>
        )}

        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {todos.map((todo) => (
            <li
              key={todo.id}
              style={{
                background: 'var(--bg-primary)',
                border: '0.5px solid var(--border-1)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <input
                type="checkbox"
                checked={todo.done}
                onChange={() => toggleDone(todo.id, todo.done)}
                style={{ cursor: 'pointer', width: 16, height: 16, flexShrink: 0 }}
              />

              {editingId === todo.id ? (
                <form
                  onSubmit={(e) => { e.preventDefault(); saveEdit(todo.id) }}
                  style={{ flex: 1, display: 'flex', gap: 8 }}
                >
                  <input
                    autoFocus
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={() => saveEdit(todo.id)}
                    onKeyDown={(e) => e.key === 'Escape' && setEditingId(null)}
                    style={{
                      flex: 1,
                      padding: '2px 6px',
                      border: '0.5px solid var(--border-2)',
                      borderRadius: 6,
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: 14,
                      fontFamily: 'inherit',
                    }}
                  />
                </form>
              ) : (
                <span
                  onDoubleClick={() => startEdit(todo)}
                  style={{
                    flex: 1,
                    fontSize: 14,
                    color: todo.done ? 'var(--text-tertiary)' : 'var(--text-primary)',
                    textDecoration: todo.done ? 'line-through' : 'none',
                    cursor: 'text',
                  }}
                >
                  {todo.text}
                </span>
              )}

              <button
                onClick={() => deleteTodo(todo.id)}
                style={{
                  padding: '2px 8px',
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  border: '0.5px solid var(--border-1)',
                  borderRadius: 6,
                  background: 'transparent',
                }}
                title="Delete"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
