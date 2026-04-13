'use client'

import { useEffect, useState } from 'react'
import { Zap, CheckCircle2, Lightbulb, Building2 } from 'lucide-react'
import { AIProject } from '@/lib/types'
import SetupRequired from '@/components/SetupRequired'

export default function AIPage() {
  const [projects, setProjects] = useState<AIProject[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [setupStatus, setSetupStatus] = useState<any>(null)
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'idea' | 'building' | 'done'>('all')

  useEffect(() => {
    fetchSetupStatus()
  }, [])

  const fetchSetupStatus = async () => {
    try {
      const res = await fetch('/api/setup')
      const data = await res.json()
      setSetupStatus(data)

      if (!data.configured) {
        setIsLoading(false)
        return
      }

      fetchProjects()
    } catch (err) {
      setIsLoading(false)
    }
  }

  const fetchProjects = async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/ai-projects')
      if (res.ok) {
        const data = await res.json()
        setProjects(data)
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (!setupStatus) {
    return <div className="p-8 text-center">載入中...</div>
  }

  if (!setupStatus.configured) {
    return <SetupRequired missingIds={setupStatus.missingIds} />
  }

  const filteredProjects =
    selectedStatus === 'all'
      ? projects
      : projects.filter((p) => p.status === selectedStatus)

  const statusConfig = {
    idea: {
      label: '想法',
      icon: Lightbulb,
      color: 'bg-purple-900/20 border-purple-700 text-purple-400',
      badge: 'bg-purple-900 text-purple-200',
    },
    building: {
      label: '開發中',
      icon: Building2,
      color: 'bg-blue-900/20 border-blue-700 text-blue-400',
      badge: 'bg-blue-900 text-blue-200',
    },
    done: {
      label: '已完成',
      icon: CheckCircle2,
      color: 'bg-green-900/20 border-green-700 text-green-400',
      badge: 'bg-green-900 text-green-200',
    },
  }

  const stats = {
    idea: projects.filter((p) => p.status === 'idea').length,
    building: projects.filter((p) => p.status === 'building').length,
    done: projects.filter((p) => p.status === 'done').length,
  }

  const platformColors: Record<string, string> = {
    'N8N': 'bg-orange-900/40 text-orange-300',
    'Claude': 'bg-indigo-900/40 text-indigo-300',
    'GPT': 'bg-green-900/40 text-green-300',
    'API': 'bg-blue-900/40 text-blue-300',
  }

  return (
    <div className="p-4 md:p-8 space-y-8">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(['idea', 'building', 'done'] as const).map((status) => {
          const config = statusConfig[status]
          const Icon = config.icon
          return (
            <div
              key={status}
              className={`rounded-lg p-6 border ${config.color}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{config.label}</p>
                  <p className="text-3xl font-bold mt-2">{stats[status]}</p>
                </div>
                <Icon size={32} className="opacity-50" />
              </div>
            </div>
          )
        })}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(['all', 'idea', 'building', 'done'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setSelectedStatus(status)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              selectedStatus === status
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
            }`}
          >
            {status === 'all'
              ? '全部'
              : statusConfig[status as keyof typeof statusConfig].label}
          </button>
        ))}
      </div>

      {/* Projects Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-400">載入中...</div>
      ) : filteredProjects.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          {projects.length === 0 ? '沒有專案資料' : '沒有符合條件的專案'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => {
            const config = statusConfig[project.status as keyof typeof statusConfig]
            const Icon = config.icon

            return (
              <div
                key={project.id}
                className="bg-slate-800 border border-slate-700 rounded-lg p-6 hover:border-indigo-500 transition-all group"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <h3 className="font-semibold text-white group-hover:text-indigo-400 transition-colors flex-1 line-clamp-2">
                    {project.title}
                  </h3>
                  <Zap size={20} className="text-yellow-400 flex-shrink-0 ml-2" />
                </div>

                {/* Status Badge */}
                <div className="flex items-center gap-2 mb-4">
                  <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${config.badge}`}>
                    <Icon size={16} />
                    {config.label}
                  </span>
                </div>

                {/* Platforms */}
                {project.platforms && project.platforms.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {project.platforms.map((platform) => (
                      <span
                        key={platform}
                        className={`text-xs px-3 py-1 rounded-full font-medium ${
                          platformColors[platform] ||
                          'bg-slate-700/50 text-slate-300'
                        }`}
                      >
                        {platform}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
