import { useState, useEffect } from 'react'
import { useSettingsStore } from '../stores/settingsStore'
import { providersApi } from '../api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, Loader2, CheckCircle2, XCircle, Pencil } from 'lucide-react'

export function SettingsPage() {
  const { providers, currentProvider, fetchProviders } = useSettingsStore()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ name: '', api_key: '', base_url: '', model: '' })
  const [testResults, setTestResults] = useState({})

  useEffect(() => {
    fetchProviders()
  }, [])

  const openCreateForm = () => {
    setEditingId(null)
    setForm({ name: '', api_key: '', base_url: '', model: '' })
    setShowForm(true)
  }

  const openEditForm = (p) => {
    setEditingId(p.id)
    setForm({ name: p.name, api_key: '', base_url: p.base_url, model: p.model })
    setShowForm(true)
  }

  const handleSave = async () => {
    try {
      const data = { ...form }
      if (editingId && !data.api_key.trim()) {
        delete data.api_key
      }
      if (editingId) {
        await providersApi.update(editingId, data)
      } else {
        await providersApi.create(data)
      }
      setShowForm(false)
      setEditingId(null)
      fetchProviders()
    } catch (e) {
      alert('保存失败: ' + e.message)
    }
  }

  const handleToggle = async (id) => {
    await providersApi.toggle(id)
    fetchProviders()
  }

  const handleSetCurrent = async (id) => {
    await providersApi.setCurrent(id)
    fetchProviders()
  }

  const handleDelete = async (id) => {
    if (confirm('确认删除此服务商？')) {
      await providersApi.remove(id)
      fetchProviders()
    }
  }

  const handleTest = async (id) => {
    setTestResults(prev => ({ ...prev, [id]: { loading: true } }))
    try {
      const { data } = await providersApi.test(id)
      setTestResults(prev => ({ ...prev, [id]: { success: data.success, message: data.message, response_time_ms: data.response_time_ms } }))
    } catch (e) {
      setTestResults(prev => ({ ...prev, [id]: { success: false, message: e.message } }))
    }
  }

  const maskKey = (key) => {
    if (!key || key.length <= 6) return '***' + (key?.slice(-3) || '')
    return key.slice(0, 4) + '***' + key.slice(-3)
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold">AI 服务商设置</h1>
        <Button size="sm" onClick={openCreateForm}>
          <Plus className="h-4 w-4 mr-1" />
          添加
        </Button>
      </div>

      {/* Provider list */}
      <div className="space-y-3">
        {providers.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <div className="text-sm">暂无 AI 服务商</div>
            <div className="text-xs mt-1">点击上方"添加"配置你的第一个 AI 服务商</div>
          </div>
        )}

        {providers.map(p => {
          const result = testResults[p.id]
          return (
            <div key={p.id} className={`bg-white rounded-lg p-4 border-2 transition-colors ${p.is_current ? 'border-brand bg-brand-light/30' : 'border-transparent shadow-sm'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{p.name}</span>
                  {p.is_current && (
                    <Badge className="text-[10px]">当前使用</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">启用</span>
                  <Switch checked={p.is_active} onCheckedChange={() => handleToggle(p.id)} />
                </div>
              </div>

              <div className="space-y-1.5 text-xs mb-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">接口地址</span>
                  <span className="font-mono text-foreground">{p.base_url}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">API Key</span>
                  <span className="font-mono text-foreground">{maskKey(p.api_key || p.api_key_masked)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">模型</span>
                  <span className="font-mono text-foreground">{p.model}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-border">
                <Button variant="outline" size="sm" onClick={() => openEditForm(p)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  编辑
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleTest(p.id)} disabled={result?.loading}>
                  {result?.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '测试连接'}
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(p.id)}>
                  删除
                </Button>
                {!p.is_current && p.is_active && (
                  <Button variant="outline" size="sm" onClick={() => handleSetCurrent(p.id)}>
                    设为当前
                  </Button>
                )}
              </div>

              {result && !result.loading && (
                <div className={`mt-2 px-3 py-2 rounded-md text-xs flex items-center gap-1.5 ${result.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                  {result.success ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <XCircle className="h-3 w-3" />
                  )}
                  {result.message}
                  {result.response_time_ms && ` · 响应时间 ${Math.round(result.response_time_ms)}ms`}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Add/Edit provider dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? '编辑服务商' : '添加新服务商'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {[
              { key: 'name', label: '服务商名称', placeholder: '例如：通义千问、OpenAI' },
              { key: 'api_key', label: 'API Key', placeholder: editingId ? '留空则不修改' : 'sk-...', type: 'password' },
              { key: 'base_url', label: '接口地址', placeholder: '例如：https://api.openai.com/v1' },
              { key: 'model', label: '模型名称', placeholder: '例如：gpt-4o' },
            ].map(field => (
              <div key={field.key}>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{field.label}</label>
                <Input
                  type={field.type || 'text'}
                  placeholder={field.placeholder}
                  value={form[field.key]}
                  onChange={e => setForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>取消</Button>
            <Button onClick={handleSave}>{editingId ? '保存修改' : '添加'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
