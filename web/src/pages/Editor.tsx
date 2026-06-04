import { useParams, useNavigate } from 'react-router-dom'

export default function Editor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  return (
    <div className="h-screen flex flex-col bg-slate-900">
      <div className="h-14 flex items-center px-4 border-b border-slate-700 gap-3">
        <button onClick={() => navigate(`/project/${id}`)} className="text-slate-400 hover:text-white">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-sm font-medium text-white">手工编辑器</h2>
        <span className="text-xs text-slate-500">(开发中)</span>
      </div>
      <div className="flex-1 flex items-center justify-content-center">
        <div className="text-center text-slate-500 w-full">
          <p className="text-lg">编辑器页面 — 后续实现</p>
          <p className="text-sm mt-2">在这里可以手动修改每一页的内容、模板、主题</p>
        </div>
      </div>
    </div>
  )
}
