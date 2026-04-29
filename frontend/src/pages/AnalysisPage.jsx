import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useNotesStore } from '../stores/notesStore';
import Markdown from 'react-markdown';

function Accordion({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-[#f6f2fc] rounded-lg mb-2 overflow-hidden">
      <div className="px-4 py-3.5 flex justify-between items-center cursor-pointer hover:bg-[#f0ecf6]" onClick={() => setOpen(!open)}>
        <span className="text-sm font-medium">{title}</span>
        <button className="text-text-muted text-lg transition-transform" style={{ transform: open ? 'rotate(180deg)' : '' }}>−</button>
      </div>
      {open && <div className="px-4 pb-3.5 text-sm">{children}</div>}
    </div>
  );
}

export function AnalysisPage() {
  const { id } = useParams();
  const { fetchNote, currentNote } = useNotesStore();
  const [loading, setLoading] = useState(true);
  const [analysisText, setAnalysisText] = useState('');

  useEffect(() => {
    fetchNote(id).then(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-[840px] mx-auto px-6 py-20 text-center">
        <div className="animate-pulse text-text-muted">AI 正在分析中...</div>
      </div>
    );
  }

  const result = currentNote?.analysis_result;
  const isPromptAnalysis = result?.type === 'prompt_analysis' || result?.role_setting;

  return (
    <div className="max-w-[840px] mx-auto px-6">
      {/* Header */}
      <header className="py-4 flex items-center justify-between border-b border-[#e4e1eb] sticky top-0 bg-[#fcf8ff]/90 backdrop-blur-sm z-10">
        <div className="flex items-center gap-3">
          <Link to={`/editor/${id}`} className="w-9 h-9 rounded-lg hover:bg-[#f0ecf6] flex items-center justify-center text-text-secondary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
          </Link>
          <span className="text-base font-semibold">AI 分析结果</span>
        </div>
        <button className="w-7 h-7 rounded-md bg-[#f0ecf6] flex items-center justify-center text-text-secondary hover:bg-[#e4e1eb]" title="语音朗读">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 010 7.07"/></svg>
        </button>
      </header>

      {/* Note reference */}
      <div className="my-4 p-4 bg-[#f6f2fc] rounded-lg border-l-[3px] border-[#3730a3] text-sm text-text-secondary">
        <div className="font-medium text-text mb-1">{currentNote?.title}</div>
        {currentNote?.content?.slice(0, 120)}{currentNote?.content?.length > 120 ? '...' : ''}
      </div>

      {/* Analysis sections */}
      <div className="py-6">
        {isPromptAnalysis ? (
          <>
            {/* Prompt analysis */}
            <div className="mb-6 text-sm font-semibold text-text-secondary">提示词结构化分析</div>
            {[
              { label: '角色设定', content: result?.role_setting },
              { label: '任务描述', content: result?.task_description },
              { label: '输出格式', content: result?.output_format },
            ].map(item => item.content && (
              <div key={item.label} className="bg-white rounded-lg p-4 mb-2 border-l-2 border-[#3730a3] shadow-sm">
                <div className="text-xs font-medium text-[#3730a3] mb-2">{item.label}</div>
                <div className="text-sm leading-relaxed">{item.content}</div>
              </div>
            ))}

            {/* Suggestions */}
            {result?.suggestions?.length > 0 && (
              <>
                <div className="my-6 text-sm font-semibold text-text-secondary">优化建议</div>
                {result.suggestions.map((s, i) => (
                  <Accordion key={i} title={`${i + 1}. ${s.slice(0, 30)}...`}>
                    <div className="leading-relaxed">{s}</div>
                  </Accordion>
                ))}
              </>
            )}

            {/* Improved version */}
            {result?.improved_version && (
              <>
                <div className="my-6 text-sm font-semibold text-text-secondary">改进版本</div>
                <div className="bg-[#f6f2fc] rounded-lg p-4 border-l-[3px] border-[#3730a3]">
                  <div className="text-xs font-medium text-[#3730a3] mb-2">优化后的提示词</div>
                  <div className="text-sm leading-relaxed whitespace-pre-wrap">{result.improved_version}</div>
                </div>
              </>
            )}
          </>
        ) : (
          /* Translation analysis or raw */
          <>
            <div className="mb-6 text-sm font-semibold text-text-secondary">翻译分析</div>
            {result?.translation_table && (
              <div className="bg-white rounded-lg p-4 mb-2 border-l-2 border-[#3730a3] shadow-sm">
                <div className="text-xs font-medium text-[#3730a3] mb-3">逐词翻译表</div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-text-muted border-b border-[#e4e1eb]">
                      <th className="text-left py-2 px-3 font-medium">单词</th>
                      <th className="text-left py-2 px-3 font-medium">翻译</th>
                      <th className="text-left py-2 px-3 font-medium">词性</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.translation_table.map((row, i) => (
                      <tr key={i} className="border-b border-[#f0ecf6]">
                        <td className="py-2 px-3 font-mono">{row.word}</td>
                        <td className="py-2 px-3">{row.translation}</td>
                        <td className="py-2 px-3 text-text-muted">{row.pos}</td>
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
                <div className="my-6 text-sm font-semibold text-text-secondary">改进版本</div>
                <div className="bg-[#f6f2fc] rounded-lg p-4 border-l-[3px] border-[#3730a3]">
                  <div className="text-xs font-medium text-[#3730a3] mb-2">更地道的表达</div>
                  <div className="text-sm leading-relaxed whitespace-pre-wrap">{result.improved_version}</div>
                </div>
              </>
            )}
          </>
        )}

        {/* Raw fallback */}
        {!isPromptAnalysis && !result?.translation_table && result?.raw && (
          <div className="bg-white rounded-lg p-4 border-l-2 border-[#3730a3] shadow-sm">
            <Markdown>{result.raw}</Markdown>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="py-6 flex gap-3 pb-20">
        <Link to={`/editor/${id}`} className="px-5 py-3.5 rounded-lg border border-[#e4e1eb] text-sm font-medium hover:bg-[#f0ecf6]">
          返回编辑
        </Link>
        <Link to={`/chat/${id}`} className="flex-1 py-3.5 rounded-lg bg-[#3730a3] text-white text-sm font-medium hover:opacity-90 flex items-center justify-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          继续追问
        </Link>
      </div>
    </div>
  );
}
