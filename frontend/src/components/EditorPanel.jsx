import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotesStore } from '@/stores/notesStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Bold, Italic, Heading, List, Link2, Code, Trash2, Sparkles, Save, Loader2 } from 'lucide-react'

const AVAILABLE_TAGS = ['中文', '英文', '提示词']

export function EditorPanel({ noteId }) {
  const navigate = useNavigate()
  const { fetchNote, createNote, updateNote, deleteNote, currentNote } = useNotesStore()

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState([])
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  useEffect(() => {
    if (noteId && noteId !== 'new') {
      fetchNote(noteId).then(note => {
        setTitle(note.title)
        setContent(note.content)
        setTags(note.language_tags || [])
      })
    } else if (noteId === 'new') {
      setTitle('')
      setContent('')
      setTags([])
    }
  }, [noteId])

  const handleSave = async () => {
    setSaving(true)
    try {
      if (noteId && noteId !== 'new') {
        await updateNote(noteId, { title, content })
      } else {
        const note = await createNote({ title, content })
        navigate(`/notes/${note.id}`)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleAnalyze = async () => {
    if (!noteId || noteId === 'new') {
      await handleSave()
      return
    }
    setAnalyzing(true)
    try {
      await updateNote(noteId, { title, content })
      navigate(`/notes/${noteId}/analysis`)
    } finally {
      setAnalyzing(false)
    }
  }

  const handleDelete = async () => {
    if (noteId && noteId !== 'new') {
      await deleteNote(noteId)
      navigate('/notes')
    }
    setShowDeleteDialog(false)
  }

  const toggleTag = (tag) => {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  const insertFormat = useCallback((prefix, suffix = '') => {
    const textarea = document.getElementById('editor-textarea')
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = content.slice(start, end)
    const replacement = prefix + (selected || '文字') + suffix
    setContent(content.slice(0, start) + replacement + content.slice(end))
    setTimeout(() => {
      textarea.focus()
      textarea.selectionStart = start + prefix.length
      textarea.selectionEnd = start + prefix.length + (selected || '文字').length
    }, 0)
  }, [content])

  if (noteId === 'new') {
    return (
      <div className="h-full flex flex-col">
        {/* Tags */}
        <div className="flex gap-1.5 px-4 pt-3 pb-2">
          {AVAILABLE_TAGS.map(tag => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                tags.includes(tag)
                  ? 'bg-brand text-primary-foreground border-brand'
                  : 'bg-muted text-muted-foreground border-border'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Title */}
        <Input
          className="border-0 shadow-none text-lg font-semibold px-4 focus-visible:ring-0 h-auto"
          placeholder="输入笔记标题..."
          value={title}
          onChange={e => setTitle(e.target.value)}
        />

        {/* Toolbar */}
        <div className="flex gap-0.5 px-4 py-1.5 border-b border-border">
          {[
            { icon: <Bold className="h-3.5 w-3.5" />, action: () => insertFormat('**', '**') },
            { icon: <Italic className="h-3.5 w-3.5" />, action: () => insertFormat('*', '*') },
            { icon: <Heading className="h-3.5 w-3.5" />, action: () => insertFormat('### ', '') },
            { icon: <List className="h-3.5 w-3.5" />, action: () => insertFormat('- ', '') },
            { icon: <Link2 className="h-3.5 w-3.5" />, action: () => insertFormat('[', '](url)') },
            { icon: <Code className="h-3.5 w-3.5" />, action: () => insertFormat('`', '`') },
          ].map((btn, i) => (
            <button
              key={i}
              onClick={btn.action}
              className="w-7 h-7 rounded-md text-muted-foreground flex items-center justify-center hover:bg-accent hover:text-foreground transition-colors"
            >
              {btn.icon}
            </button>
          ))}
        </div>

        {/* Editor */}
        <ScrollArea className="flex-1">
          <textarea
            id="editor-textarea"
            className="w-full p-4 outline-none bg-transparent resize-none text-[15px] leading-relaxed min-h-[300px]"
            placeholder="开始输入笔记内容..."
            value={content}
            onChange={e => setContent(e.target.value)}
          />
        </ScrollArea>

        {/* Footer actions — new note */}
        <div className="flex gap-2 p-4 border-t border-border">
          <Button variant="outline" size="sm" onClick={() => navigate('/notes')}>
            返回
          </Button>
          <Button size="sm" className="ml-auto" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            保存
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Tags */}
      <div className="flex gap-1.5 px-4 pt-3 pb-2">
        {AVAILABLE_TAGS.map(tag => (
          <button
            key={tag}
            onClick={() => toggleTag(tag)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              tags.includes(tag)
                ? 'bg-brand text-primary-foreground border-brand'
                : 'bg-muted text-muted-foreground border-border'
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Title */}
      <Input
        className="border-0 shadow-none text-lg font-semibold px-4 focus-visible:ring-0 h-auto"
        placeholder="输入笔记标题..."
        value={title}
        onChange={e => setTitle(e.target.value)}
      />

      {/* Toolbar */}
      <div className="flex gap-0.5 px-4 py-1.5 border-b border-border">
        {[
          { icon: <Bold className="h-3.5 w-3.5" />, action: () => insertFormat('**', '**') },
          { icon: <Italic className="h-3.5 w-3.5" />, action: () => insertFormat('*', '*') },
          { icon: <Heading className="h-3.5 w-3.5" />, action: () => insertFormat('### ', '') },
          { icon: <List className="h-3.5 w-3.5" />, action: () => insertFormat('- ', '') },
          { icon: <Link2 className="h-3.5 w-3.5" />, action: () => insertFormat('[', '](url)') },
          { icon: <Code className="h-3.5 w-3.5" />, action: () => insertFormat('`', '`') },
        ].map((btn, i) => (
          <button
            key={i}
            onClick={btn.action}
            className="w-7 h-7 rounded-md text-muted-foreground flex items-center justify-center hover:bg-accent hover:text-foreground transition-colors"
          >
            {btn.icon}
          </button>
        ))}
      </div>

      {/* Editor */}
      <ScrollArea className="flex-1">
        <textarea
          id="editor-textarea"
          className="w-full p-4 outline-none bg-transparent resize-none text-[15px] leading-relaxed min-h-[300px]"
          placeholder="开始输入笔记内容..."
          value={content}
          onChange={e => setContent(e.target.value)}
        />
      </ScrollArea>

      {/* Footer actions — existing note */}
      <div className="flex gap-2 p-4 border-t border-border">
        <Button variant="outline" size="sm" onClick={() => navigate('/notes')}>
          返回列表
        </Button>
        <Button variant="destructive" size="sm" className="ml-auto" disabled={saving} onClick={() => setShowDeleteDialog(true)}>
          <Trash2 className="h-4 w-4" />
          删除
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          保存
        </Button>
        {(!currentNote || !currentNote.status || currentNote.status === 'unanalyzed') && (
          <Button size="sm" onClick={handleAnalyze} disabled={analyzing || !content.trim()}>
            {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            AI 分析
          </Button>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              删除后将无法恢复，确定要删除这条笔记吗？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>取消</Button>
            <Button variant="destructive" onClick={handleDelete}>删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
