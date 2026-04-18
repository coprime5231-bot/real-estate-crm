'use client'

import { useCallback, useEffect, useState } from 'react'
import { Eye, Plus } from 'lucide-react'
import type { Viewing } from '@/lib/types'
import ViewingCard from './ViewingCard'

interface Props {
  clientId: string
  onOpenAddModal: () => void
}

// 本地排序：🟣 → 預設 → ⚫，同組 datetime DESC。API 已這樣回，但切換 opinion 後需即時重排。
function sortViewings(list: Viewing[]): Viewing[] {
  const weight = (v: Viewing) => (v.opinion === 'liked' ? 0 : v.opinion === 'disliked' ? 2 : 1)
  return [...list].sort((a, b) => {
    const w = weight(a) - weight(b)
    if (w !== 0) return w
    const ta = new Date(a.datetime).getTime() || 0
    const tb = new Date(b.datetime).getTime() || 0
    return tb - ta
  })
}

export default function ClientViewingsTab({ clientId, onOpenAddModal }: Props) {
  const [viewings, setViewings] = useState<Viewing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/clients/${clientId}/viewings`)
      if (!res.ok) throw new Error('fetch failed')
      const data: Viewing[] = await res.json()
      setViewings(sortViewings(data))
    } catch (err: any) {
      console.error('fetch viewings failed:', err)
      setError('載入帶看記錄失敗')
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleUpdate = (id: number, patch: Partial<Viewing>) => {
    setViewings((prev) => {
      const next = prev.map((v) => (v.id === id ? { ...v, ...patch } : v))
      // opinion 變動需要重排；備註變動不需要但重排也無副作用
      return sortViewings(next)
    })
  }

  if (loading) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 text-center text-sm text-slate-500">
        載入帶看記錄...
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-900/10 border border-red-700/30 rounded-lg p-4 text-sm text-red-300">
        {error}
      </div>
    )
  }

  if (viewings.length === 0) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8 text-center">
        <Eye size={32} className="mx-auto mb-3 text-slate-600" />
        <p className="text-sm text-slate-400 mb-3">尚無帶看記錄</p>
        <button
          onClick={onOpenAddModal}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-sky-700 hover:bg-sky-600 text-white rounded-lg transition-colors"
        >
          <Plus size={14} />
          新增帶看
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">共 {viewings.length} 筆</span>
        <button
          onClick={onOpenAddModal}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-sky-700 hover:bg-sky-600 text-white rounded transition-colors"
        >
          <Plus size={12} />
          新增帶看
        </button>
      </div>
      {viewings.map((v) => (
        <ViewingCard
          key={v.id}
          viewing={v}
          onUpdate={(patch) => handleUpdate(v.id, patch)}
        />
      ))}
    </div>
  )
}
