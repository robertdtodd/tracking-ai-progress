'use client'

import { useEffect, useRef, useState } from 'react'
import type { Bundle, Message } from './CoursePanel'

type Tab = 'refine' | 'discuss' | 'edit'

interface Props {
  bundle: Bundle
  onUpdated: (b: Bundle) => void
  onClose: () => void
}

export default function EngagePanel({ bundle, onUpdated, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>(bundle.messages)
  const [content, setContent] = useState(bundle.generatedContent)
  const [isDirty, setIsDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [tab, setTab] = useState<Tab>('refine')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMessages(bundle.messages)
    setContent(bundle.generatedContent)
    setIsDirty(false)
  }, [bundle.id, bundle.messages])

  useEffect(() => {
    setContent(bundle.generatedContent)
    setIsDirty(false)
  }, [bundle.generatedContent])

  const chatMode: 'refine' | 'discuss' = tab === 'discuss' ? 'discuss' : 'refine'
  const visibleMessages = messages.filter((m) => (m.mode ?? 'refine') === chatMode)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [visibleMessages.length, tab])

  async function handleSaveContent() {
    setSaving(true)
    try {
      const res = await fetch(`/api/bundles/${bundle.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generatedContent: content }),
      })
      if (res.ok) {
        setIsDirty(false)
        onUpdated({ ...bundle, generatedContent: content })
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setSending(true)

    const optimisticUser: Message = {
      id: 'tmp-' + Date.now(),
      role: 'user',
      content: text,
      mode: chatMode,
      createdAt: new Date().toISOString(),
    }
    setMessages((m) => [...m, optimisticUser])

    try {
      const res = await fetch(`/api/bundles/${bundle.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, mode: chatMode }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setMessages((m) => [
          ...m,
          {
            id: 'err-' + Date.now(),
            role: 'assistant',
            content: 'Error: ' + (err.error || res.statusText),
            mode: chatMode,
            createdAt: new Date().toISOString(),
          },
        ])
        return
      }

      const data = await res.json()

      const newMessages: Message[] = [
        optimisticUser,
        {
          id: 'asst-' + Date.now(),
          role: 'assistant',
          content: data.assistantMessage,
          mode: chatMode,
          createdAt: new Date().toISOString(),
        },
      ]

      setMessages((m) => {
        const withoutOptimistic = m.filter((x) => x.id !== optimisticUser.id)
        return [...withoutOptimistic, ...newMessages]
      })

      if (chatMode === 'refine' && typeof data.updatedContent === 'string') {
        setContent(data.updatedContent)
        setIsDirty(false)
        onUpdated({
          ...bundle,
          generatedContent: data.updatedContent,
          messages: [...bundle.messages, ...newMessages],
        })
      } else {
        onUpdated({
          ...bundle,
          messages: [...bundle.messages, ...newMessages],
        })
      }
    } finally {
      setSending(false)
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  async function handleDeleteMessage(m: Message) {
    setMessages((prev) => prev.filter((x) => x.id !== m.id))
    onUpdated({
      ...bundle,
      messages: bundle.messages.filter((x) => x.id !== m.id),
    })
    if (m.id.startsWith('tmp-') || m.id.startsWith('asst-') || m.id.startsWith('err-')) {
      return
    }
    try {
      await fetch(`/api/messages/${m.id}`, { method: 'DELETE' })
    } catch {
      // already removed from UI optimistically; a refetch would restore if deletion failed
    }
  }

  return (
    <aside className="engage-panel">
      <div className="engage-header">
        <div className="engage-tabs">
          <button
            className={`engage-tab${tab === 'refine' ? ' active' : ''}`}
            onClick={() => setTab('refine')}
            disabled={sending}
          >
            Refine
            <span className="engage-tab-hint">edits content</span>
          </button>
          <button
            className={`engage-tab${tab === 'discuss' ? ' active' : ''}`}
            onClick={() => setTab('discuss')}
            disabled={sending}
          >
            Discuss
            <span className="engage-tab-hint">no edits</span>
          </button>
          <button
            className={`engage-tab${tab === 'edit' ? ' active' : ''}`}
            onClick={() => setTab('edit')}
            disabled={sending}
          >
            Edit source
            <span className="engage-tab-hint">raw markdown</span>
          </button>
        </div>
        <button
          className="engage-close"
          onClick={onClose}
          title="Close engage panel"
          aria-label="Close engage panel"
        >
          ×
        </button>
      </div>

      {tab === 'edit' ? (
        <div className="engage-edit">
          <textarea
            className="engage-edit-area"
            value={content}
            onChange={(e) => {
              setContent(e.target.value)
              setIsDirty(true)
            }}
          />
          <div className="engage-edit-bar">
            {isDirty ? (
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Unsaved changes</span>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Raw markdown source</span>
            )}
            <button
              className="primary"
              style={{ fontSize: 12, padding: '4px 12px' }}
              onClick={handleSaveContent}
              disabled={saving || !isDirty}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className={`chat-messages chat-messages-${tab}`}>
            {visibleMessages.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: 12, textAlign: 'center', padding: '12px 8px' }}>
                {tab === 'refine'
                  ? 'Ask Claude to refine this content. Try: "Tighten the intro", "Add more on cybersecurity", or "Turn the questions into a worksheet".'
                  : 'Discuss this theme with Claude — nothing you ask here will change the content. Try: "What other angles are worth discussing?", or paste a question from the class chat.'}
              </div>
            ) : (
              visibleMessages.map((m) => (
                <div key={m.id} className={`chat-msg ${m.role}`}>
                  <span className="chat-msg-content">{m.content}</span>
                  {tab === 'discuss' && (
                    <button
                      className="chat-msg-delete"
                      onClick={() => handleDeleteMessage(m)}
                      title="Remove this message"
                      aria-label="Remove message"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))
            )}
            {sending && (
              <div className="chat-msg assistant">
                <span className="spinner" /> Thinking…
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="chat-input">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={
                tab === 'refine'
                  ? 'Ask Claude to revise the content…'
                  : 'Ask Claude a question (content stays unchanged)…'
              }
              disabled={sending}
            />
            <button
              className="primary"
              onClick={handleSend}
              disabled={sending || !input.trim()}
            >
              Send
            </button>
          </div>
        </>
      )}
    </aside>
  )
}
