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
  'How much have I spent in total?',
]

const SparkleIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 2L13.5 9.5L21 11L13.5 12.5L12 20L10.5 12.5L3 11L10.5 9.5L12 2Z"
      stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"
    />
    <path
      d="M5 16L5.75 18.75L8.5 19.5L5.75 20.25L5 23L4.25 20.25L1.5 19.5L4.25 18.75L5 16Z"
      stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"
    />
    <path
      d="M19 2L19.6 4.4L22 5L19.6 5.6L19 8L18.4 5.6L16 5L18.4 4.4L19 2Z"
      stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"
    />
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
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

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
    <section className="ai-screen">
      <AppNav />

      <div className="ai-body">
        <div className="ai-inner" style={isEmpty ? { display: 'flex', flexDirection: 'column', minHeight: '100%', justifyContent: 'center' } : undefined}>

          {isEmpty ? (
            <div className="ai-welcome" style={{ paddingTop: 0 }}>
              <div className="ai-welcome__icon">
                <SparkleIcon size={26} />
              </div>
              <h1>AI Finance Assistant</h1>
              <p className="ai-welcome__sub">
                Ask anything about your balances, expenses, or friends.
                Your live data is used as context — nothing is stored.
              </p>
              <div className="ai-chips">
                {SUGGESTED.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="ai-chip"
                    onClick={() => submit(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="ai-messages">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`ai-msg ai-msg--${msg.role === 'user' ? 'user' : 'ai'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="ai-avatar">
                      <SparkleIcon size={14} />
                    </div>
                  )}
                  <div className={`ai-bubble ai-bubble--${msg.role === 'user' ? 'user' : 'ai'}`}>
                    {msg.role === 'assistant' ? (
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="ai-thinking">
                  <div className="ai-avatar">
                    <SparkleIcon size={14} />
                  </div>
                  <div className="ai-thinking__bubble">
                    <span className="ai-dot" />
                    <span className="ai-dot" />
                    <span className="ai-dot" />
                  </div>
                </div>
              )}

              {error && (
                <div className="error-banner" style={{ marginBottom: '0.9rem' }}>
                  {error}
                </div>
              )}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      <div className="ai-footer">
        <div className="ai-composer">
          <textarea
            ref={inputRef}
            rows={1}
            className="text-input"
            placeholder={`Ask about your finances, ${user?.name?.split(' ')[0] || 'there'}…`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          <button
            type="button"
            className="ai-send-btn"
            onClick={() => submit()}
            disabled={loading || !input.trim()}
          >
            {loading ? '…' : 'Send'}
          </button>
        </div>
        {!isEmpty && (
          <p className="ai-footer__hint">
            Powered by your live Balance Studio data · Enter to send
          </p>
        )}
      </div>
    </section>
  )
}

export default AIPage
