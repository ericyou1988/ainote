import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useNotesStore } from '../stores/notesStore';

export function ChatPage() {
  const { id } = useParams();
  const { fetchNote, currentNote } = useNotesStore();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchNote(id);
    fetchChat();
  }, [id]);

  const fetchChat = async () => {
    try {
      const resp = await fetch(`/api/notes/${id}/chat`);
      const data = await resp.json();
      if (data.messages) setMessages(data.messages);
    } catch (e) {
      console.error('Failed to fetch chat:', e);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const userMsg = input.trim();
    setInput('');
    setSending(true);

    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);

    try {
      const resp = await fetch(`/api/notes/${id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg }),
      });

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let assistantMsg = '';

      setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        assistantMsg += text;
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === 'assistant' && last.streaming) {
            last.content = assistantMsg;
          }
          return updated;
        });
      }

      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last) delete last.streaming;
        return updated;
      });
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: `发送失败: ${e.message}` }]);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div className="max-w-[840px] mx-auto px-6 flex flex-col h-screen">
      {/* Header */}
      <header className="py-4 flex items-center justify-between border-b border-[#e4e1eb] sticky top-0 bg-[#fcf8ff]/90 backdrop-blur-sm z-10">
        <div className="flex items-center gap-3">
          <Link to={`/analysis/${id}`} className="w-9 h-9 rounded-lg hover:bg-[#f0ecf6] flex items-center justify-center text-text-secondary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
          </Link>
          <div>
            <div className="text-sm font-semibold truncate max-w-[300px]">{currentNote?.title}</div>
            <div className="text-xs text-text-muted">独立对话线程 · 持久化保存</div>
          </div>
        </div>
      </header>

      {/* Chat area */}
      <div className="flex-1 py-6 overflow-y-auto">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 mb-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            {/* Avatar */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${
              msg.role === 'assistant' ? 'bg-[#e2dfff] text-[#3730a3]' : 'bg-[#3730a3] text-white'
            }`}>
              {msg.role === 'assistant' ? 'AI' : '我'}
            </div>
            {/* Bubble */}
            <div className="max-w-[75%]">
              <div className={`px-4 py-3 rounded-lg text-sm leading-relaxed ${
                msg.role === 'assistant'
                  ? 'bg-[#f6f2fc] rounded-tl-sm'
                  : 'bg-[#3730a3] text-white rounded-tr-sm'
              }`}>
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
              <div className={`text-xs text-text-faint mt-1 ${msg.role === 'user' ? 'text-right' : ''}`}>
                {formatTime(new Date().toISOString())}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="py-3 border-t border-[#e4e1eb] bg-[#fcf8ff]/90 backdrop-blur-sm">
        <div className="flex gap-2 items-end">
          <div className="w-10 h-10 rounded-full bg-[#f0ecf6] flex items-center justify-center text-text-faint cursor-not-allowed" title="即将上线">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/></svg>
          </div>
          <textarea
            className="flex-1 px-3.5 py-2.5 border border-[#e4e1eb] rounded-xl text-sm resize-none outline-none min-h-[40px] max-h-[120px] bg-white focus:border-[#3730a3]"
            placeholder="输入你的追问..."
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="w-10 h-10 rounded-full bg-[#3730a3] text-white flex items-center justify-center flex-shrink-0 hover:opacity-90 disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
