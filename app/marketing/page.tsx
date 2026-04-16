'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Search,
  AlertTriangle,
  Calendar,
  ChevronRight,
  Star,
  CheckSquare,
  Square,
  Plus,
  ExternalLink,
  Users,
  FileText,
  Video,
  Zap,
  Clock,
} from 'lucide-react'
import { Client, Grade, ImportantItem, TodoItem, Block } from '@/lib/types'
import { daysUntil, isOverdue, formatDate } from '@/lib/notion'
import VideosPage from '@/app/videos/page'
import AIPage from '@/app/ai/page'

type Tab = 'marketing' | 'entrust' | 'videos' | 'ai'

export default function MarketingPage() {
  // === 首頁資料 ===
  const [importantItems, setImportantItems] = useState<ImportantItem[]>([])
  const [todoItems, setTodoItems] = useState<TodoItem[]>([])
  const [loadingDashboard, setLoadingDashboard] = useState(true)

  // === Tab 狀態 ===
  const [activeTab, setActiveTab] = useState<Tab>('marketing')

  // === 行銷分區狀態 ===
  const [clients, setClients] = useState<Client[]>([])
  const [selectedGrade, setSelectedGrade] = useState<Grade | 'all'>('A級')
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoadingClients, setIsLoadingClients] = useState(true)

  // === 右側詳情面板狀態 ===
  const [clientImportantItems, setClientImportantItems] = useState<ImportantItem[]>([])
  const [clientTodos, setClientTodos] = useState<any[]>([])
  const [clientBlocks, setClientBlocks] = useState<Block[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  // === 輸入欄位 ===
  const [newImportantText, setNewImportantText] = useState('')
  const [newTodoText, setNewTodoText] = useState('')
  const [newTodoDate, setNewTodoDate] = useState('')
  const [newProgressText, setNewProgressText] = useState('')
  const [submitting, setSubmitting] = useState<string | null>(null)

  const progressInputRef = useRef<HTMLInputElement>(null)

  // ===================== 資料載入 =====================

  const fetchDashboard = useCallback(async () => {
    setLoadingDashboard(true)
    try {
      const [impRes, todoRes] = await Promise.all([
        fetch('/api/important-items'),
        fetch('/api/todo-items'),
      ])
      if (impRes.ok) setImportantItems(await impRes.json())
      if (todoRes.ok) setTodoItems(await todoRes.json())
    } catch (err) {
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoadingDashboard(false)
    }
  }, [])

  const fetchClients = useCallback(async () => {
    setIsLoadingClients(true)
    try {
      const res = await fetch('/api/clients')
      if (res.ok) setClients(await res.json())
    } catch (err) {
      console.error('Clients fetch error:', err)
    } finally {
      setIsLoadingClients(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboard()
    fetchClients()
  }, [fetchDashboard, fetchClients])

  // 選中客戶時載入詳情
  const fetchClientDetail = useCallback(async (clientId: string) => {
    setLoadingDetail(true)
    try {
      const [todosRes, blocksRes] = await Promise.all([
        fetch(`/api/clients/${clientId}/todos`),
        fetch(`/api/clients/${clientId}/blocks`),
      ])
      if (todosRes.ok) setClientTodos(await todosRes.json())
      if (blocksRes.ok) setClientBlocks(await blocksRes.json())

      // 從全域重要事項中篩選該客戶的
      setClientImportantItems(importantItems.filter((i) => i.clientId === clientId))
    } catch (err) {
      console.error('Client detail fetch error:', err)
    } finally {
      setLoadingDetail(false)
    }
  }, [importantItems])

  useEffect(() => {
    if (selectedClientId) {
      fetchClientDetail(selectedClientId)
    }
  }, [selectedClientId, fetchClientDetail])

  // ===================== 篩選與排序 =====================

  const gradeMatches = (clientGrade: string | undefined, target: Grade | 'all') => {
    if (target === 'all') return true
    if (!clientGrade) return false
    return clientGrade.trim().charAt(0).toUpperCase() === target.charAt(0)
  }

  const filteredClients = useMemo(() => {
    let filtered = clients

    if (searchTerm) {
      const lower = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(lower) ||
          c.phone?.includes(searchTerm) ||
          c.area?.toLowerCase().includes(lower)
      )
    }

    filtered = filtered.filter((c) => gradeMatches(c.grade, selectedGrade))

    filtered.sort((a, b) => {
      const aOverdue = isOverdue(a.nextFollowUp)
      const bOverdue = isOverdue(b.nextFollowUp)
      if (aOverdue && !bOverdue) return -1
      if (!aOverdue && bOverdue) return 1
      return daysUntil(a.nextFollowUp) - daysUntil(b.nextFollowUp)
    })

    return filtered
  }, [clients, searchTerm, selectedGrade])

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) || null,
    [clients, selectedClientId]
  )

  // ===================== 操作 =====================

  const handleSelectClient = (clientId: string) => {
    setSelectedClientId(clientId)
    setNewImportantText('')
    setNewTodoText('')
    setNewTodoDate('')
    setNewProgressText('')
  }

  // 點擊首頁事項 → 跳到該客戶
  const handleJumpToClient = (clientId: string, source: string) => {
    if (!clientId) return
    if (source === 'tracking') {
      setActiveTab('entrust')
      return
    }
    setActiveTab('marketing')
    setSelectedGrade('all')
    setSelectedClientId(clientId)
  }

  // 新增重要大事
  const handleAddImportant = async () => {
    if (!newImportantText.trim() || !selectedClientId) return
    setSubmitting('important')
    try {
      const res = await fetch('/api/important-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newImportantText.trim(),
          clientId: selectedClientId,
          clientName: selectedClient?.name,
          source: 'buyer',
        }),
      })
      if (res.ok) {
        const item = await res.json()
        setClientImportantItems((prev) => [...prev, item])
        setImportantItems((prev) => [...prev, item])
        setNewImportantText('')
      }
    } finally {
      setSubmitting(null)
    }
  }

  // 新增待辦
  const handleAddTodo = async () => {
    if (!newTodoText.trim() || !selectedClientId) return
    setSubmitting('todo')
    try {
      const res = await fetch(`/api/clients/todos?id=${selectedClientId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTodoText.trim() }),
      })
      if (res.ok) {
        const todo = await res.json()
        setClientTodos((prev) => [todo, ...prev])
        setNewTodoText('')
        setNewTodoDate('')
        fetchDashboard() // 重新載入首頁待辦
      }
    } finally {
      setSubmitting(null)
    }
  }

  // 切換待辦完成
  const handleToggleTodo = async (todoId: string, currentFlag: boolean) => {
    try {
      await fetch(`/api/clients/todos/${todoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ todoFlag: !currentFlag }),
      })
      setClientTodos((prev) =>
        prev.map((t) => (t.id === todoId ? { ...t, todoFlag: !currentFlag } : t))
      )
      // 也更新首頁待辦
      if (currentFlag) {
        // 標記為完成（todoFlag false）
        setTodoItems((prev) => prev.filter((t) => t.id !== todoId))
      }
    } catch (err) {
      console.error('Toggle todo error:', err)
    }
  }

  // 切換首頁待辦完成
  const handleToggleDashboardTodo = async (todoId: string) => {
    try {
      await fetch(`/api/clients/todos/${todoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ todoFlag: false }),
      })
      setTodoItems((prev) => prev.filter((t) => t.id !== todoId))
    } catch (err) {
      console.error('Toggle dashboard todo error:', err)
    }
  }

  // 新增進度
  const handleAddProgress = async () => {
    if (!newProgressText.trim() || !selectedClientId) return
    setSubmitting('progress')
    try {
      const res = await fetch(`/api/clients/${selectedClientId}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newProgressText.trim() }),
      })
      if (res.ok) {
        const block = await res.json()
        setClientBlocks((prev) => [block, ...prev])
        setNewProgressText('')
      }
    } finally {
      setSubmitting(null)
    }
  }

  // 標記重要大事完成
  const handleCompleteImportant = async (itemId: string) => {
    try {
      await fetch(`/api/important-items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'done' }),
      })
      setClientImportantItems((prev) => prev.filter((i) => i.id !== itemId))
      setImportantItems((prev) => prev.filter((i) => i.id !== itemId))
    } catch (err) {
      console.error('Complete important error:', err)
    }
  }

  // 鍵盤快捷鍵
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeTab !== 'marketing') return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        const currentIndex = filteredClients.findIndex((c) => c.id === selectedClientId)
        let nextIndex: number
        if (e.key === 'ArrowUp') {
          nextIndex = currentIndex <= 0 ? filteredClients.length - 1 : currentIndex - 1
        } else {
          nextIndex = currentIndex >= filteredClients.length - 1 ? 0 : currentIndex + 1
        }
        if (filteredClients[nextIndex]) {
          handleSelectClient(filteredClients[nextIndex].id)
        }
      }

      if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault()
        progressInputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTab, filteredClients, selectedClientId])

  // ===================== 統計 =====================

  const todayTodoCount = todoItems.length
  const overdueCount = 0 // 待辦 DB 沒有日期欄位，暫不計算逾期
  const importantCount = importantItems.length

  // ===================== Render =====================

  return (
    <div className="min-h-screen bg-slate-900">
      {/* ===== 頂部儀表板 ===== */}
      <div className="border-b border-slate-700 bg-slate-900/80 backdrop-blur">
        {/* 統計 badge */}
        <div className="max-w-7xl mx-auto px-6 pt-5 pb-3">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-400">
              今日待辦 <span className="text-white font-bold">{todayTodoCount}</span> 件
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">
              重要事項 <span className="text-white font-bold">{importantCount}</span> 件
            </span>
          </div>
        </div>

        {/* 兩大欄 */}
        <div className="max-w-7xl mx-auto px-6 pb-5">
          <div className="grid grid-cols-2 gap-6">
            {/* 近期重要事項 */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 max-h-48 overflow-y-auto">
              <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <Star size={14} className="text-amber-400" />
                近期重要事項
              </h3>
              {loadingDashboard ? (
                <p className="text-xs text-slate-500">載入中...</p>
              ) : importantItems.length === 0 ? (
                <p className="text-xs text-slate-500">目前沒有重要事項 👍</p>
              ) : (
                <div className="space-y-2">
                  {importantItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleJumpToClient(item.clientId, item.source)}
                      className="text-sm text-slate-300 hover:text-indigo-400 cursor-pointer transition-colors flex items-start gap-2"
                    >
                      <span className="text-indigo-400 font-medium shrink-0">[{item.clientName}]</span>
                      <span className="truncate">{item.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 待辦事項 */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 max-h-48 overflow-y-auto">
              <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <CheckSquare size={14} className="text-green-400" />
                待辦事項
              </h3>
              {loadingDashboard ? (
                <p className="text-xs text-slate-500">載入中...</p>
              ) : todoItems.length === 0 ? (
                <p className="text-xs text-slate-500">目前沒有待辦事項 👍</p>
              ) : (
                <div className="space-y-2">
                  {todoItems.map((item) => (
                    <div key={item.id} className="flex items-start gap-2 text-sm group">
                      <button
                        onClick={() => handleToggleDashboardTodo(item.id)}
                        className="mt-0.5 text-slate-500 hover:text-green-400 transition-colors shrink-0"
                      >
                        <Square size={14} />
                      </button>
                      <div
                        onClick={() => handleJumpToClient(item.clientId, item.source)}
                        className="flex-1 cursor-pointer hover:text-indigo-400 transition-colors"
                      >
                        <span className="text-indigo-400 font-medium">[{item.clientName}]</span>{' '}
                        <span className="text-slate-300">{item.title}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===== 四大分區 Tab ===== */}
      <div className="border-b border-slate-700 bg-slate-800/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1">
            {([
              { key: 'marketing', label: '行銷', icon: Users },
              { key: 'entrust', label: '委託', icon: FileText },
              { key: 'videos', label: '短影音', icon: Video },
              { key: 'ai', label: 'AI', icon: Zap },
            ] as const).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all border-b-2 ${
                  activeTab === key
                    ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-600'
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ===== Tab 內容 ===== */}
      <div className="max-w-7xl mx-auto">
        {/* --- 行銷 Tab --- */}
        {activeTab === 'marketing' && (
          <div>
            {/* 等級篩選 + 搜尋 */}
            <div className="px-6 py-4 border-b border-slate-700 flex items-center gap-4">
              <div className="flex gap-2">
                {(['A級', 'B級', 'C級', 'all'] as const).map((grade) => (
                  <button
                    key={grade}
                    onClick={() => setSelectedGrade(grade)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      selectedGrade === grade
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    {grade === 'all' ? '全部' : grade}
                  </button>
                ))}
              </div>
              <div className="flex-1 relative max-w-xs">
                <Search className="absolute left-3 top-2 text-slate-500" size={16} />
                <input
                  type="text"
                  placeholder="搜尋客戶..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <span className="text-xs text-slate-500">{filteredClients.length} 位客戶</span>
            </div>

            {/* 左側列表 + 右側詳情 */}
            <div className="flex" style={{ height: 'calc(100vh - 340px)' }}>
              {/* 左側邊欄 */}
              <div className="w-[280px] shrink-0 border-r border-slate-700 overflow-y-auto">
                {isLoadingClients ? (
                  <div className="p-6 text-center text-slate-500 text-sm">載入中...</div>
                ) : filteredClients.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-sm">沒有符合條件的客戶</div>
                ) : (
                  filteredClients.map((client) => {
                    const isSelected = client.id === selectedClientId
                    const overdue = isOverdue(client.nextFollowUp)
                    const days = daysUntil(client.nextFollowUp)
                    const gradeColor =
                      client.grade?.charAt(0) === 'A'
                        ? 'bg-green-900/50 text-green-300 border-green-700'
                        : client.grade?.charAt(0) === 'B'
                        ? 'bg-blue-900/50 text-blue-300 border-blue-700'
                        : 'bg-slate-700/50 text-slate-400 border-slate-600'

                    return (
                      <div
                        key={client.id}
                        onClick={() => handleSelectClient(client.id)}
                        className={`px-4 py-3 cursor-pointer transition-all border-l-3 ${
                          isSelected
                            ? 'bg-indigo-900/20 border-l-indigo-500 border-l-[3px]'
                            : 'border-l-transparent border-l-[3px] hover:bg-slate-800/50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-white text-sm">{client.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${gradeColor}`}>
                            {client.grade || '-'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          {client.nextFollowUp && (
                            <span className={overdue ? 'text-red-400' : days <= 3 ? 'text-amber-400' : ''}>
                              <Calendar size={10} className="inline mr-1" />
                              {overdue ? `逾期 ${Math.abs(days)} 天` : `${days} 天後`}
                            </span>
                          )}
                          {client.area && <span>{client.area}</span>}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* 右側詳情面板 */}
              <div className="flex-1 overflow-y-auto">
                {!selectedClient ? (
                  <div className="flex items-center justify-center h-full text-slate-500">
                    <div className="text-center">
                      <Users size={48} className="mx-auto mb-3 opacity-30" />
                      <p>選擇左側客戶查看詳情</p>
                      <p className="text-xs mt-1">使用 ↑↓ 快捷鍵切換，Tab 跳到進度輸入</p>
                    </div>
                  </div>
                ) : loadingDetail ? (
                  <div className="flex items-center justify-center h-full text-slate-500">
                    載入中...
                  </div>
                ) : (
                  <div className="p-6 space-y-6">
                    {/* 客戶標頭 */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-bold text-white">{selectedClient.name}</h2>
                        <div className="flex items-center gap-3 text-sm text-slate-400 mt-1">
                          {selectedClient.phone && <span>📱 {selectedClient.phone}</span>}
                          {selectedClient.area && <span>📍 {selectedClient.area}</span>}
                          {selectedClient.grade && <span>{selectedClient.grade}</span>}
                        </div>
                      </div>
                      {/* ⑤ 開啟 Notion */}
                      <a
                        href={`https://www.notion.so/${selectedClient.id.replace(/-/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
                      >
                        <ExternalLink size={14} />
                        開啟 Notion
                      </a>
                    </div>

                    {/* ① 重要大事 */}
                    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
                        <Star size={14} />
                        重要大事
                      </h3>
                      {clientImportantItems.length === 0 ? (
                        <p className="text-xs text-slate-500 mb-3">目前無重要事項</p>
                      ) : (
                        <div className="space-y-2 mb-3">
                          {clientImportantItems.map((item) => (
                            <div key={item.id} className="flex items-center justify-between text-sm">
                              <span className="text-slate-300">{item.title}</span>
                              <button
                                onClick={() => handleCompleteImportant(item.id)}
                                className="text-xs text-slate-500 hover:text-green-400 transition-colors"
                                title="標記完成"
                              >
                                完成
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="新增重要大事..."
                          value={newImportantText}
                          onChange={(e) => setNewImportantText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddImportant()}
                          className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          onClick={handleAddImportant}
                          disabled={submitting === 'important' || !newImportantText.trim()}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm rounded transition-colors"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>

                    {/* ② 待辦事項 */}
                    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-green-400 mb-3 flex items-center gap-2">
                        <CheckSquare size={14} />
                        待辦事項
                      </h3>
                      {clientTodos.length === 0 ? (
                        <p className="text-xs text-slate-500 mb-3">目前無待辦事項</p>
                      ) : (
                        <div className="space-y-2 mb-3">
                          {clientTodos.map((todo) => (
                            <div key={todo.id} className="flex items-center gap-2 text-sm">
                              <button
                                onClick={() => handleToggleTodo(todo.id, todo.todoFlag)}
                                className="text-slate-500 hover:text-green-400 transition-colors shrink-0"
                              >
                                {todo.todoFlag ? <Square size={14} /> : <CheckSquare size={14} className="text-green-500" />}
                              </button>
                              <span className={todo.todoFlag ? 'text-slate-300' : 'text-slate-500 line-through'}>
                                {todo.title}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="新增待辦..."
                          value={newTodoText}
                          onChange={(e) => setNewTodoText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddTodo()}
                          className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                        />
                        <input
                          type="date"
                          value={newTodoDate}
                          onChange={(e) => setNewTodoDate(e.target.value)}
                          className="bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-400 focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          onClick={handleAddTodo}
                          disabled={submitting === 'todo' || !newTodoText.trim()}
                          className="px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm rounded transition-colors"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>

                    {/* ③ 之前進度 */}
                    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
                        <Clock size={14} />
                        之前進度
                      </h3>
                      {clientBlocks.length === 0 ? (
                        <p className="text-xs text-slate-500">尚無進度記錄</p>
                      ) : (
                        <div className="space-y-2">
                          {clientBlocks.map((block) => (
                            <p key={block.id} className="text-sm text-slate-400">
                              {block.text}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* ④ 目前進度 */}
                    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-indigo-400 mb-3">目前進度</h3>
                      <div className="flex gap-2">
                        <input
                          ref={progressInputRef}
                          type="text"
                          placeholder="輸入今天的進度..."
                          value={newProgressText}
                          onChange={(e) => setNewProgressText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddProgress()}
                          className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          onClick={handleAddProgress}
                          disabled={submitting === 'progress' || !newProgressText.trim()}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm rounded transition-colors"
                        >
                          {submitting === 'progress' ? '送出中...' : '送出'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- 委託 Tab --- */}
        {activeTab === 'entrust' && (
          <div className="flex items-center justify-center py-24 text-slate-500">
            <div className="text-center">
              <FileText size={48} className="mx-auto mb-3 opacity-30" />
              <p className="text-lg">委託管理</p>
              <p className="text-sm mt-1">開發中，敬請期待</p>
            </div>
          </div>
        )}

        {/* --- 短影音 Tab --- */}
        {activeTab === 'videos' && <VideosPage />}

        {/* --- AI Tab --- */}
        {activeTab === 'ai' && <AIPage />}
      </div>
    </div>
  )
}
