'use client'

import { useCallback, useEffect, useState } from 'react'
import { Eye } from 'lucide-react'
import type { Viewing, Conversation } from '@/lib/types'
import ViewingCard from './ViewingCard'
import ConversationCard from './ConversationCard'

interface Props {
  clientId: string
}

type ViewingCardItem = { type: 'viewing'; data: Viewing }
type ConversationCardItem = { type: 'conversation'; data: Conversation }
type CardItem = ViewingCardItem | ConversationCardItem

// 排序三層：🟣 帶看喜歡置頂 → 🟠 洽談重要次頂 → 其餘（預設帶看 + ⚫不喜歡 + 非重要洽談）按日期新到舊
function cardRank(c: CardItem): number {
  if (c.type === 'viewing' && c.data.opinion === 'liked') return 0
  if (c.type === 'conversation' && c.data.is_important) return 1
  return 2
}

function sortCards(cards: CardItem[]): CardItem[] {
  return [...cards].sort((a, b) => {
    const ra = cardRank(a)
    const rb = cardRank(b)
    if (ra !== rb) return ra - rb

    const aTime = a.type === 'viewing' ? a.data.datetime : a.data.date
    const bTime = b.type === 'viewing' ? b.data.datetime : b.data.date
    const ta = new Date(aTime).getTime() || 0
    const tb = new Date(bTime).getTime() || 0
    return tb - ta
  })
}

export default function ClientViewingsTab({ clientId }: Props) {
  const [viewings, setViewings] = useState<Viewing[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [vRes, cRes] = await Promise.all([
        fetch(`/api/clients/${clientId}/viewings`),
        fetch(`/api/clients/${clientId}/conversations`),
      ])
      if (!vRes.ok) throw new Error('fetch viewings failed')
      if (!cRes.ok) throw new Error('fetch conversations failed')
      const vData: Viewing[] = await vRes.json()
      const cData = await cRes.json()
      setViewings(vData)
      setConversations(cData.conversations || [])
    } catch (err: any) {
      console.error('fetch viewings/conversations failed:', err)
      setError('載入記錄失敗')
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleViewingUpdate = (id: number, patch: Partial<Viewing>) => {
    setViewings((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)))
  }

  const handleViewingDelete = (id: number) => {
    setViewings((prev) => prev.filter((v) => v.id !== id))
  }

  const handleConversationUpdate = (id: number, patch: Partial<Conversation>) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  const handleConversationDelete = (id: number) => {
    setConversations((prev) => prev.filter((c) => c.id !== id))
  }

  if (loading) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 text-center text-sm text-slate-500">
        載入記錄...
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

  const cards: CardItem[] = sortCards([
    ...viewings.map((v): ViewingCardItem => ({ type: 'viewing', data: v })),
    ...conversations.map((c): ConversationCardItem => ({ type: 'conversation', data: c })),
  ])

  if (cards.length === 0) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8 text-center">
        <Eye size={32} className="mx-auto mb-3 text-slate-600" />
        <p className="text-sm text-slate-400">尚無記錄</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center">
        <span className="text-xs text-slate-500">共 {cards.length} 筆（帶看 {viewings.length}、洽談 {conversations.length}）</span>
      </div>
      {cards.map((card) =>
        card.type === 'viewing' ? (
          <ViewingCard
            key={`v-${card.data.id}`}
            viewing={card.data}
            onUpdate={(patch) => handleViewingUpdate(card.data.id, patch)}
            onDelete={() => handleViewingDelete(card.data.id)}
          />
        ) : (
          <ConversationCard
            key={`c-${card.data.id}`}
            conversation={card.data}
            onUpdate={(patch) => handleConversationUpdate(card.data.id, patch)}
            onDelete={() => handleConversationDelete(card.data.id)}
          />
        )
      )}
    </div>
  )
}
