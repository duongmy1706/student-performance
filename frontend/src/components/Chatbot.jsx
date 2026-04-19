import { useState, useRef, useEffect, useCallback } from 'react'
import axios from 'axios'

const SUGGESTED_QUESTIONS = [
  'Có bao nhiêu học sinh nguy cơ cao?',
  'Yếu tố nào ảnh hưởng nhiều nhất đến kết quả?',
  'Phương pháp học nào hiệu quả nhất?',
  'Làm thế nào để cải thiện chuyên cần?',
  'Độ chính xác mô hình ML là bao nhiêu?',
  'Lời khuyên cho học sinh học yếu?',
]

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="w-2 h-2 rounded-full bg-blue-400"
          style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
        />
      ))}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
          40% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

function MessageContent({ content }) {
  const lines = content.split('\n')
  return (
    <div className="text-sm leading-relaxed space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith('### ')) return <h4 key={i} className="font-bold text-gray-800 mt-2">{line.slice(4)}</h4>
        if (line.startsWith('## ')) return <h3 key={i} className="font-bold text-gray-900 mt-2 text-base">{line.slice(3)}</h3>
        if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-semibold">{line.slice(2, -2)}</p>
        if (line.startsWith('- ') || line.startsWith('• ')) {
          return (
            <div key={i} className="flex items-start gap-1.5">
              <span className="text-blue-500 mt-0.5 flex-shrink-0">•</span>
              <span>{line.slice(2)}</span>
            </div>
          )
        }
        if (/^\d+\. /.test(line)) {
          const num = line.match(/^(\d+)\. /)[1]
          return (
            <div key={i} className="flex items-start gap-1.5">
              <span className="text-blue-500 font-semibold flex-shrink-0 w-4">{num}.</span>
              <span>{line.replace(/^\d+\. /, '')}</span>
            </div>
          )
        }
        if (line.trim() === '') return <div key={i} className="h-1" />
        const parts = line.split(/(\*\*[^*]+\*\*)/g)
        if (parts.length > 1) {
          return (
            <p key={i}>
              {parts.map((p, j) =>
                p.startsWith('**') && p.endsWith('**')
                  ? <strong key={j}>{p.slice(2, -2)}</strong>
                  : p
              )}
            </p>
          )
        }
        return <p key={i}>{line}</p>
      })}
    </div>
  )
}

export default function Chatbot({ dataLoaded }) {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: dataLoaded
        ? '👋 Xin chào! Tôi là trợ lý AI của hệ thống phân tích học sinh.\n\nTôi có thể trả lời mọi câu hỏi về:\n- 📊 Dữ liệu học sinh trong hệ thống\n- 🤖 Kết quả mô hình Machine Learning\n- 📚 Lời khuyên giáo dục và học tập\n- 🌐 Bất kỳ chủ đề nào khác\n\nBạn muốn hỏi gì?'
        : '👋 Xin chào! Tôi là trợ lý AI. Hãy upload dữ liệu học sinh để tôi có thể phân tích và trả lời câu hỏi về dataset của bạn. Tôi cũng có thể trả lời các câu hỏi tổng quát về giáo dục và Machine Learning!',
      id: 0
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamContent, setStreamContent] = useState('')
  const [ollamaStatus, setOllamaStatus] = useState(null)
  const [selectedModel, setSelectedModel] = useState('llama3.2')
  const [availableModels, setAvailableModels] = useState([])
  const [showModels, setShowModels] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => { scrollToBottom() }, [messages, streamContent])

  useEffect(() => {
    if (open) {
      checkOllama()
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  const checkOllama = async () => {
    try {
      const res = await axios.get('/api/chat/models')
      setOllamaStatus(res.data.available)
      if (res.data.models?.length > 0) {
        setAvailableModels(res.data.models)
        if (!res.data.models.includes(selectedModel) && res.data.models.length > 0) {
          setSelectedModel(res.data.models[0])
        }
      }
    } catch {
      setOllamaStatus(false)
    }
  }

  const sendMessage = useCallback(async (text) => {
    const userText = (text || input).trim()
    if (!userText || loading) return

    const userMsg = { role: 'user', content: userText, id: Date.now() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    setStreamContent('')

    const historyForAPI = newMessages.map(m => ({ role: m.role, content: m.content }))

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: historyForAPI, model: selectedModel })
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: 'Lỗi không xác định' }))
        throw new Error(err.detail || `HTTP ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''
      let errorMsg = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text2 = decoder.decode(value)
        const lines = text2.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.error) { errorMsg = data.error; break }
              fullContent += data.token
              setStreamContent(fullContent)
              if (data.done) break
            } catch {}
          }
        }
        if (errorMsg) break
      }

      const assistantMsg = {
        role: 'assistant',
        content: errorMsg || fullContent || 'Xin lỗi, không có phản hồi.',
        id: Date.now() + 1,
        isError: !!errorMsg
      }
      setMessages(prev => [...prev, assistantMsg])
      setStreamContent('')
    } catch (e) {
      const errContent = e.message?.includes('503') || e.message?.includes('Ollama')
        ? '⚠️ **Ollama chưa chạy!**\n\nHãy làm theo các bước:\n1. Tải Ollama tại ollama.com\n2. Chạy lệnh: `ollama serve`\n3. Pull model: `ollama pull llama3.2`\n4. Thử lại!'
        : `❌ Lỗi: ${e.message}`
      setMessages(prev => [...prev, { role: 'assistant', content: errContent, id: Date.now() + 1, isError: true }])
      setStreamContent('')
    }
    setLoading(false)
  }, [input, messages, loading, selectedModel])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearChat = () => {
    setMessages([{ role: 'assistant', content: '🔄 Cuộc hội thoại mới bắt đầu! Tôi có thể giúp gì cho bạn?', id: Date.now() }])
  }

  const chatWidth = expanded ? 520 : 380
  const chatHeight = expanded ? 640 : 500

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl shadow-2xl transition-all duration-200 hover:scale-105 active:scale-95"
          style={{ boxShadow: '0 8px 32px rgba(59,130,246,0.4)' }}
        >
          <span className="text-xl">🤖</span>
          <span className="font-semibold text-sm">AI Assistant</span>
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
        </button>
      )}

      {/* Chat window */}
      {open && (
        <div
          className="fixed bottom-6 right-6 z-50 flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200 transition-all duration-300"
          style={{ width: chatWidth, height: chatHeight, boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-700 flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🤖</span>
              <div>
                <div className="text-white font-bold text-sm leading-tight">AI Student Assistant</div>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${ollamaStatus === true ? 'bg-green-400' : ollamaStatus === false ? 'bg-red-400' : 'bg-yellow-400'} animate-pulse`} />
                  <span className="text-blue-200 text-xs">
                    {ollamaStatus === true ? `Ollama • ${selectedModel}` : ollamaStatus === false ? 'Ollama offline' : 'Đang kiểm tra...'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* Model selector */}
              {availableModels.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setShowModels(!showModels)}
                    className="p-1.5 text-blue-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-xs"
                    title="Chọn model"
                  >
                    ⚙️
                  </button>
                  {showModels && (
                    <div className="absolute right-0 bottom-8 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-10 min-w-40">
                      <div className="px-3 py-2 text-xs text-gray-500 font-semibold border-b border-gray-100">Chọn Model</div>
                      {availableModels.map(m => (
                        <button
                          key={m}
                          onClick={() => { setSelectedModel(m); setShowModels(false) }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors ${m === selectedModel ? 'text-blue-600 font-semibold bg-blue-50' : 'text-gray-700'}`}
                        >
                          {m === selectedModel && '✓ '}{m}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {/* Clear */}
              <button
                onClick={clearChat}
                className="p-1.5 text-blue-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-xs"
                title="Xóa hội thoại"
              >
                🗑️
              </button>
              {/* Expand/collapse */}
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-1.5 text-blue-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title={expanded ? 'Thu nhỏ' : 'Phóng to'}
              >
                {expanded ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4M4 12l4-4M4 12l4 4M20 12l-4-4M20 12l-4 4" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5h-4m4 0v-4m0 4l-5-5" />
                  </svg>
                )}
              </button>
              {/* Close */}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 text-blue-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Ollama offline warning */}
          {ollamaStatus === false && (
            <div className="px-4 py-2 bg-red-50 border-b border-red-100 flex-shrink-0">
              <p className="text-xs text-red-600 font-medium">
                ⚠️ Ollama chưa chạy — Hãy chạy <code className="bg-red-100 px-1 rounded">ollama serve</code> và <code className="bg-red-100 px-1 rounded">ollama pull llama3.2</code>
              </p>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gray-50">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-sm"
                  style={{ background: msg.role === 'user' ? '#3b82f6' : '#f1f5f9' }}>
                  {msg.role === 'user' ? '👤' : '🤖'}
                </div>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-sm'
                      : msg.isError
                      ? 'bg-red-50 text-gray-800 border border-red-200 rounded-tl-sm'
                      : 'bg-white text-gray-800 border border-gray-100 rounded-tl-sm'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <p className="text-sm">{msg.content}</p>
                  ) : (
                    <MessageContent content={msg.content} />
                  )}
                </div>
              </div>
            ))}

            {/* Streaming message */}
            {(loading || streamContent) && (
              <div className="flex gap-2.5">
                <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-sm">🤖</div>
                <div className="max-w-[85%] bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-gray-100">
                  {streamContent ? (
                    <div>
                      <MessageContent content={streamContent} />
                      <span className="inline-block w-1 h-4 bg-blue-500 ml-0.5 animate-pulse rounded-sm" />
                    </div>
                  ) : (
                    <TypingDots />
                  )}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested questions */}
          {messages.length <= 1 && !loading && (
            <div className="px-4 py-2 bg-white border-t border-gray-100 flex-shrink-0">
              <p className="text-xs text-gray-400 mb-2 font-medium">Câu hỏi gợi ý:</p>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_QUESTIONS.slice(0, expanded ? 6 : 3).map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="text-xs px-2.5 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors border border-blue-100 font-medium"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input area */}
          <div className="px-4 py-3 bg-white border-t border-gray-200 flex-shrink-0">
            <div className="flex gap-2 items-end">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Nhập câu hỏi... (Enter để gửi, Shift+Enter xuống dòng)"
                  rows={1}
                  disabled={loading}
                  className="w-full resize-none px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-all placeholder-gray-400 disabled:opacity-60"
                  style={{ maxHeight: 100, minHeight: 42 }}
                  onInput={e => {
                    e.target.style.height = 'auto'
                    e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'
                  }}
                />
              </div>
              <button
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                className="flex-shrink-0 w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-sm"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5 text-center">
              Powered by Ollama • Mọi cuộc trò chuyện được lưu trong phiên
            </p>
          </div>
        </div>
      )}
    </>
  )
}
