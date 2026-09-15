import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { apiFetch, auth } from '../lib/api'
import { Spinner } from '../components/UI'
import UserAvatar from '../components/UserAvatar'
import { ArrowLeft, Send } from 'lucide-react'

export default function ChatPage() {
  const { userId: otherUserId } = useParams()
  const navigate = useNavigate()
  const [messages, setMessages] = useState([])
  const [partner, setPartner] = useState(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const currentUserId = auth.getUserId()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    Promise.all([
      apiFetch(`/api/conversations/${otherUserId}`),
      apiFetch(`/api/roommates/${otherUserId}`)
    ]).then(([convo, profile]) => {
      setMessages(convo)
      setPartner(profile)
      setLoading(false)
      apiFetch(`/api/conversations/${otherUserId}/read`, { method: 'POST' })
    }).catch(() => {
      setLoading(false)
    })
  }, [otherUserId])

  useEffect(() => {
    const interval = setInterval(() => {
      apiFetch(`/api/conversations/${otherUserId}`)
        .then(setMessages)
        .catch(() => {})
    }, 3000)
    return () => clearInterval(interval)
  }, [otherUserId])

  const handleSend = async () => {
    const text = input.trim()
    if (!text) return

    const optimistic = {
      id: Date.now(),
      sender_id: currentUserId,
      content: text,
      read_at: null,
      created_at: new Date().toISOString(),
      sender_name: 'You'
    }

    setMessages(prev => [...prev, optimistic])
    setInput('')
    setSending(true)

    try {
      await apiFetch('/api/messages', {
        method: 'POST',
        body: { receiver_id: Number(otherUserId), message: text }
      })
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const formatTime = (ts) => {
    const d = new Date(ts)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full surface-bg">
          <Spinner />
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="flex flex-col h-full surface-bg" style={{ height: '100dvh' }}>
        <header className="flex items-center gap-3 p-3 border-b surface-border surface-card">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={20} className="text-primary" />
          </button>
          {partner && (
            <>
              <UserAvatar user={partner} size={40} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-primary truncate">
                  {partner.name || partner.first_name}
                </p>
                <p className="text-xs text-teal-500">Online</p>
              </div>
            </>
          )}
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg) => {
            const isSender = msg.sender_id === currentUserId
            return (
              <div
                key={msg.id}
                className={`flex ${isSender ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] px-4 py-2 rounded-2xl ${
                    isSender
                      ? 'bg-brand-coral text-white rounded-br-md'
                      : 'surface-muted text-primary rounded-bl-md'
                  }`}
                >
                  <p className="break-words">{msg.content}</p>
                  <p
                    className={`text-[10px] mt-1 ${
                      isSender ? 'text-white/70' : 'text-gray-400'
                    }`}
                  >
                    {formatTime(msg.created_at)}
                  </p>
                </div>
              </div>
            )
          })}
          <div ref={messagesEndRef} />
        </div>

        <div className="flex items-center gap-2 p-3 border-t surface-border surface-card">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 rounded-full border surface-border bg-white text-primary focus:outline-none focus:ring-2 focus:ring-brand-teal"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="p-3 rounded-full bg-brand-coral text-white disabled:opacity-50 transition-opacity"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </Layout>
  )
}
