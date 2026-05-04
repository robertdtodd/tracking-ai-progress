'use client'

import { useEffect, useRef, useState } from 'react'

export type BeatChatMessage = {
  id: string
  role: string
  content: string
  createdAt: string
}

interface Props {
  beatId: string
  beatLabel: string
  messages: BeatChatMessage[]
  onMessagesChange: (next: BeatChatMessage[]) => void
  onClose: () => void
}

export default function DiscussPanel({
  beatId,
  beatLabel,
  messages,
  onMessagesChange,
  onClose,
}: Props) {
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, beatId])

  useEffect(() => {
    inputRef.current?.focus()
  }, [beatId])

  async function handleSend() {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setSending(true)

    const optimisticUser: BeatChatMessage = {
      id: 'tmp-' + Date.now(),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    }
    const optimisticList = [...messages, optimisticUser]
    onMessagesChange(optimisticList)

    try {
      const res = await fetch(`/api/beats/${beatId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        onMessagesChange([
          ...optimisticList,
          {
            id: 'err-' + Date.now(),
            role: 'assistant',
            content: 'Error: ' + (err.error || res.statusText),
            createdAt: new Date().toISOString(),
          },
        ])
        return
      }

      const data = await res.json()
      onMessagesChange([
        ...optimisticList,
        {
          id: data.assistantId ?? 'asst-' + Date.now(),
          role: 'assistant',
          content: data.assistantMessage,
          createdAt: new Date().toISOString(),
        },
      ])
    } catch (e) {
      onMessagesChange([
        ...optimisticList,
        {
          id: 'err-' + Date.now(),
          role: 'assistant',
          content: 'Error: ' + (e as Error).message,
          createdAt: new Date().toISOString(),
        },
      ])
    } finally {
      setSending(false)
    }
  }

  async function handleDelete(messageId: string) {
    if (messageId.startsWith('tmp-') || messageId.startsWith('err-') || messageId.startsWith('asst-')) {
      onMessagesChange(messages.filter((m) => m.id !== messageId))
      return
    }
    const before = messages
    onMessagesChange(messages.filter((m) => m.id !== messageId))
    const res = await fetch(`/api/beat-messages/${messageId}`, { method: 'DELETE' })
    if (!res.ok) {
      onMessagesChange(before)
    }
  }

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: '#888', letterSpacing: 0.5 }}>DISCUSS</div>
          <div
            style={{
              fontSize: 13,
              color: '#1a1a1a',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={beatLabel}
          >
            {beatLabel}
          </div>
        </div>
        <button onClick={onClose} style={closeBtnStyle} title="Close (D or Esc)">
          ×
        </button>
      </div>

      <div style={messagesStyle}>
        {messages.length === 0 && (
          <div style={emptyStyle}>
            Ask a question about this slide. Answers reference the current beat and other beats in the session.
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              ...msgStyle,
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              background: m.role === 'user' ? '#7f77dd' : '#f5f5f5',
              color: m.role === 'user' ? '#fff' : '#1a1a1a',
              border: m.role === 'user' ? 'none' : '1px solid #e5e5e5',
            }}
          >
            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.content}</div>
            <button
              onClick={() => handleDelete(m.id)}
              style={{
                ...delBtnStyle,
                color: m.role === 'user' ? 'rgba(255,255,255,0.7)' : '#999',
              }}
              title="Delete message"
            >
              ×
            </button>
          </div>
        ))}
        {sending && (
          <div style={{ ...msgStyle, alignSelf: 'flex-start', background: '#f5f5f5', color: '#666', border: '1px solid #e5e5e5', fontStyle: 'italic' }}>
            Thinking…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div style={inputAreaStyle}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder="Ask about this slide… (⌘/Ctrl+Enter to send)"
          rows={3}
          style={textareaStyle}
        />
        <button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          style={{
            ...sendBtnStyle,
            opacity: sending || !input.trim() ? 0.5 : 1,
            cursor: sending || !input.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  )
}

const panelStyle: React.CSSProperties = {
  width: 420,
  flex: '0 0 420px',
  display: 'flex',
  flexDirection: 'column',
  borderLeft: '1px solid #e5e5e5',
  background: '#fafafa',
  minHeight: 0,
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '12px 16px',
  borderBottom: '1px solid #e5e5e5',
  background: '#fff',
}

const closeBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid #e5e5e5',
  borderRadius: 6,
  width: 28,
  height: 28,
  fontSize: 18,
  lineHeight: 1,
  color: '#666',
  cursor: 'pointer',
}

const messagesStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  padding: 16,
  overflowY: 'auto',
  minHeight: 0,
}

const emptyStyle: React.CSSProperties = {
  color: '#888',
  fontSize: 13,
  fontStyle: 'italic',
  padding: '8px 4px',
  lineHeight: 1.5,
}

const msgStyle: React.CSSProperties = {
  position: 'relative',
  maxWidth: '90%',
  padding: '8px 30px 8px 12px',
  borderRadius: 10,
  fontSize: 14,
  lineHeight: 1.45,
}

const delBtnStyle: React.CSSProperties = {
  position: 'absolute',
  top: 4,
  right: 6,
  background: 'transparent',
  border: 'none',
  fontSize: 14,
  cursor: 'pointer',
  lineHeight: 1,
  padding: 2,
}

const inputAreaStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 12,
  borderTop: '1px solid #e5e5e5',
  background: '#fff',
}

const textareaStyle: React.CSSProperties = {
  width: '100%',
  resize: 'none',
  padding: 8,
  fontSize: 14,
  fontFamily: 'inherit',
  border: '1px solid #ddd',
  borderRadius: 6,
  background: '#fff',
  color: '#1a1a1a',
  outline: 'none',
  boxSizing: 'border-box',
}

const sendBtnStyle: React.CSSProperties = {
  alignSelf: 'flex-end',
  padding: '6px 14px',
  fontSize: 13,
  background: '#7f77dd',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontWeight: 500,
}
