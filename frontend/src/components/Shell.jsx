import { useState } from 'react'
import { Link, useNavigate, Outlet, useLocation } from 'react-router-dom'
import { Search, Plus, Settings, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'

export function Shell() {
  const navigate = useNavigate()
  const location = useLocation()
  const [search, setSearch] = useState('')
  const isNotesPage = location.pathname.startsWith('/notes') || location.pathname === '/'

  return (
    <div className="h-screen flex flex-col bg-[#f5f4f7]">
      {/* Top navigation bar */}
      <header className="h-12 bg-white border-b border-border flex items-center px-4 gap-2 shrink-0">
        <Link to="/notes" className="text-base font-bold tracking-tight text-foreground shrink-0 mr-4">
          AI<span className="text-brand">note</span>
        </Link>

        {/* Global tabs */}
        <nav className="flex items-center h-full">
          <Link
            to="/notes"
            className={`h-full flex items-center px-3 text-sm font-medium border-b-2 transition-colors ${
              isNotesPage
                ? 'text-brand border-brand'
                : 'text-muted-foreground border-transparent hover:text-foreground'
            }`}
          >
            笔记
          </Link>
          <Link
            to="/settings"
            className={`h-full flex items-center px-3 text-sm font-medium border-b-2 transition-colors ${
              location.pathname === '/settings'
                ? 'text-brand border-brand'
                : 'text-muted-foreground border-transparent hover:text-foreground'
            }`}
          >
            设置
          </Link>
        </nav>

        {/* Search bar (notes page only) */}
        {isNotesPage && (
          <div className="flex-1 min-w-0 max-w-sm mx-2 md:mx-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 h-8 text-sm bg-muted/50 border-0 w-full"
                placeholder="搜索笔记..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="flex-1" />

        {/* New note button (notes page only) */}
        {isNotesPage && (
          <Button size="sm" onClick={() => navigate('/notes/new')}>
            <Plus className="h-4 w-4" />
            新建
          </Button>
        )}
      </header>

      {/* Page content */}
      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  )
}
