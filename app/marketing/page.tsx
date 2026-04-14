'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, AlertTriangle, Calendar, ChevronRight, Tag } from 'lucide-react'
import { Client, Grade } from '@/lib/types'
import ClientDetailModal from '@/components/ClientDetailModal'
import { daysUntil, isOverdue, formatDate } from '@/lib/notion'

export default function MarketingPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [filteredClients, setFilteredClients] = useState<Client[]>([])
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedGrade, setSelectedGrade] = useState<Grade | 'all'>('A級')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchClients()
  }, [])

  const fetchClients = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const res = await fetch('/api/clients')
      if (res.ok) {
        const data = await res.json()
        setClients(data)
        filterClients(data, searchTerm, selectedGrade, selectedTag)
      } else {
        const errData = await res.json().catch(() => ({}))
        setError(errData.error || '無法載入客戶資料')
      }
    } catch (err) {
      setError('網路錯誤，請稍後再試')
    } finally {
      setIsLoading(false)
    }
  }

  // 依首字母比對，兼容 Notion 選項為 'A'、'A級'、'A 級' 等寫法
  const gradeMatches = (clientGrade: string | undefined, target: Grade | 'all') => {
    if (target === 'all') return true
    if (!clientGrade) return false
    return clientGrade.trim().charAt(0).toUpperCase() === target.charAt(0)
  }

  const filterClients = (
    clientsList: Client[],
    search: string,
    grade: Grade | 'all',
    tag: string | null
  ) => {
    let filtered = clientsList

    if (search) {
      const lower = search.toLowerCase()
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(lower) ||
          c.phone?.includes(search) ||
          c.area?.toLowerCase().includes(lower)
      )
    }

    filtered = filtered.filter((c) => gradeMatches(c.grade, grade))

    if (tag) {
      filtered = filtered.filter((c) => c.needTags?.includes(tag))
    }

    filtered.sort((a, b) => {
      const aOverdue = isOverdue(a.nextFollowUp)
      const bOverdue = isOverdue(b.nextFollowUp)
      if (aOverdue && !bOverdue) return -1
      if (!aOverdue && bOverdue) return 1
      return daysUntil(a.nextFollowUp) - daysUntil(b.nextFollowUp)
    })

    setFilteredClients(filtered)
  }

  const handleSearch = (term: string) => {
    setSearchTerm(term)
    filterClients(clients, term, selectedGrade, selectedTag)
  }

  const handleGradeFilter = (grade: Grade | 'all') => {
    setSelectedGrade(grade)
    filterClients(clients, searchTerm, grade, selectedTag)
  }

  const handleTagFilter = (tag: string | null) => {
    const next = tag === selectedTag ? null : tag
    setSelectedTag(next)
    filterClients(clients, searchTerm, selectedGrade, next)
  }

  const handleOpenClient = (client: Client) => {
    setSelectedClient(client)
    setIsModalOpen(true)
  }

  const handleSaveClient = async (updatedClient: Client) => {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/clients/${updatedClient.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedClient),
      })

      if (res.ok) {
        setClients((prev) =>
          prev.map((c) => (c.id === updatedClient.id ? updatedClient : c))
        )
        filterClients(
          clients.map((c) =>
            c.id === updatedClient.id ? updatedClient : c
          ),
          searchTerm,
          selectedGrade,
          selectedTag
        )
        setIsModalOpen(false)
      }
    } finally {
      setIsSaving(false)
    }
  }

  // 蒐集所有出現過的需求標籤（去重、排序）
  const allTags = useMemo(() => {
    const set = new Set<string>()
    clients.forEach((c) => c.needTags?.forEach((t) => set.add(t)))
    return Array.from(set).sort()
  }, [clients])

  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-6 max-w-md mx-auto">
          <AlertTriangle className="text-red-400 mx-auto mb-3" size={32} />
          <p className="text-red-300 font-semibold mb-2">載入失敗</p>
          <p className="text-sm text-red-200 mb-4">{error}</p>
          <button
            onClick={fetchClients}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors"
          >
            重試
          </button>
        </div>
      </div>
    )
  }

  const overdueClients = filteredClients.filter((c) =>
    isOverdue(c.nextFollowUp)
  )

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Overdue Alert */}
      {overdueClients.length > 0 && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 flex gap-3">
          <AlertTriangle className="text-red-400 flex-shrink-0" size={20} />
          <div>
            <p className="font-semibold text-red-300">逾期跟進提醒</p>
            <p className="text-sm text-red-200">
              有 {overdueClients.length} 位客戶的跟進已逾期
            </p>
          </div>
        </div>
      )}

      {/* Search and Grade Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search
            className="absolute left-3 top-3 text-slate-500"
            size={20}
          />
          <input
            type="text"
            placeholder="搜尋客戶名稱、電話或區域..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div className="flex gap-2">
          {(['A級', 'B級', 'C級', 'all'] as const).map((grade) => (
            <button
              key={grade}
              onClick={() => handleGradeFilter(grade)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                selectedGrade === grade
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
              }`}
            >
              {grade === 'all' ? '全部' : grade}
            </button>
          ))}
        </div>
      </div>

      {/* Tag Filter */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Tag className="text-slate-500" size={16} />
          <span className="text-xs text-slate-500 mr-1">需求標籤：</span>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => handleTagFilter(tag)}
              className={`px-3 py-1 rounded-full text-xs transition-colors ${
                selectedTag === tag
                  ? 'bg-pink-600 text-white'
                  : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-pink-500 hover:text-pink-300'
              }`}
            >
              {tag}
            </button>
          ))}
          {selectedTag && (
            <button
              onClick={() => handleTagFilter(null)}
              className="text-xs text-slate-500 hover:text-slate-300 underline ml-1"
            >
              清除
            </button>
          )}
        </div>
      )}

      {/* Clients Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-400">載入中...</div>
      ) : filteredClients.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          {clients.length === 0 ? '沒有客戶資料' : '沒有符合條件的客戶'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client) => {
            const daysUntilFollowUp = daysUntil(client.nextFollowUp)
            const isOverdueFollowUp = isOverdue(client.nextFollowUp)

            return (
              <div
                key={client.id}
                onClick={() => handleOpenClient(client)}
                className="bg-slate-800 border border-slate-700 rounded-lg p-4 hover:border-indigo-500 transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-white group-hover:text-indigo-400 transition-colors">
                      {client.name}
                    </h3>
                    <p className="text-sm text-slate-400">{client.grade}</p>
                  </div>
                  <ChevronRight
                    className="text-slate-600 group-hover:text-indigo-400 transition-colors"
                    size={20}
                  />
                </div>

                {client.phone && (
                  <p className="text-sm text-slate-300 mb-2">
                    📱 {client.phone}
                  </p>
                )}
                {client.area && (
                  <p className="text-sm text-slate-300 mb-3">
                    📍 {client.area}
                  </p>
                )}

                {client.nextFollowUp && (
                  <div
                    className={`text-xs p-2 rounded flex items-center gap-2 ${
                      isOverdueFollowUp
                        ? 'bg-red-900/30 text-red-300'
                        : daysUntilFollowUp <= 3
                        ? 'bg-amber-900/30 text-amber-300'
                        : 'bg-slate-700/50 text-slate-300'
                    }`}
                  >
                    <Calendar size={14} />
                    {isOverdueFollowUp
                      ? `逾期 ${Math.abs(daysUntilFollowUp)} 天`
                      : `${daysUntilFollowUp} 天後`}
                  </div>
                )}

                {client.progress && (
                  <p className="text-xs text-slate-400 mt-3 line-clamp-2">
                    {client.progress}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      <ClientDetailModal
        client={selectedClient}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveClient}
      />
    </div>
  )
}
