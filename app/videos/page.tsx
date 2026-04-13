'use client'

import { useEffect, useState } from 'react'
import { Video, TrendingUp, Clock, CheckCircle2 } from 'lucide-react'
import { VideoIdea } from '@/lib/types'
import SetupRequired from '@/components/SetupRequired'

export default function VideosPage() {
  const [videos, setVideos] = useState<VideoIdea[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [setupStatus, setSetupStatus] = useState<any>(null)
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'planning' | 'filming' | 'published'>('all')

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

      fetchVideos()
    } catch (err) {
      setIsLoading(false)
    }
  }

  const fetchVideos = async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/videos')
      if (res.ok) {
        const data = await res.json()
        setVideos(data)
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

  const filteredVideos =
    selectedStatus === 'all'
      ? videos
      : videos.filter((v) => v.status === selectedStatus)

  const statusConfig = {
    planning: {
      label: '企劃中',
      icon: Clock,
      color: 'bg-amber-900/20 border-amber-700 text-amber-400',
      badge: 'bg-amber-900 text-amber-200',
    },
    filming: {
      label: '製作中',
      icon: Video,
      color: 'bg-blue-900/20 border-blue-700 text-blue-400',
      badge: 'bg-blue-900 text-blue-200',
    },
    published: {
      label: '已發布',
      icon: CheckCircle2,
      color: 'bg-green-900/20 border-green-700 text-green-400',
      badge: 'bg-green-900 text-green-200',
    },
  }

  const stats = {
    planning: videos.filter((v) => v.status === 'planning').length,
    filming: videos.filter((v) => v.status === 'filming').length,
    published: videos.filter((v) => v.status === 'published').length,
  }

  return (
    <div className="p-4 md:p-8 space-y-8">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(['planning', 'filming', 'published'] as const).map((status) => {
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
        {(['all', 'planning', 'filming', 'published'] as const).map((status) => (
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

      {/* Videos Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-400">載入中...</div>
      ) : filteredVideos.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          {videos.length === 0 ? '沒有影片資料' : '沒有符合條件的影片'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVideos.map((video) => {
            const config = statusConfig[video.status as keyof typeof statusConfig]
            const Icon = config.icon

            return (
              <div
                key={video.id}
                className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden hover:border-indigo-500 transition-all group"
              >
                {/* Thumbnail */}
                <div className="aspect-video bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center group-hover:from-indigo-700 group-hover:to-purple-700 transition-all">
                  <Video size={48} className="text-slate-600 group-hover:text-slate-400" />
                </div>

                {/* Content */}
                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-white group-hover:text-indigo-400 transition-colors flex-1">
                      {video.title}
                    </h3>
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center gap-2 mb-4">
                    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${config.badge}`}>
                      <Icon size={16} />
                      {config.label}
                    </span>
                  </div>

                  {/* View Count */}
                  <div className="flex items-center gap-2 text-slate-300">
                    <TrendingUp size={16} className="text-indigo-400" />
                    <span className="text-sm">
                      {video.viewCount?.toLocaleString() || '0'} 次瀏覽
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
