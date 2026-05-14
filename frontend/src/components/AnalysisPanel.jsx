import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotesStore } from '@/stores/notesStore'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Send, Loader2 } from 'lucide-react'

function Accordion({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-muted/30 rounded-lg mb-2 overflow-hidden border border-border">
      <div
        className="px-4 py-3 flex justify-between items-center cursor-pointer hover:bg-accent transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span className="text-sm font-medium text-foreground">{title}</span>
        <span className={`text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </div>
      {open && <div className="px-4 pb-3.5 text-sm text-foreground">{children}</div>}
    </div>
  )
}

export function AnalysisPanel({ noteId }) {
  const navigate = useNavigate()
  const { fetchNote, currentNote } = useNotesStore()
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [error, setError] = useState('')

  // Chat state
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatSending, setChatSending] = useState(false)
  const [chatStreamingId, setChatStreamingId] = useState(null)
  const chatEndRef = useRef(null)

  useEffect(() => {
    if (noteId) {
      fetchNote(noteId).then(() => setLoading(false))
    }
  }, [noteId])

  useEffect(() => {
    if (!loading && noteId && !currentNote?.analysis_result && !analyzing && !error) {
      startAnalysis()
    }
  }, [loading, noteId])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const startAnalysis = async () => {
    setAnalyzing(true)
    setStreamingText('')
    setError('')
    try {
      const resp = await fetch(`/api/notes/${noteId}/analyze`, { method: 'POST' })
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}))
        setError(errData.detail || '分析失败')
        return
      }
      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value)
        if (text.includes('[分析失败:')) {
          setError(text.replace(/\[|\]/g, ''))
          return
        }
        setStreamingText(prev => prev + text)
      }
      await fetchNote(noteId)
      // After analysis completes, load any existing chat history
      fetchChat()
    } catch (e) {
      setError('分析失败: ' + e.message)
    } finally {
      setAnalyzing(false)
    }
  }

  const fetchChat = async () => {
    try {
      const resp = await fetch(`/api/notes/${noteId}/chat`)
      const data = await resp.json()
      if (data.messages) setChatMessages(data.messages)
    } catch (e) {
      console.error('Failed to fetch chat:', e)
    }
  }

  const handleChatSend = async () => {
    if (!chatInput.trim() || chatSending) return
    const userMsg = chatInput.trim()
    setChatInput('')
    setChatSending(true)

    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }])

    const placeholderId = Date.now()
    setChatMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true, id: placeholderId }])
    setChatStreamingId(placeholderId)

    try {
      const resp = await fetch(`/api/notes/${noteId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg }),
      })
      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let assistantMsg = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value)
        assistantMsg += text
        setChatMessages(prev => prev.map(m =>
          m.id === placeholderId ? { ...m, content: assistantMsg } : m
        ))
      }
      setChatMessages(prev => prev.map(m =>
        m.id === placeholderId ? { role: 'assistant', content: assistantMsg } : m
      ))
      setChatStreamingId(null)
    } catch (e) {
      setChatMessages(prev => prev.map(m =>
        m.id === placeholderId ? { role: 'assistant', content: `发送失败: ${e.message}` } : m
      ))
      setChatStreamingId(null)
    } finally {
      setChatSending(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className="text-sm">加载分析结果...</span>
      </div>
    )
  }

  // Analyzing state
  if (analyzing) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-4 pt-3 pb-2">
          <div className="bg-brand-light/30 rounded-lg p-3 border-l-2 border-brand text-sm">
            <div className="font-medium text-foreground mb-0.5">{currentNote?.title}</div>
            <div className="text-muted-foreground text-xs flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              AI 正在分析中，请稍候...
            </div>
          </div>
        </div>
        <ScrollArea className="flex-1 px-4 pb-20">
          <div className="pt-2">
            {streamingText ? (
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{streamingText}</div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <div className="relative mb-4">
                  <div className="w-12 h-12 rounded-full border-4 border-brand/20 border-t-brand animate-spin" />
                </div>
                <div className="text-sm font-medium">AI 正在思考中</div>
                <div className="text-xs mt-1">正在连接 AI 服务商并发起分析...</div>
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="p-4 border-t border-border bg-white">
          <Button variant="outline" size="sm" onClick={() => navigate(`/notes/${noteId}`)}>
            返回编辑
          </Button>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-4 pt-3 pb-2">
          <div className="bg-red-50 rounded-lg p-3 border-l-2 border-red-400 text-sm">
            <div className="font-medium text-red-800 mb-0.5">分析失败</div>
            <div className="text-red-600 text-xs">{error}</div>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <div className="text-sm font-medium text-foreground mb-1">分析请求失败</div>
          <div className="text-xs mb-4 text-center max-w-xs">{error}</div>
          <div className="flex gap-2">
            <Button size="sm" onClick={startAnalysis}>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              重试
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(`/notes/${noteId}`)}>
              返回编辑
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const result = currentNote?.analysis_result
  if (!result || (result?.raw && !result.raw.trim())) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
        <div className="text-3xl mb-3">✨</div>
        <div className="text-sm mb-4">还没有分析结果</div>
        <div className="flex gap-2">
          <Button size="sm" onClick={startAnalysis}>
            <Loader2 className="h-4 w-4 mr-1" />
            重新分析
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate(`/notes/${noteId}`)}>
            返回编辑
          </Button>
        </div>
      </div>
    )
  }

  const isPromptAnalysis = result?.type === 'prompt_analysis' || result?.role_setting

  return (
    <div className="h-full flex flex-col">
      {/* Note reference */}
      <div className="px-4 pt-3 pb-2 shrink-0">
        <div className="bg-brand-light/30 rounded-lg p-3 border-l-2 border-brand text-sm">
          <div className="font-medium text-foreground mb-0.5">{currentNote?.title}</div>
          <div className="text-muted-foreground text-xs">
            {currentNote?.content?.slice(0, 100)}{currentNote?.content?.length > 100 ? '...' : ''}
          </div>
        </div>
      </div>

      {/* Scrollable content: analysis + chat */}
      <ScrollArea className="flex-1 px-4">
        {/* Analysis section */}
        {isPromptAnalysis ? (
          <div className="pt-2">
            <div className="text-xs font-semibold text-muted-foreground mb-3">提示词结构化分析</div>
            {[
              { label: '角色设定', content: result?.role_setting },
              { label: '任务描述', content: result?.task_description },
              { label: '输出格式', content: result?.output_format },
            ].map(item => item.content && (
              <div key={item.label} className="bg-white rounded-lg p-3.5 mb-2 border-l-2 border-brand shadow-sm">
                <div className="text-xs font-medium text-brand mb-1.5">{item.label}</div>
                <div className="text-sm leading-relaxed text-foreground">{item.content}</div>
              </div>
            ))}

            {result?.suggestions?.length > 0 && (
              <>
                <div className="text-xs font-semibold text-muted-foreground mt-5 mb-3">优化建议</div>
                {result.suggestions.map((s, i) => (
                  <Accordion key={i} title={`${i + 1}. ${s.slice(0, 40)}${s.length > 40 ? '...' : ''}`}>
                    <div className="leading-relaxed">{s}</div>
                  </Accordion>
                ))}
              </>
            )}

            {result?.improved_version && (
              <>
                <div className="text-xs font-semibold text-muted-foreground mt-5 mb-3">改进版本</div>
                <div className="bg-white rounded-lg p-4 border-l-2 border-brand shadow-sm">
                  <div className="text-xs font-medium text-brand mb-2">优化后的提示词</div>
                  <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">{result.improved_version}</div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="pt-2">
            <div className="text-xs font-semibold text-muted-foreground mb-3">翻译分析</div>
            {result?.translation_table && (
              <div className="bg-white rounded-lg p-3.5 mb-3 border-l-2 border-brand shadow-sm">
                <div className="text-xs font-medium text-brand mb-3">逐词翻译表</div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border">
                      <th className="text-left py-2 px-3 font-medium">单词</th>
                      <th className="text-left py-2 px-3 font-medium">翻译</th>
                      <th className="text-left py-2 px-3 font-medium">词性</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.translation_table.map((row, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-2 px-3 font-mono text-foreground">{row.word}</td>
                        <td className="py-2 px-3 text-foreground">{row.translation}</td>
                        <td className="py-2 px-3 text-muted-foreground">{row.pos}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {result?.grammar_tree && (
              <Accordion title="语法树分析">
                <div className="leading-relaxed">{result.grammar_tree}</div>
              </Accordion>
            )}
            {result?.corrections?.length > 0 && (
              <Accordion title="纠错建议">
                <ul className="list-disc list-inside space-y-1">
                  {result.corrections.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </Accordion>
            )}
            {result?.improved_version && (
              <>
                <div className="text-xs font-semibold text-muted-foreground mt-5 mb-3">改进版本</div>
                <div className="bg-white rounded-lg p-4 border-l-2 border-brand shadow-sm">
                  <div className="text-xs font-medium text-brand mb-2">更地道的表达</div>
                  <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">{result.improved_version}</div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Raw fallback */}
        {!isPromptAnalysis && !result?.translation_table && result?.raw && (
          <div className="bg-white rounded-lg p-4 border-l-2 border-brand shadow-sm">
            <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">{result.raw}</div>
          </div>
        )}

        {/* Action button: back to edit */}
        <div className="flex gap-2 mt-6 pt-4 border-t border-border">
          <Button variant="outline" size="sm" onClick={() => navigate(`/notes/${noteId}`)}>
            返回编辑
          </Button>
        </div>

        {/* Divider */}
        <div className="my-6 border-t border-border" />

        {/* Chat section */}
        <div className="pb-4">
          <div className="text-xs font-semibold text-muted-foreground mb-3">追问对话</div>

          {/* Chat messages */}
          {chatMessages.length > 0 && (
            <div className="mb-4">
              {chatMessages.map((msg, i) => {
                const isUser = msg.role === 'user'
                return (
                  <div key={i} className={`flex gap-3 mb-4 ${isUser ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                      isUser ? 'bg-brand text-primary-foreground' : 'bg-brand-light text-brand'
                    }`}>
                      {isUser ? '我' : 'AI'}
                    </div>
                    <div className="max-w-[70%]">
                      <div className={`px-4 py-3 rounded-lg text-sm leading-relaxed ${
                        isUser
                          ? 'bg-brand text-primary-foreground rounded-tr-sm'
                          : 'bg-white border border-border rounded-tl-sm'
                      }`}>
                        <div className="whitespace-pre-wrap">{msg.content || ''}</div>
                        {msg.streaming && (
                          <Loader2 className="h-3 w-3 animate-spin inline ml-1 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={chatEndRef} />
            </div>
          )}

          {chatMessages.length === 0 && (
            <div className="text-center py-6 text-muted-foreground text-xs">
              分析完成后可在下方发起追问
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Fixed input at bottom */}
      <div className="p-3 border-t border-border bg-white shrink-0">
        <div className="flex gap-2 items-end">
          <Input
            className="flex-1"
            placeholder="输入你的追问..."
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSend(); } }}
          />
          <Button size="icon" onClick={handleChatSend} disabled={!chatInput.trim() || chatSending}>
            {chatSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  )
}
