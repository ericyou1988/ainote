import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useNotesStore } from '../stores/notesStore';
import { useSettingsStore } from '../stores/settingsStore';

const TAG_COLORS = {
  '中文': 'bg-stone-200 text-stone-600',
  '英文': 'bg-gray-200 text-gray-800',
  '提示词': 'bg-[#e2dfff] text-[#0f0069]',
};

const STATUS_LABELS = {
  unanalyzed: '未分析',
  analyzed: '已分析',
  discussed: '有追问',
};

const STATUS_COLORS = {
  unanalyzed: 'bg-gray-300',
  analyzed: 'bg-blue-400',
  discussed: 'bg-orange-400',
};

function TagPill({ tag }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TAG_COLORS[tag] || 'bg-gray-100 text-gray-600'}`}>
      {tag}
    </span>
  );
}

function NoteCard({ note }) {
  const timeAgo = (date) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}分钟前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}小时前`;
    const days = Math.floor(hours / 24);
    if (days === 1) return '昨天';
    return `${days}天前`;
  };

  return (
    <Link to={`/editor/${note.id}`} className="block bg-[#f6f2fc] rounded-lg p-4 hover:bg-[#f0ecf6] transition-colors">
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[note.status]}`}></span>
        <span className="text-xs text-text-muted">{STATUS_LABELS[note.status]}</span>
      </div>
      <div className="font-medium text-base mb-1.5">{note.title}</div>
      <div className="text-sm text-text-secondary line-clamp-2 mb-2.5">{note.content.slice(0, 150)}</div>
      <div className="flex justify-between items-center">
        <div className="flex gap-1.5 flex-wrap">
          {note.language_tags.map(t => <TagPill key={t} tag={t} />)}
        </div>
        <span className="text-xs text-text-muted">{timeAgo(note.updated_at)}</span>
      </div>
    </Link>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const { notes, total, loading, fetchNotes } = useNotesStore();
  const { fetchProviders } = useSettingsStore();
  const [search, setSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [sort, setSort] = useState('updated_at');
  const [offset, setOffset] = useState(0);

  const allTags = ['全部', '中文', '英文', '提示词'];

  useEffect(() => {
    fetchNotes({ limit: 20, offset: 0, sort });
    fetchProviders();
  }, []);

  const handleSearch = () => {
    fetchNotes({ q: search || undefined, tags: selectedTags.length > 0 ? selectedTags.join(',') : undefined, sort, limit: 20, offset: 0 });
    setOffset(0);
  };

  const handleTagClick = (tag) => {
    if (tag === '全部') {
      setSelectedTags([]);
      return;
    }
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  useEffect(() => {
    if (selectedTags.length > 0 || search) {
      fetchNotes({ q: search || undefined, tags: selectedTags.length > 0 ? selectedTags.join(',') : undefined, sort, limit: 20, offset: 0 });
      setOffset(0);
    }
  }, [selectedTags]);

  return (
    <div className="max-w-[840px] mx-auto px-6">
      {/* Header */}
      <header className="py-4 flex items-center justify-between border-b border-[#e4e1eb]">
        <Link to="/" className="text-xl font-semibold tracking-tight">AI<span className="text-[#3730a3]">note</span></Link>
        <div className="flex gap-3 items-center">
          <button className="w-9 h-9 rounded-lg bg-transparent hover:bg-[#f0ecf6] flex items-center justify-center text-text-secondary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </button>
          <Link to="/editor" className="bg-[#3730a3] text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-1.5 hover:opacity-90">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            新建笔记
          </Link>
        </div>
      </header>

      {/* Search bar */}
      <div className="py-4 flex gap-2">
        <input
          className="flex-1 px-3.5 py-2.5 border border-[#c8c4d5] rounded-lg text-sm bg-white outline-none focus:border-[#3730a3] focus:ring-2 focus:ring-[#3730a3]/10"
          type="text"
          placeholder="搜索笔记标题或内容..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
        />
      </div>

      {/* Tag filter */}
      <div className="flex gap-2 pb-4 flex-wrap">
        {allTags.map(tag => (
          <button
            key={tag}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              (tag === '全部' && selectedTags.length === 0)
                ? 'bg-[#3730a3] text-white border-[#3730a3]'
                : selectedTags.includes(tag)
                  ? 'bg-[#3730a3] text-white border-[#3730a3]'
                  : 'bg-[#f6f2fc] text-text-secondary border-[#e4e1eb] hover:bg-[#f0ecf6]'
            }`}
            onClick={() => handleTagClick(tag)}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Sort bar */}
      <div className="py-3 flex justify-between items-center text-xs text-text-muted border-b border-[#f0ecf6]">
        <span>共 {total} 条笔记</span>
        <select
          className="bg-transparent outline-none text-text-muted cursor-pointer"
          value={sort}
          onChange={e => { setSort(e.target.value); fetchNotes({ sort: e.target.value, limit: 20, offset: 0 }); }}
        >
          <option value="updated_at">按更新时间</option>
          <option value="created_at">按创建时间</option>
        </select>
      </div>

      {/* Note list */}
      <div className="py-4 flex flex-col gap-3 pb-20">
        {loading && <div className="text-center py-8 text-text-muted">加载中...</div>}
        {!loading && notes.length === 0 && (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">📝</div>
            <div className="text-text-muted mb-4">还没有笔记</div>
            <Link to="/editor" className="text-[#3730a3] font-medium hover:underline">创建第一条笔记 →</Link>
          </div>
        )}
        {!loading && notes.map(note => <NoteCard key={note.id} note={note} />)}
        {notes.length < total && (
          <button
            className="text-center py-3 text-sm text-text-muted hover:text-brand"
            onClick={() => {
              const newOffset = offset + 20;
              setOffset(newOffset);
              fetchNotes({ q: search || undefined, tags: selectedTags.length > 0 ? selectedTags.join(',') : undefined, sort, limit: 20, offset: newOffset });
            }}
          >
            加载更多...
          </button>
        )}
      </div>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-[#fcf8ff]/90 backdrop-blur-sm border-t border-[#e4e1eb] py-3">
        <div className="max-w-[840px] mx-auto px-6 flex justify-between items-center">
          <span className="text-xs text-text-faint">v1.0 · 本地存储</span>
          <Link to="/settings" className="text-xs text-text-muted flex items-center gap-1.5 hover:text-brand">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2"/></svg>
            AI 设置
          </Link>
        </div>
      </footer>
    </div>
  );
}
