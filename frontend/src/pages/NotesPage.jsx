import { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useNotesStore } from '@/stores/notesStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { EditorPanel } from '@/components/EditorPanel'
import { AnalysisPanel } from '@/components/AnalysisPanel'
import { ArrowLeft } from 'lucide-react'

const TAG_COLORS = {
  '中文': 'bg-[#fef3e2] text-[#9a6700] border-[#fde68a]',
  '英文': 'bg-[#e8f5e9] text-[#2e7d32] border-[#a5d6a7]',
  '提示词': 'bg-[#ede9fe] text-[#6d28d9] border-[#c4b5fd]',
}

const STATUS_COLORS = {
  unanalyzed: 'bg-muted-foreground',
  analyzed: 'bg-blue-400',
  discussed: 'bg-orange-400',
}

const timeAgo = (date) => {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days === 1) return '昨天'
  return `${days}天前`
}

function NoteListItem({ note, isSelected, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg transition-colors ${
        isSelected ? 'bg-brand-light' : 'hover:bg-accent'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_COLORS[note.status]}`}></span>
            <span className="text-[13px] font-semibold text-foreground truncate">{note.title}</span>
          </div>
          <div className="text-xs text-muted-foreground line-clamp-1">{note.content.slice(0, 80)}</div>
        </div>
        <span className="text-[10px] text-text-faint shrink-0 mt-0.5">{timeAgo(note.updated_at)}</span>
      </div>
      {note.language_tags && note.language_tags.length > 0 && (
        <div className="flex gap-1 mt-2">
          {note.language_tags.map(t => (
            <span key={t} className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] border ${TAG_COLORS[t] || 'bg-gray-100 text-gray-600'}`}>
              {t}
            </span>
          ))}
        </div>
      )}
    </button>
  )
}

export function NotesPage() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { notes, total, loading, fetchNotes, fetchNote, currentNote } = useNotesStore()
  const { fetchProviders } = useSettingsStore()
  const [selectedTags, setSelectedTags] = useState([])
  const [sort, setSort] = useState('updated_at')
  const [offset, setOffset] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')

  const allTags = ['全部', '中文', '英文', '提示词']

  useEffect(() => {
    fetchNotes({ limit: 50, offset: 0, sort })
    fetchProviders()
  }, [])

  useEffect(() => {
    if (id && id !== 'new') {
      fetchNote(id)
    }
  }, [id])

  const handleSearch = () => {
    fetchNotes({ q: searchQuery || undefined, tags: selectedTags.length > 0 ? selectedTags.join(',') : undefined, sort, limit: 50, offset: 0 })
    setOffset(0)
  }

  const handleTagClick = (tag) => {
    if (tag === '全部') {
      setSelectedTags([])
    } else {
      setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
    }
  }

  const handleSelectNote = (noteId) => {
    navigate(`/notes/${noteId}`)
  }

  // Determine which panel to show based on URL
  const isNewNote = id === 'new'
  const hasNote = id && id !== 'new'
  const isAnalysisPage = location.pathname.includes('/analysis')

  // Show 'AI 分析' tab only after first analysis (status != unanalyzed) or when viewing analysis page
  const hasAnalyzed = currentNote && currentNote.status && currentNote.status !== 'unanalyzed'
  const showAnalysisTab = hasAnalyzed || isAnalysisPage

  // Determine active sub-tab
  const activeTab = isAnalysisPage ? 'analysis' : 'content'

  const handleTabClick = (tab) => {
    if (!id) return
    if (tab === 'content') navigate(`/notes/${id}`)
    else if (tab === 'analysis') navigate(`/notes/${id}/analysis`)
  }

  return (
    <div className="flex h-full">
      {/* Left sidebar - note list */}
      <div className={`flex flex-col border-r border-border bg-white shrink-0 transition-all ${
        isNewNote
          ? 'w-0 p-0 overflow-hidden'
          : hasNote
            ? 'w-0 md:w-80 md:flex hidden'
            : 'w-full md:w-80'
      }`}>
        {/* Search */}
        <div className="p-3 border-b border-border">
          <Input
            className="h-8 text-sm"
            placeholder="搜索笔记..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
        </div>

        {/* Tag filters */}
        <div className="px-3 py-2 flex gap-1.5 flex-wrap border-b border-border">
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => handleTagClick(tag)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                (tag === '全部' && selectedTags.length === 0)
                  ? 'bg-brand text-primary-foreground'
                  : selectedTags.includes(tag)
                    ? 'bg-brand text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Note list */}
        <ScrollArea className="flex-1">
          <div className="p-2">
            {loading && <div className="text-center py-8 text-muted-foreground text-sm">加载中...</div>}
            {!loading && notes.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <div className="text-sm">暂无笔记</div>
                <div className="text-xs mt-1">点击右上角"新建"创建第一条笔记</div>
              </div>
            )}
            {notes.map(note => (
              <NoteListItem
                key={note.id}
                note={note}
                isSelected={note.id === id}
                onClick={() => handleSelectNote(note.id)}
              />
            ))}
            {notes.length < total && (
              <button
                className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => {
                  const newOffset = offset + 50
                  setOffset(newOffset)
                  fetchNotes({ q: searchQuery || undefined, tags: selectedTags.length > 0 ? selectedTags.join(',') : undefined, sort, limit: 50, offset: newOffset })
                }}
              >
                加载更多 ({notes.length}/{total})
              </button>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right panel */}
      {(!id && (
        <div className="hidden md:flex md:flex-1 items-center justify-center text-muted-foreground">
          <div className="text-center">
            <div className="text-sm">在左侧选择一条笔记</div>
          </div>
        </div>
      )) || (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Sub-tabs */}
          {!isNewNote && (
            <div className="flex items-center border-b border-border bg-white px-2 shrink-0 overflow-x-auto">
              {id && id !== 'new' && (
                <button
                  onClick={() => navigate('/notes')}
                  className="md:hidden p-2 text-muted-foreground hover:text-foreground shrink-0"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              {['content', 'analysis'].map(tab => (
                tab === 'analysis' && !showAnalysisTab ? null : (
                  <button
                    key={tab}
                    onClick={() => handleTabClick(tab)}
                    className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      (tab === 'content' && activeTab === 'content') || (tab === 'analysis' && activeTab === 'analysis')
                        ? 'text-brand border-brand'
                        : 'text-muted-foreground border-transparent hover:text-foreground'
                    }`}
                  >
                    {tab === 'content' ? '内容' : 'AI 分析'}
                  </button>
                )
              ))}
            </div>
          )}

          {/* Panel content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'content' && id && <EditorPanel noteId={id} />}
            {activeTab === 'analysis' && id && id !== 'new' && <AnalysisPanel noteId={id} />}
            {activeTab === 'analysis' && id === 'new' && (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                请先保存笔记后再进行 AI 分析
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
