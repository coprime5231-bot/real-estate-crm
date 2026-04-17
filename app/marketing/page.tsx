'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Search,
  AlertTriangle,
  Calendar,
  CalendarPlus,
  Check,
  ChevronDown,
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
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Client, Grade, ImportantItem, TodoItem, Block } from '@/lib/types'
import { daysUntil, isOverdue, formatDate } from '@/lib/notion'
import VideosPage from '@/app/videos/page'
import AIPage from '@/app/ai/page'

type Tab = 'marketing' | 'entrust' | 'videos' | 'ai'

// 從待辦標題中解析日期（格式：尾部的 (M/D) 或 (YYYY/M/D)）
function parseTodoDate(title: string): Date | null {
  const m = title.match(/\((\d{4}\/)?(\d{1,2})\/(\d{1,2})\)\s*$/)
  if (!m) return null
  const year = m[1] ? parseInt(m[1]) : new Date().getFullYear()
  return new Date(year, parseInt(m[2]) - 1, parseInt(m[3]))
}

function isToday(d: Date): boolean {
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

function isPast(d: Date): boolean {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return d.getTime() < now.getTime()
}

function daysDiff(d: Date): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

// 組合日期+時間 → Notion 格式
function composeDatetime(date: string, time: string): string {
  if (!date) return ''
  if (!time) return date // 純日期 2026-04-17
  return `${date}T${time}:00+08:00` // ISO with timezone
}

// 顯示日期（有時間 → 4/17 10:30；無時間 → 4/17）
function formatDateDisplay(dateString?: string): string {
  if (!dateString) return ''
  const hasTime = dateString.includes('T')
  const d = new Date(dateString)
  const base = `${d.getMonth() + 1}/${d.getDate()}`
  if (hasTime) {
    const h = String(d.getHours()).padStart(2, '0')
    const m = String(d.getMinutes()).padStart(2, '0')
    return `${base} ${h}:${m}`
  }
  return base
}

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
  const [newTodoTime, setNewTodoTime] = useState('')
  const [newProgressText, setNewProgressText] = useState('')
  const [submitting, setSubmitting] = useState<string | null>(null)

  // === A1. 頂部收合 ===
  const [importantCollapsed, setImportantCollapsed] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('crm.topBar.importantCollapsed') === 'true'
    return false
  })
  const [todoCollapsed, setTodoCollapsed] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('crm.topBar.todoCollapsed') === 'true'
    return false
  })

  // === A2. 頂部快速輸入 ===
  const [quickImportantText, setQuickImportantText] = useState('')
  const [quickTodoText, setQuickTodoText] = useState('')
  const [quickImportantBound, setQuickImportantBound] = useState(true) // 是否綁定選中客戶
  const [quickTodoBound, setQuickTodoBound] = useState(true)

  // === A3. 待辦動畫 ===
  const [todoAnimPhase, setTodoAnimPhase] = useState<Record<string, 'idle' | 'checked' | 'strikethrough' | 'fading'>>({})

  // === B. 快速跟進 ===
  const [showFollowUpPicker, setShowFollowUpPicker] = useState(false)
  const [followUpDate, setFollowUpDate] = useState('')
  const [followUpTime, setFollowUpTime] = useState('')

  // === C. 進度後自動設跟進 ===
  const [showFollowUpPrompt, setShowFollowUpPrompt] = useState(false)
  const [promptFollowUpDate, setPromptFollowUpDate] = useState('')
  const [promptFollowUpTime, setPromptFollowUpTime] = useState('')

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

  // === A1. 收合 localStorage 同步 ===
  const toggleImportantCollapsed = useCallback(() => {
    setImportantCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('crm.topBar.importantCollapsed', String(next))
      return next
    })
  }, [])

  const toggleTodoCollapsed = useCallback(() => {
    setTodoCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('crm.topBar.todoCollapsed', String(next))
      return next
    })
  }, [])

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

  // === A2. 快速新增重要事項（頂部） ===
  const handleQuickAddImportant = useCallback(async () => {
    if (!quickImportantText.trim()) return
    const clientId = quickImportantBound && selectedClientId ? selectedClientId : undefined
    const clientName = clientId ? selectedClient?.name : undefined
    try {
      const res = await fetch('/api/important-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: quickImportantText.trim(),
          clientId,
          clientName: clientName || '',
          source: 'buyer',
        }),
      })
      if (!res.ok) throw new Error('API error')
      const item = await res.json()
      setImportantItems((prev) => [item, ...prev])
      if (clientId && clientId === selectedClientId) {
        setClientImportantItems((prev) => [item, ...prev])
      }
      setQuickImportantText('')
      toast.success('已新增重要事項')
    } catch {
      toast.error('新增重要事項失敗')
    }
  }, [quickImportantText, quickImportantBound, selectedClientId, selectedClient])

  // === A2. 快速新增待辦（頂部） ===
  const handleQuickAddTodo = useCallback(async () => {
    if (!quickTodoText.trim()) return
    const clientId = quickTodoBound && selectedClientId ? selectedClientId : undefined
    const clientName = clientId ? selectedClient?.name : undefined
    const today = new Date()
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    try {
      const res = await fetch('/api/todo-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: quickTodoText.trim(),
          date: dateStr,
          clientId,
          clientName: clientName || '',
        }),
      })
      if (!res.ok) throw new Error('API error')
      const item = await res.json()
      setTodoItems((prev) => [item, ...prev])
      setQuickTodoText('')
      toast.success('已新增待辦事項')
    } catch {
      toast.error('新增待辦事項失敗')
    }
  }, [quickTodoText, quickTodoBound, selectedClientId, selectedClient])

  // === A3. 動畫版 toggle dashboard 待辦完成 ===
  const handleAnimatedToggleTodo = useCallback(async (todoId: string, title: string) => {
    setTodoAnimPhase((prev) => ({ ...prev, [todoId]: 'checked' }))

    try {
      await fetch(`/api/clients/todos/${todoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ todoFlag: false }),
      })
    } catch {
      setTodoAnimPhase((prev) => ({ ...prev, [todoId]: 'idle' }))
      toast.error('完成失敗，請重試')
      return
    }

    setTimeout(() => {
      setTodoAnimPhase((prev) => ({ ...prev, [todoId]: 'strikethrough' }))
    }, 300)

    setTimeout(() => {
      setTodoAnimPhase((prev) => ({ ...prev, [todoId]: 'fading' }))
    }, 600)

    setTimeout(() => {
      setTodoItems((prev) => prev.filter((t) => t.id !== todoId))
      setTodoAnimPhase((prev) => {
        const next = { ...prev }
        delete next[todoId]
        return next
      })

      toast.success(`已完成：${title.slice(0, 20)}`, {
        action: {
          label: '復原',
          onClick: async () => {
            try {
              await fetch(`/api/clients/todos/${todoId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ todoFlag: true }),
              })
              fetchDashboard()
              toast.success('已復原')
            } catch {
              toast.error('復原失敗')
            }
          },
        },
        duration: 3000,
      })
    }, 800)
  }, [fetchDashboard])

  // ===================== 統計（含逾期計算） =====================

  const overdueClientCount = useMemo(
    () => clients.filter((c) => isOverdue(c.nextFollowUp)).length,
    [clients]
  )

  const overdueTodoCount = useMemo(
    () => todoItems.filter((t) => { const d = parseTodoDate(t.title); return d && isPast(d) && !isToday(d) }).length,
    [todoItems]
  )

  const todayTodoCount = useMemo(
    () => todoItems.filter((t) => { const d = parseTodoDate(t.title); return d && isToday(d) }).length,
    [todoItems]
  )

  // ===================== 操作 =====================

  const handleSelectClient = (clientId: string) => {
    setSelectedClientId(clientId)
    setNewImportantText('')
    setNewTodoText('')
    setNewTodoDate('')
    setNewTodoTime('')
    setNewProgressText('')
    setShowFollowUpPicker(false)
    setShowFollowUpPrompt(false)
    // A2: 選新客戶時重新啟用綁定
    setQuickImportantBound(true)
    setQuickTodoBound(true)
  }

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

  // 新增待辦（+ Google Calendar 串接）
  const handleAddTodo = async () => {
    if (!newTodoText.trim() || !selectedClientId) return
    setSubmitting('todo')
    try {
      // 如果有選日期，把日期附在標題後面
      const dateStr = newTodoDate
      const d = dateStr ? new Date(dateStr) : null
      const timeSuffix = newTodoTime ? ` ${newTodoTime}` : ''
      const dateSuffix = d ? ` (${d.getMonth() + 1}/${d.getDate()}${timeSuffix})` : ''
      const fullTitle = newTodoText.trim() + dateSuffix

      const res = await fetch(`/api/clients/${selectedClientId}/todos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: fullTitle }),
      })
      if (res.ok) {
        const todo = await res.json()
        setClientTodos((prev) => [todo, ...prev])
        setNewTodoText('')

        // 有選日期 → 建 Google Calendar 事件
        const calendarDate = composeDatetime(dateStr, newTodoTime)
        if (calendarDate && selectedClient) {
          fetch('/api/calendar/event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              summary: `[${selectedClient.name}] ${newTodoText.trim()}`,
              date: calendarDate,
              description: `CRM 待辦 - 客戶：${selectedClient.name}`,
            }),
          }).catch((err) => console.error('Calendar event error:', err))
        }

        setNewTodoDate('')
        setNewTodoTime('')
        fetchDashboard()
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
      if (currentFlag) {
        setTodoItems((prev) => prev.filter((t) => t.id !== todoId))
      }
    } catch (err) {
      console.error('Toggle todo error:', err)
    }
  }

  // 新增進度 + C. 自動設跟進提示
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
        // C. 送出後跳出「要設下次跟進日嗎？」
        setPromptFollowUpDate('')
        setShowFollowUpPrompt(true)
      }
    } finally {
      setSubmitting(null)
    }
  }

  // B. 快速設跟進日
  const handleSetFollowUp = async (date: string, time: string) => {
    if (!date || !selectedClientId) return
    setSubmitting('followup')
    const value = composeDatetime(date, time)
    try {
      const res = await fetch(`/api/clients/${selectedClientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nextFollowUp: value }),
      })
      if (res.ok) {
        setClients((prev) =>
          prev.map((c) => (c.id === selectedClientId ? { ...c, nextFollowUp: value } : c))
        )
        setShowFollowUpPicker(false)
        setFollowUpDate('')
        setFollowUpTime('')
        setShowFollowUpPrompt(false)
        setPromptFollowUpDate('')
        setPromptFollowUpTime('')
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

  // E. 鍵盤快捷鍵
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape 關閉提示
      if (e.key === 'Escape') {
        setShowFollowUpPicker(false)
        setShowFollowUpPrompt(false)
        return
      }

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

  // ===================== Render helpers =====================

  // D. 待辦項目的樣式（根據日期狀態）
  const getTodoStyle = (title: string) => {
    const d = parseTodoDate(title)
    if (!d) return { bg: '', text: 'text-slate-300', badge: null }
    if (isToday(d)) return { bg: 'bg-amber-900/20 rounded px-1.5 py-0.5', text: 'text-amber-200', badge: null }
    if (isPast(d)) {
      const diff = Math.abs(daysDiff(d))
      return { bg: '', text: 'text-red-400', badge: `逾期 ${diff} 天` }
    }
    return { bg: '', text: 'text-slate-300', badge: null }
  }

  // ===================== Render =====================

  return (
    <div className="min-h-screen bg-slate-900">
      {/* ===== 頂部儀表板 ===== */}
      <div className="border-b border-slate-700 bg-slate-900/80 backdrop-blur">
        {/* 統計 badge（含逾期數） */}
        <div className="max-w-7xl mx-auto px-6 pt-5 pb-3">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-400">
              今日待辦 <span className="text-white font-bold">{todoItems.length}</span> 件
            </span>
            {todayTodoCount > 0 && (
              <>
                <span className="text-slate-600">|</span>
                <span className="text-amber-400">
                  今日到期 <span className="font-bold">{todayTodoCount}</span> 件
                </span>
              </>
            )}
            {(overdueTodoCount > 0 || overdueClientCount > 0) && (
              <>
                <span className="text-slate-600">|</span>
                <span className="text-red-400">
                  逾期 <span className="font-bold">{overdueTodoCount + overdueClientCount}</span> 件
                </span>
              </>
            )}
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">
              重要事項 <span className="text-white font-bold">{importantItems.length}</span> 件
            </span>
          </div>
        </div>

        {/* 兩大欄（A1 收合 + A2 快速輸入） */}
        <div className="max-w-7xl mx-auto px-6 pb-5">
          <div className="grid grid-cols-2 gap-6">

            {/* === 近期重要事項 === */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              {/* A1: 可收合標題 */}
              <button
                onClick={toggleImportantCollapsed}
                className="w-full flex items-center justify-between mb-0 group"
              >
                <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <Star size={14} className="text-amber-400" />
                  近期重要事項
                  {importantCollapsed && (
                    <span className="text-xs text-slate-500 font-normal">({importantItems.length})</span>
                  )}
                </h3>
                {importantCollapsed
                  ? <ChevronRight size={14} className="text-slate-500 group-hover:text-slate-300 transition-colors" />
                  : <ChevronDown size={14} className="text-slate-500 group-hover:text-slate-300 transition-colors" />
                }
              </button>

              {!importantCollapsed && (
                <div className="mt-3">
                  {/* A2: 快速輸入欄 */}
                  <div className="mb-3">
                    {selectedClientId && selectedClient && quickImportantBound && (
                      <div className="flex items-center gap-1.5 text-xs text-green-400 mb-1.5">
                        <Check size={10} />
                        <span>將記錄到：{selectedClient.name}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setQuickImportantBound(false) }}
                          className="text-slate-500 hover:text-red-400 transition-colors"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    )}
                    <input
                      type="text"
                      placeholder="+ 快速新增重要事項..."
                      value={quickImportantText}
                      onChange={(e) => setQuickImportantText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleQuickAddImportant()}
                      className="w-full bg-slate-900/50 border border-slate-600/50 rounded px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>

                  {/* 列表 */}
                  <div className="max-h-36 overflow-y-auto">
                    {loadingDashboard ? (
                      <p className="text-xs text-slate-500">載入中...</p>
                    ) : importantItems.length === 0 ? (
                      <p className="text-xs text-slate-500">目前沒有重要事項</p>
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
                </div>
              )}
            </div>

            {/* === 待辦事項 === */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              {/* A1: 可收合標題 */}
              <button
                onClick={toggleTodoCollapsed}
                className="w-full flex items-center justify-between mb-0 group"
              >
                <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <CheckSquare size={14} className="text-green-400" />
                  待辦事項
                  {todoCollapsed && (
                    <span className="text-xs text-slate-500 font-normal">({todoItems.length})</span>
                  )}
                </h3>
                {todoCollapsed
                  ? <ChevronRight size={14} className="text-slate-500 group-hover:text-slate-300 transition-colors" />
                  : <ChevronDown size={14} className="text-slate-500 group-hover:text-slate-300 transition-colors" />
                }
              </button>

              {!todoCollapsed && (
                <div className="mt-3">
                  {/* A2: 快速輸入欄 */}
                  <div className="mb-3">
                    {selectedClientId && selectedClient && quickTodoBound && (
                      <div className="flex items-center gap-1.5 text-xs text-green-400 mb-1.5">
                        <Check size={10} />
                        <span>將記錄到：{selectedClient.name}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setQuickTodoBound(false) }}
                          className="text-slate-500 hover:text-red-400 transition-colors"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="+ 快速新增待辦（預設今天）..."
                        value={quickTodoText}
                        onChange={(e) => setQuickTodoText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleQuickAddTodo()}
                        className="flex-1 bg-slate-900/50 border border-slate-600/50 rounded px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                      <span className="text-[10px] text-slate-500 shrink-0">
                        （今天 {new Date().getMonth() + 1}/{new Date().getDate()}）
                      </span>
                    </div>
                  </div>

                  {/* A3: 待辦列表（含動畫） */}
                  <div className="max-h-36 overflow-y-auto">
                    {loadingDashboard ? (
                      <p className="text-xs text-slate-500">載入中...</p>
                    ) : todoItems.length === 0 ? (
                      <p className="text-xs text-slate-500">目前沒有待辦事項</p>
                    ) : (
                      <div className="space-y-1.5">
                        {todoItems.map((item) => {
                          const style = getTodoStyle(item.title)
                          const phase = todoAnimPhase[item.id] || 'idle'
                          return (
                            <div
                              key={item.id}
                              className={`flex items-start gap-2 text-sm transition-all duration-200 ${style.bg} ${
                                phase === 'fading' ? 'opacity-0 max-h-0 overflow-hidden' : 'opacity-100 max-h-20'
                              }`}
                            >
                              <button
                                onClick={() => handleAnimatedToggleTodo(item.id, item.title)}
                                disabled={phase !== 'idle'}
                                className="mt-0.5 shrink-0 transition-colors"
                              >
                                {phase === 'idle' ? (
                                  <Square size={14} className="text-slate-500 hover:text-green-400" />
                                ) : (
                                  <CheckSquare size={14} className="text-green-400" />
                                )}
                              </button>
                              <div
                                onClick={() => handleJumpToClient(item.clientId, item.source)}
                                className={`flex-1 cursor-pointer hover:text-indigo-400 transition-all duration-300 ${
                                  phase === 'strikethrough' || phase === 'fading' ? 'line-through text-slate-500' : ''
                                }`}
                              >
                                <span className="text-indigo-400 font-medium">[{item.clientName}]</span>{' '}
                                <span className={phase !== 'idle' ? 'text-slate-500' : style.text}>{item.title}</span>
                                {phase === 'idle' && style.badge && (
                                  <span className="ml-2 text-[10px] bg-red-900/50 text-red-300 px-1.5 py-0.5 rounded">
                                    {style.badge}
                                  </span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
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
            <div className="flex" style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}>
              {/* 左側邊欄（A. 逾期視覺強化） */}
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
                    const isTodayFollowUp = days === 0
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
                        className={`px-4 py-3 cursor-pointer transition-all border-l-[3px] ${
                          isSelected
                            ? 'bg-indigo-900/20 border-l-indigo-500'
                            : overdue
                            ? 'border-l-red-500/50 hover:bg-red-900/10'
                            : isTodayFollowUp
                            ? 'border-l-amber-500/50 hover:bg-amber-900/10'
                            : 'border-l-transparent hover:bg-slate-800/50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-white text-sm">{client.name}</span>
                          <div className="flex items-center gap-1.5">
                            {/* A. 逾期 badge */}
                            {overdue && (
                              <span className="text-[10px] bg-red-900/60 text-red-300 px-1.5 py-0.5 rounded font-medium">
                                逾期 {Math.abs(days)} 天
                              </span>
                            )}
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${gradeColor}`}>
                              {client.grade || '-'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          {client.nextFollowUp && (
                            <span className={
                              overdue ? 'text-red-400 font-medium' :
                              isTodayFollowUp ? 'text-amber-400 font-medium' :
                              days <= 3 ? 'text-amber-400' : ''
                            }>
                              <Calendar size={10} className="inline mr-1" />
                              {overdue
                                ? `逾期 ${Math.abs(days)} 天`
                                : isTodayFollowUp
                                ? '今天跟進'
                                : `${days} 天後`}
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
              <div className="flex-1 min-h-0 overflow-y-auto">
                {!selectedClient ? (
                  <div className="flex items-center justify-center h-full text-slate-500">
                    <div className="text-center">
                      <Users size={48} className="mx-auto mb-3 opacity-30" />
                      <p>選擇左側客戶查看詳情</p>
                      <p className="text-xs mt-1 text-slate-600">↑↓ 切換客戶 ｜ Tab 跳到進度輸入 ｜ Esc 關閉提示</p>
                    </div>
                  </div>
                ) : loadingDetail ? (
                  <div className="flex items-center justify-center h-full text-slate-500">
                    載入中...
                  </div>
                ) : (
                  <div className="p-6 space-y-4">
                    {/* 客戶標頭 + B. 快速跟進按鈕 */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-bold text-white">{selectedClient.name}</h2>
                        <div className="flex items-center gap-3 text-sm text-slate-400 mt-1">
                          {selectedClient.phone && <span>📱 {selectedClient.phone}</span>}
                          {selectedClient.area && <span>📍 {selectedClient.area}</span>}
                          {selectedClient.grade && <span>{selectedClient.grade}</span>}
                          {/* A. 跟進逾期提示 */}
                          {isOverdue(selectedClient.nextFollowUp) && (
                            <span className="text-red-400 font-medium flex items-center gap-1">
                              <AlertTriangle size={14} />
                              跟進逾期 {Math.abs(daysUntil(selectedClient.nextFollowUp))} 天
                            </span>
                          )}
                          {selectedClient.nextFollowUp && !isOverdue(selectedClient.nextFollowUp) && (
                            <span className={daysUntil(selectedClient.nextFollowUp) === 0 ? 'text-amber-400' : 'text-slate-500'}>
                              <Calendar size={12} className="inline mr-1" />
                              跟進：{formatDateDisplay(selectedClient.nextFollowUp)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* B. 設跟進日按鈕 */}
                        <div className="relative">
                          <button
                            onClick={() => setShowFollowUpPicker(!showFollowUpPicker)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-700 hover:bg-amber-600 text-white rounded-lg transition-colors"
                          >
                            <CalendarPlus size={14} />
                            設跟進日
                          </button>
                          {showFollowUpPicker && (
                            <div className="absolute right-0 top-10 z-10 bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-xl">
                              <div className="flex gap-2">
                                <input
                                  type="date"
                                  value={followUpDate}
                                  onChange={(e) => setFollowUpDate(e.target.value)}
                                  autoFocus
                                  className="bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                />
                                <input
                                  type="time"
                                  value={followUpTime}
                                  onChange={(e) => setFollowUpTime(e.target.value)}
                                  className="bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-400 focus:outline-none focus:border-indigo-500 w-[90px]"
                                />
                              </div>
                              <div className="flex gap-2 mt-2">
                                <button
                                  onClick={() => handleSetFollowUp(followUpDate, followUpTime)}
                                  disabled={!followUpDate || submitting === 'followup'}
                                  className="flex-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs rounded transition-colors"
                                >
                                  確定
                                </button>
                                <button
                                  onClick={() => setShowFollowUpPicker(false)}
                                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded transition-colors"
                                >
                                  取消
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                        {/* ⑤ 開啟 Notion */}
                        <a
                          href={`https://www.notion.so/${selectedClient.id.replace(/-/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
                        >
                          <ExternalLink size={14} />
                          Notion
                        </a>
                      </div>
                    </div>

                    {/* ① 重要大事 */}
                    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                      {/* 標題列 + 輸入欄同一行 */}
                      <div className="flex items-center gap-3">
                        <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2 shrink-0">
                          <Star size={14} />
                          重要大事
                        </h3>
                        <input
                          type="text"
                          placeholder="新增重要大事..."
                          value={newImportantText}
                          onChange={(e) => setNewImportantText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddImportant()}
                          className="flex-1 min-w-0 bg-slate-900 border border-slate-600 rounded px-3 py-1 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          onClick={handleAddImportant}
                          disabled={submitting === 'important' || !newImportantText.trim()}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm rounded transition-colors shrink-0"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      {/* 列表 */}
                      {clientImportantItems.length === 0 ? (
                        <p className="text-xs text-slate-500 mt-3">目前無重要事項</p>
                      ) : (
                        <div className="space-y-2 mt-3">
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
                    </div>

                    {/* ② 待辦事項（A. 逾期視覺 + D. 今日 highlight） */}
                    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                      {/* 標題列 + 輸入欄同一行 */}
                      <div className="flex items-center gap-3">
                        <h3 className="text-sm font-semibold text-green-400 flex items-center gap-2 shrink-0">
                          <CheckSquare size={14} />
                          待辦事項
                        </h3>
                        <input
                          type="text"
                          placeholder="新增待辦..."
                          value={newTodoText}
                          onChange={(e) => setNewTodoText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddTodo()}
                          className="flex-1 min-w-0 bg-slate-900 border border-slate-600 rounded px-3 py-1 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                        />
                        <input
                          type="date"
                          value={newTodoDate}
                          onChange={(e) => setNewTodoDate(e.target.value)}
                          className="bg-slate-900 border border-slate-600 rounded px-1.5 py-1 text-xs text-slate-400 focus:outline-none focus:border-indigo-500 shrink-0 w-[130px]"
                        />
                        <input
                          type="time"
                          value={newTodoTime}
                          onChange={(e) => setNewTodoTime(e.target.value)}
                          className="bg-slate-900 border border-slate-600 rounded px-1.5 py-1 text-xs text-slate-400 focus:outline-none focus:border-indigo-500 shrink-0 w-[80px]"
                        />
                        <button
                          onClick={handleAddTodo}
                          disabled={submitting === 'todo' || !newTodoText.trim()}
                          className="px-2.5 py-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm rounded transition-colors shrink-0"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      {newTodoDate && (
                        <p className="text-xs text-slate-500 mt-1.5 ml-[100px]">
                          📅 將同步建立 Google Calendar 事件
                        </p>
                      )}
                      {/* 列表 */}
                      {clientTodos.length === 0 ? (
                        <p className="text-xs text-slate-500 mt-3">目前無待辦事項</p>
                      ) : (
                        <div className="space-y-1.5 mt-3">
                          {clientTodos.map((todo) => {
                            const style = getTodoStyle(todo.title)
                            return (
                              <div key={todo.id} className={`flex items-center gap-2 text-sm ${style.bg}`}>
                                <button
                                  onClick={() => handleToggleTodo(todo.id, todo.todoFlag)}
                                  className="text-slate-500 hover:text-green-400 transition-colors shrink-0"
                                >
                                  {todo.todoFlag ? <Square size={14} /> : <CheckSquare size={14} className="text-green-500" />}
                                </button>
                                <span className={todo.todoFlag ? style.text : 'text-slate-500 line-through'}>
                                  {todo.title}
                                </span>
                                {todo.todoFlag && style.badge && (
                                  <span className="text-[10px] bg-red-900/50 text-red-300 px-1.5 py-0.5 rounded shrink-0">
                                    {style.badge}
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* ③ 之前進度 */}
                    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
                        <Clock size={14} />
                        之前進度
                        {clientBlocks.length > 0 && (
                          <span className="text-xs text-slate-500 font-normal">({clientBlocks.length})</span>
                        )}
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

                    {/* ④ 目前進度 + C. 自動設跟進提示 */}
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

                      {/* C. 進度送出後的跟進日提示 */}
                      {showFollowUpPrompt && (
                        <div className="mt-3 bg-amber-900/20 border border-amber-700/50 rounded-lg p-3 flex items-center gap-3">
                          <CalendarPlus size={16} className="text-amber-400 shrink-0" />
                          <span className="text-sm text-amber-200">要設下次跟進日嗎？</span>
                          <input
                            type="date"
                            value={promptFollowUpDate}
                            onChange={(e) => setPromptFollowUpDate(e.target.value)}
                            autoFocus
                            className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-amber-500"
                          />
                          <input
                            type="time"
                            value={promptFollowUpTime}
                            onChange={(e) => setPromptFollowUpTime(e.target.value)}
                            className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-slate-400 focus:outline-none focus:border-amber-500 w-[80px]"
                          />
                          <button
                            onClick={() => handleSetFollowUp(promptFollowUpDate, promptFollowUpTime)}
                            disabled={!promptFollowUpDate || submitting === 'followup'}
                            className="px-3 py-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs rounded transition-colors"
                          >
                            設定
                          </button>
                          <button
                            onClick={() => setShowFollowUpPrompt(false)}
                            className="text-slate-500 hover:text-slate-300 transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}
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
