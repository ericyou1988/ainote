import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSettingsStore } from '../stores/settingsStore';
import { providersApi } from '../api/client';

export function SettingsPage() {
  const { providers, currentProvider, fetchProviders } = useSettingsStore();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', api_key: '', base_url: '', model: '' });
  const [testResults, setTestResults] = useState({});

  useEffect(() => {
    fetchProviders();
  }, []);

  const handleCreate = async () => {
    try {
      await providersApi.create(form);
      setForm({ name: '', api_key: '', base_url: '', model: '' });
      setShowForm(false);
      fetchProviders();
    } catch (e) {
      alert('保存失败: ' + e.message);
    }
  };

  const handleToggle = async (id) => {
    await providersApi.toggle(id);
    fetchProviders();
  };

  const handleSetCurrent = async (id) => {
    await providersApi.setCurrent(id);
    fetchProviders();
  };

  const handleDelete = async (id) => {
    if (confirm('确认删除此服务商？')) {
      await providersApi.remove(id);
      fetchProviders();
    }
  };

  const handleTest = async (id) => {
    setTestResults(prev => ({ ...prev, [id]: { loading: true } }));
    try {
      const { data } = await providersApi.test(id);
      setTestResults(prev => ({ ...prev, [id]: { success: data.success, message: data.message, response_time_ms: data.response_time_ms } }));
    } catch (e) {
      setTestResults(prev => ({ ...prev, [id]: { success: false, message: e.message } }));
    }
  };

  const maskKey = (key) => {
    if (!key || key.length <= 6) return '***' + (key?.slice(-3) || '');
    return key.slice(0, 4) + '***' + key.slice(-3);
  };

  return (
    <div className="max-w-[840px] mx-auto px-6">
      {/* Header */}
      <header className="py-4 flex items-center justify-between border-b border-[#e4e1eb] sticky top-0 bg-[#fcf8ff]/90 backdrop-blur-sm z-10">
        <div className="flex items-center gap-3">
          <Link to="/" className="w-9 h-9 rounded-lg hover:bg-[#f0ecf6] flex items-center justify-center text-text-secondary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
          </Link>
          <span className="text-base font-semibold">AI 服务商设置</span>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="bg-[#3730a3] text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-1.5 hover:opacity-90">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
          添加
        </button>
      </header>

      {/* Provider list */}
      <div className="py-6 flex flex-col gap-3 pb-20">
        {providers.map(p => (
          <div key={p.id} className={`bg-white rounded-lg p-4 border-2 ${p.is_current ? 'border-[#3730a3] bg-[#f6f2fc]' : 'border-transparent'} shadow-sm`}>
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold">{p.name}</span>
                {p.is_current && <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#3730a3] text-white">当前使用</span>}
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={p.is_active}
                  onChange={() => handleToggle(p.id)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5.5 bg-[#c8c4d5] peer-checked:bg-[#3730a3] rounded-full peer peer-focus:ring-2 peer-focus:ring-[#3730a3]/20 transition-colors relative">
                  <div className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 bg-white rounded-full transition-transform ${p.is_active ? 'translate-x-5' : ''}`} style={{ width: '18px', height: '18px' }}></div>
                </div>
              </label>
            </div>
            <div className="space-y-2 text-xs mb-3">
              <div className="flex justify-between">
                <span className="text-text-muted">接口地址</span>
                <span className="text-text font-mono">{p.base_url}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">API Key</span>
                <span className="text-text font-mono">{maskKey(p.api_key || p.api_key_masked)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">模型</span>
                <span className="text-text font-mono">{p.model}</span>
              </div>
            </div>
            <div className="flex gap-2 pt-3 border-t border-[#f0ecf6]">
              <button onClick={() => handleTest(p.id)} className="px-3 py-1.5 rounded-md text-xs font-medium border border-[#e4e1eb] text-[#3730a3] hover:bg-[#e2dfff]">
                测试连接
              </button>
              <button onClick={() => handleDelete(p.id)} className="px-3 py-1.5 rounded-md text-xs font-medium border border-[#ffdad6] text-[#ba1a1a] hover:bg-[#ffdad6]">
                删除
              </button>
              {!p.is_current && p.is_active && (
                <button onClick={() => handleSetCurrent(p.id)} className="px-3 py-1.5 rounded-md text-xs font-medium border border-[#e4e1eb] hover:bg-[#f0ecf6]">
                  设为当前
                </button>
              )}
            </div>
            {testResults[p.id] && !testResults[p.id].loading && (
              <div className={`mt-2 px-3 py-2 rounded-md text-xs flex items-center gap-1.5 ${testResults[p.id].success ? 'bg-[#dcfce7] text-[#166534]' : 'bg-[#ffdad6] text-[#ba1a1a]'}`}>
                {testResults[p.id].success ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                )}
                {testResults[p.id].message}
                {testResults[p.id].response_time_ms && ` · 响应时间 ${Math.round(testResults[p.id].response_time_ms)}ms`}
              </div>
            )}
          </div>
        ))}

        {/* Add form */}
        {showForm && (
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-sm font-semibold mb-4">添加新服务商</div>
            <div className="space-y-3">
              {[
                { key: 'name', label: '服务商名称', placeholder: '例如：通义千问、OpenAI' },
                { key: 'api_key', label: 'API Key', placeholder: 'sk-...', type: 'password' },
                { key: 'base_url', label: '接口地址', placeholder: '例如：https://api.openai.com/v1' },
                { key: 'model', label: '模型名称', placeholder: '例如：gpt-4o' },
              ].map(field => (
                <div key={field.key}>
                  <label className="text-xs font-medium text-text-secondary mb-1 block">{field.label}</label>
                  <input
                    className="w-full px-3 py-2.5 border border-[#e4e1eb] rounded-lg text-sm outline-none focus:border-[#3730a3] focus:ring-2 focus:ring-[#3730a3]/10"
                    type={field.type || 'text'}
                    placeholder={field.placeholder}
                    value={form[field.key]}
                    onChange={e => setForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-lg text-sm bg-[#f0ecf6] hover:bg-[#e4e1eb]">
                  取消
                </button>
                <button onClick={handleCreate} className="px-5 py-2.5 rounded-lg text-sm bg-[#3730a3] text-white hover:opacity-90">
                  保存
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-[#fcf8ff]/90 backdrop-blur-sm border-t border-[#e4e1eb] py-4">
        <div className="max-w-[840px] mx-auto px-6">
          <button className="w-full py-3 rounded-lg border border-[#e4e1eb] text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#f0ecf6]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            测试所有连接
          </button>
        </div>
      </footer>
    </div>
  );
}
