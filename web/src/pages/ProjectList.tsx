import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface Project {
  id: string
  title: string
  status: string
  created_at: string
}

export default function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then(data => { setProjects(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function createProject() {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '新演示文稿' }),
    })
    const project = await res.json()
    navigate(`/project/${project.id}`)
  }

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-white">我的演示文稿</h1>
          <button
            onClick={createProject}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors"
          >
            + 新建 PPT
          </button>
        </div>

        {loading ? (
          <div className="text-slate-400 text-center py-20">加载中...</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-slate-500 text-lg mb-4">还没有任何演示文稿</div>
            <button
              onClick={createProject}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors"
            >
              创建第一个 PPT
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(project => (
              <div
                key={project.id}
                onClick={() => navigate(`/project/${project.id}`)}
                className="bg-slate-800 border border-slate-700 rounded-xl p-5 cursor-pointer hover:border-indigo-500 transition-colors group"
              >
                <div className="aspect-video bg-slate-700 rounded-lg mb-3 flex items-center justify-center">
                  <span className="text-slate-500 text-sm">预览</span>
                </div>
                <h3 className="text-white font-medium group-hover:text-indigo-300 transition-colors">
                  {project.title}
                </h3>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-slate-500">
                    {new Date(project.created_at).toLocaleDateString()}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    project.status === 'completed' ? 'bg-green-900 text-green-300' :
                    project.status === 'generating' ? 'bg-yellow-900 text-yellow-300' :
                    'bg-slate-700 text-slate-400'
                  }`}>
                    {project.status === 'completed' ? '已完成' :
                     project.status === 'generating' ? '生成中' : '草稿'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
