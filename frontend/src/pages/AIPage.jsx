import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import AppNav from '../components/AppNav.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { sendAIMessage } from '../services/aiApi.js'

const SUGGESTED = [
  'What is my current net balance?',
  'Who owes me the most money?',
  'Summarize my recent expenses',
  'Which group has the highest unsettled amount?',
  'How much have I spent in total across all expenses?',
]

const SparkleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 2L13.09 8.26L19 9L13.09 9.74L12 16L10.91 9.74L5 9L10.91 8.26L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M5 17L5.87 20.13L9 21L5.87 21.87L5 25L4.13 21.87L1 21L4.13 20.13L5 17Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M19 3L19.65 5.35L22 6L19.65 6.65L19 9L18.35 6.65L16 6L18.35 5.35L19 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
  </svg>
)

const AIPage = () => {
  const { accessToken, refreshAccessToken, user } = useAuth()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const submit = async (text) => {
    const message = (text || input).trim()
    if (!message || loading) return

    const userMsg = { role: 'user', content: message }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setError('')

    try {
      const history = messages.slice(-6)
      const data = await sendAIMessage({ accessToken, refreshAccessToken }, message, history)
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }])
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again.')
      setMessages((prev) => prev.filter((m) => m !== userMsg))
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const isEmpty = messages.length === 0

  return (
    <section className="workspace-screen" style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      <AppNav />

      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 1rem 0' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>

          {isEmpty ? (
            <div style={{ paddingTop: '3rem', textAlign: 'center' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: '56px', height: '56px', borderRadius: '16px',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                marginBottom: '1.25rem', color: '#fff'
              }}>
                <SparkleIcon />
              </div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                AI Finance Assistant
              </h1>
              <p className="hint-text" style={{ marginBottom: '2rem', maxWidth: '420px', margin: '0 auto 2rem' }}>
                Ask anything about your balances, expenses, or friends. Your data stays private — it's sent only when you ask.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center', marginBottom: '2rem' }}>
                {SUGGESTED.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="ghost-btn"
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}
                    onClick={() => submit(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ paddingBottom: '1rem' }}>
              {messages.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    marginBottom: '1rem',
                  }}
                >
                  {msg.role === 'assistant' && (
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', marginRight: '0.6rem', marginTop: '2px',
                    }}>
                      <SparkleIcon />
                    </div>
                  )}
                  <div style={{
                    maxWidth: '80%',
                    padding: '0.7rem 1rem',
                    borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background: msg.role === 'user'
                      ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                      : 'rgba(255,255,255,0.07)',
                    color: msg.role === 'user' ? '#fff' : 'inherit',
                    fontSize: '0.9rem',
                    lineHeight: '1.6',
                    border: msg.role === 'assistant' ? '1px solid rgba(255,255,255,0.1)' : 'none',
                  }}>
                    {msg.role === 'assistant' ? (
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p style={{ margin: '0 0 0.5em' }}>{children}</p>,
                          strong: ({ children }) => <strong style={{ fontWeight: 700, color: 'rgba(255,255,255,0.95)' }}>{children}</strong>,
                          ul: ({ children }) => <ul style={{ margin: '0.25em 0 0.5em', paddingLeft: '1.25em' }}>{children}</ul>,
                          ol: ({ children }) => <ol style={{ margin: '0.25em 0 0.5em', paddingLeft: '1.25em' }}>{children}</ol>,
                          li: ({ children }) => <li style={{ marginBottom: '0.2em' }}>{children}</li>,
                          code: ({ children }) => <code style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '4px', padding: '0.1em 0.35em', fontSize: '0.85em' }}>{children}</code>,
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                  }}>
                    <SparkleIcon />
                  </div>
                  <div style={{
                    padding: '0.7rem 1rem', borderRadius: '16px 16px 16px 4px',
                    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
                    fontSize: '0.9rem', color: 'rgba(255,255,255,0.5)',
                  }}>
                    Thinking…
                  </div>
                </div>
              )}

              {error && <div className="error-banner" style={{ marginBottom: '1rem' }}>{error}</div>}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div style={{ padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)', background: 'var(--color-surface, #0f1117)' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', gap: '0.6rem', alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            rows={1}
            className="text-input"
            placeholder={`Ask about your finances, ${user?.name?.split(' ')[0] || 'there'}…`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            style={{ flex: 1, resize: 'none', lineHeight: '1.5', minHeight: '44px', maxHeight: '120px', overflowY: 'auto' }}
          />
          <button
            type="button"
            className="primary-btn"
            style={{ flexShrink: 0, height: '44px', padding: '0 1.25rem' }}
            onClick={() => submit()}
            disabled={loading || !input.trim()}
          >
            {loading ? '…' : 'Send'}
          </button>
        </div>
        {!isEmpty && (
          <p className="hint-text" style={{ textAlign: 'center', marginTop: '0.5rem', fontSize: '0.72rem' }}>
            Responses are based on your live Balance Studio data · Press Enter to send
          </p>
        )}
      </div>
    </section>
  )
}

export default AIPage
