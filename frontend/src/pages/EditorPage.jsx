import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useNotesStore } from '../stores/notesStore';

const AVAILABLE_TAGS = ['中文', '英文', '提示词'];

export function EditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { fetchNote, createNote, updateNote, deleteNote } = useNotesStore();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState([]);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (id) {
      fetchNote(id).then(note => {
        setTitle(note.title);
        setContent(note.content);
        setTags(note.language_tags || []);
      });
    }
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (id) {
        await updateNote(id, { title, content });
      } else {
        const note = await createNote({ title, content });
        navigate(`/editor/${note.id}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAnalyze = async () => {
    if (!id) {
      await handleSave();
      return;
    }
    setAnalyzing(true);
    try {
      await updateNote(id, { title, content });
      navigate(`/analysis/${id}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDelete = () => {
    if (confirm('确认删除这条笔记？')) {
      deleteNote(id);
      navigate('/');
    }
  };

  const toggleTag = (tag) => {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const insertFormat = (prefix, suffix = '') => {
    const textarea = document.getElementById('editor-textarea');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.slice(start, end);
    const replacement = prefix + (selected || '文字') + suffix;
    setContent(content.slice(0, start) + replacement + content.slice(end));
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = start + prefix.length;
      textarea.selectionEnd = start + prefix.length + (selected || '文字').length;
    }, 0);
  };

  return (
    <div className="max-w-[840px] mx-auto px-6 h-screen flex flex-col">
      {/* Header */}
      <header className="py-4 flex items-center justify-between border-b border-[#e4e1eb]">
        <div className="flex items-center gap-3">
          <Link to="/" className="w-9 h-9 rounded-lg hover:bg-[#f0ecf6] flex items-center justify-center text-text-secondary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
          </Link>
          <span className="text-base font-semibold">{id ? '编辑笔记' : '新建笔记'}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={handleDelete} className="px-3 py-2 text-sm text-[#ba1a1a] hover:bg-[#ffdad6] rounded-lg">
            删除
          </button>
          <button onClick={handleSave} className="px-4 py-2 text-sm bg-[#3730a3] text-white rounded-lg hover:opacity-90 font-medium">
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </header>

      {/* Title */}
      <input
        className="w-full text-xl font-medium py-4 border-none outline-none bg-transparent placeholder:text-text-faint"
        type="text"
        placeholder="输入笔记标题..."
        value={title}
        onChange={e => setTitle(e.target.value)}
      />

      {/* Tags */}
      <div className="flex gap-2 pb-3 border-b border-[#f0ecf6]">
        {AVAILABLE_TAGS.map(tag => (
          <button
            key={tag}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              tags.includes(tag)
                ? 'bg-[#3730a3] text-white border-[#3730a3]'
                : 'bg-[#f6f2fc] text-text-secondary border-[#e4e1eb]'
            }`}
            onClick={() => toggleTag(tag)}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex gap-1 py-2 border-b border-[#e4e1eb]">
        {[
          { label: 'B', action: () => insertFormat('**', '**'), bold: true },
          { label: 'I', action: () => insertFormat('*', '*'), italic: true },
          { label: 'H', action: () => insertFormat('### ', '') },
          { label: '•', action: () => insertFormat('- ', '') },
          { label: '🔗', action: () => insertFormat('[', '](url)') },
          { label: '</>', action: () => insertFormat('`', '`') },
        ].map((btn, i) => (
          <button
            key={i}
            onClick={btn.action}
            className={`w-8 h-8 rounded-md text-sm flex items-center justify-center hover:bg-[#f0ecf6] ${
              btn.bold ? 'font-bold' : btn.italic ? 'italic' : ''
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Editor */}
      <textarea
        id="editor-textarea"
        className="flex-1 py-4 outline-none bg-transparent resize-none text-base leading-relaxed"
        placeholder="开始输入笔记内容..."
        value={content}
        onChange={e => setContent(e.target.value)}
      />

      {/* Footer actions */}
      <div className="py-4 flex gap-3 border-t border-[#e4e1eb]">
        <Link to="/" className="px-4 py-3 rounded-lg border border-[#e4e1eb] text-sm font-medium hover:bg-[#f0ecf6]">
          返回列表
        </Link>
        <button
          onClick={handleAnalyze}
          disabled={analyzing || !content.trim()}
          className="flex-1 py-3 rounded-lg bg-[#3730a3] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {analyzing ? (
            <>分析中...</>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              AI 分析
            </>
          )}
        </button>
      </div>
    </div>
  );
}
