import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Markdown from 'react-markdown'

interface ToolCall {
  tool: string
  input?: any
  result?: string
  status: 'running' | 'done'
}

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  toolCalls?: ToolCall[]
  metadata?: any
}

interface Slide {
  index: number
  templateId: string
  content: Record<string, any>
}

export default function CreateSession() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [messages, setMessages] = useState<Message[]>([])
  const [slides, setSlides] = useState<Slide[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [composing, setComposing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Load existing messages and slides
    fetch(`/api/projects/${id}/messages`).then(r => r.json()).then(setMessages).catch(() => {})
    fetch(`/api/projects/${id}/slides`).then(r => r.json()).then(setSlides).catch(() => {})
  }, [id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendingRef = useRef(false)
  async function sendMessage() {
    if (!input.trim() || sending || sendingRef.current) return
    sendingRef.current = true
    const text = input.trim()
    setInput('')
    setSending(true)

    // Optimistic add user message
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])

    try {
      const res = await fetch(`/api/projects/${id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No stream')

      const decoder = new TextDecoder()
      let assistantContent = ''
      let toolCalls: ToolCall[] = []
      const assistantMsg: Message = { id: crypto.randomUUID(), role: 'assistant', content: '', toolCalls: [] }
      setMessages(prev => [...prev, assistantMsg])

      const updateMsg = (updates: Partial<Message>) => {
        setMessages(prev => prev.map(m =>
          m.id === assistantMsg.id ? { ...m, ...updates } : m
        ))
      }

      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        const events = buffer.split('\n\n')
        buffer = events.pop() || ''

        for (const event of events) {
          const dataLine = event.split('\n').find(l => l.startsWith('data:'))
          if (!dataLine) continue

          try {
            const data = JSON.parse(dataLine.slice(5).trim())
            if (data.type === 'text') {
              let content = data.content
              // Guard: if content is still raw JSON with action field, extract message
              if (typeof content === 'string' && content.trimStart().startsWith('{') && content.includes('"action"')) {
                try {
                  const inner = JSON.parse(content)
                  if (inner.message) content = inner.message
                } catch {}
              }
              assistantContent = content
              updateMsg({ content: assistantContent, toolCalls: [...toolCalls] })
            } else if (data.type === 'slides_update') {
              setSlides(data.slides)
            } else if (data.type === 'progress') {
              switch (data.stage) {
                case 'thinking':
                  updateMsg({ content: '思考中...' })
                  break
                case 'tool_call':
                  toolCalls = [...toolCalls, { tool: data.tool, input: data.input, status: 'running' }]
                  updateMsg({ content: '', toolCalls: [...toolCalls] })
                  break
                case 'tool_result':
                  toolCalls = toolCalls.map((tc, i) =>
                    i === toolCalls.length - 1 ? { ...tc, result: data.result, status: 'done' as const } : tc
                  )
                  updateMsg({ toolCalls: [...toolCalls] })
                  break
                case 'generating':
                  updateMsg({ content: `⚡ 开始并行生成 ${data.total} 页...` })
                  break
                case 'slide_done':
                  updateMsg({ content: `✓ 第 ${(data.slideIndex ?? 0) + 1} 页: ${data.title ?? ''}` })
                  break
              }
            }
          } catch {}
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        const remainingEvents = buffer.split('\n\n')
        for (const event of remainingEvents) {
          const dataLine = event.split('\n').find(l => l.startsWith('data:'))
          if (!dataLine) continue
          try {
            const data = JSON.parse(dataLine.slice(5).trim())
            if (data.type === 'text') {
              let content = data.content
              if (typeof content === 'string' && content.trimStart().startsWith('{') && content.includes('"action"')) {
                try { content = JSON.parse(content).message ?? content } catch {}
              }
              assistantContent = content
              updateMsg({ content: assistantContent, toolCalls: [...toolCalls] })
            } else if (data.type === 'slides_update') {
              setSlides(data.slides)
            }
          } catch {}
        }
      }
    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `出错了: ${err.message}`,
      }])
    } finally {
      setSending(false)
      sendingRef.current = false
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey && !composing) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="h-screen flex bg-slate-900">
      {/* Left: Chat */}
      <div className="w-[480px] flex flex-col border-r border-slate-700">
        {/* Header */}
        <div className="h-14 flex items-center px-4 border-b border-slate-700 gap-3">
          <button onClick={() => navigate('/')} className="text-slate-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-sm font-medium text-white truncate">PPT 制作</h2>
          {slides.length > 0 && (
            <button
              onClick={() => navigate(`/editor/${id}`)}
              className="ml-auto text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-md"
            >
              编辑器
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-slate-500 py-10">
              <p className="text-lg mb-2">描述你想要的 PPT</p>
              <p className="text-sm">例如："帮我做一个 AI 产品介绍，6页，中文"</p>
            </div>
          )}
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-200 border border-slate-700'
              }`}>
                {msg.role === 'user' ? (
                  msg.content
                ) : (
                  <div>
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div className="mb-2 space-y-1">
                        {msg.toolCalls.map((tc, i) => (
                          <ToolCallBlock key={i} toolCall={tc} />
                        ))}
                      </div>
                    )}
                    {msg.content && (
                      <div className="prose prose-sm prose-invert prose-p:my-1 prose-li:my-0.5 prose-ul:my-1 prose-ol:my-1 prose-headings:my-2 prose-headings:text-slate-100 max-w-none">
                        <Markdown>{msg.content}</Markdown>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-slate-700">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onCompositionStart={() => setComposing(true)}
              onCompositionEnd={() => setComposing(false)}
              placeholder="描述你的需求..."
              rows={2}
              className="flex-1 resize-none bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={sendMessage}
              disabled={sending || !input.trim()}
              className="self-end px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium"
            >
              {sending ? '...' : '发送'}
            </button>
          </div>
        </div>
      </div>

      {/* Right: Canvas Preview */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="h-14 flex items-center px-6 border-b border-slate-700 gap-4">
          <span className="text-sm text-slate-400">
            {slides.length > 0 ? `${currentSlide + 1} / ${slides.length}` : '等待生成...'}
          </span>
          <div className="flex gap-1 ml-auto">
            <button
              onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
              disabled={currentSlide === 0}
              className="p-1.5 rounded hover:bg-slate-700 disabled:opacity-30 text-slate-400"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))}
              disabled={currentSlide >= slides.length - 1}
              className="p-1.5 rounded hover:bg-slate-700 disabled:opacity-30 text-slate-400"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          {slides.length > 0 && (
            <button
              onClick={() => window.open(`/api/projects/${id}/export?format=pptx`)}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-md font-medium"
            >
              导出 PPTX
            </button>
          )}
        </div>

        {/* Canvas */}
        <div className="flex-1 flex items-center justify-center bg-slate-950 p-8">
          {slides.length === 0 ? (
            <div className="text-slate-600 text-lg">在左侧对话中描述你的需求，AI 将在这里实时生成 PPT</div>
          ) : (
            <CanvasPreview srcDoc={getSlidePreviewHtml(slides[currentSlide])} />
          )}
        </div>

        {/* Slide thumbnails strip */}
        {slides.length > 0 && (
          <div className="h-24 border-t border-slate-700 flex items-center gap-2 px-4 overflow-x-auto">
            {slides.map((slide, i) => (
              <div
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={`flex-shrink-0 w-28 h-16 rounded cursor-pointer border-2 overflow-hidden ${
                  i === currentSlide ? 'border-indigo-500' : 'border-slate-700 hover:border-slate-500'
                }`}
              >
                <iframe
                  srcDoc={getSlidePreviewHtml(slide)}
                  className="w-[1920px] h-[1080px] border-none pointer-events-none"
                  style={{ transform: 'scale(0.058)', transformOrigin: 'top left' }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ToolCallBlock({ toolCall }: { toolCall: ToolCall }) {
  const [expanded, setExpanded] = useState(false)

  const toolLabel = toolCall.tool === 'web_search' ? '🔍 搜索'
    : toolCall.tool === 'read_url' ? '📄 读取网页'
    : toolCall.tool === 'analyze_and_plan' ? '📋 分析规划'
    : toolCall.tool

  const inputText = toolCall.tool === 'web_search' ? toolCall.input?.query
    : toolCall.tool === 'read_url' ? toolCall.input?.url
    : ''

  return (
    <div className="rounded-md border border-slate-600 bg-slate-900/50 text-xs overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-700/50 transition-colors"
      >
        <span className={`transition-transform ${expanded ? 'rotate-90' : ''}`}>▶</span>
        <span className="font-medium">{toolLabel}</span>
        {inputText && <span className="text-slate-400 truncate">{inputText}</span>}
        <span className={`ml-auto ${toolCall.status === 'done' ? 'text-green-400' : 'text-yellow-400'}`}>
          {toolCall.status === 'done' ? '✓' : '⏳'}
        </span>
      </button>
      {expanded && toolCall.result && (
        <div className="px-3 py-2 border-t border-slate-700 text-slate-400 whitespace-pre-wrap max-h-32 overflow-y-auto">
          {toolCall.result}
        </div>
      )}
    </div>
  )
}

function CanvasPreview({ srcDoc }: { srcDoc: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [scale, setScale] = useState(0.5)

  useEffect(() => {
    function updateScale() {
      if (containerRef.current) {
        setScale(containerRef.current.clientWidth / 1920)
      }
    }
    updateScale()
    const observer = new ResizeObserver(updateScale)
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="w-full max-w-4xl aspect-video bg-white rounded-lg shadow-2xl overflow-hidden relative">
      <iframe
        ref={iframeRef}
        srcDoc={srcDoc}
        className="absolute top-0 left-0 border-none"
        style={{ width: '1920px', height: '1080px', transform: `scale(${scale})`, transformOrigin: 'top left' }}
      />
    </div>
  )
}

function getSlidePreviewHtml(slide: Slide | undefined): string {
  if (!slide) return ''
  return `<!DOCTYPE html><html><body style="margin:0;display:flex;align-items:center;justify-content:center;width:1920px;height:1080px;font-family:Inter,sans-serif;background:#fff;">
    <div style="text-align:center;padding:80px;">
      <h1 style="font-size:48px;color:#1f2937;">${slide.content?.title || 'Slide ' + (slide.index + 1)}</h1>
      <p style="font-size:24px;color:#6b7280;margin-top:16px;">${slide.templateId}</p>
    </div>
  </body></html>`
}
