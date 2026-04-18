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
  Eye,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Client, Grade, SLAStatus, ImportantItem, TodoItem, Block } from '@/lib/types'
import { daysUntil, isOverdue, formatDate } from '@/lib/notion'
import VideosPage from '@/app/videos/page'
import AIPage from '@/app/ai/page'
import DateTimePopover, { formatTodayISO, computeDefaultTime } from '@/components/DateTimePopover'
import CommunityAutocomplete from '@/components/CommunityAutocomplete'
import ClientBasicInfoTab from '@/components/ClientBasicInfoTab'
import ClientViewingsTab from '@/components/ClientViewingsTab'

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

// 生日判斷：只比 MM-DD，忽略年份；空字串 / null 都回 false
function isTodayBirthday(birthday?: string | null): boolean {
  if (!birthday) return false
  const d = new Date(birthday)
  if (isNaN(d.getTime())) return false
  const now = new Date()
  return d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

// 是否為 A/B/C 級
function isABCGrade(grade?: string): boolean {
  const g = grade?.charAt(0)?.toUpperCase()
  return g === 'A' || g === 'B' || g === 'C'
}

// 組合日期+時間 → Notion 格式
function composeDatetime(date: string, time: string): string {
  if (!date) return ''
  if (!time) return date // 純日期 2026-04-17
  return `${date}T${time}:00+08:00` // ISO with timezone
}

// SLA 狀態 emoji
function getSLAEmoji(grade?: string, slaStatus?: SLAStatus): string {
  if (slaStatus === 'frozen') return '🧊'
  const g = grade?.charAt(0)?.toUpperCase()
  if (g === 'A') return '🔥'
  if (g === 'B') return '🌤'
  if (g === 'C') return '❄️'
  return '⚪' // 未分級
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

  // === 頂部計數條篩選（第三輪：🎂 今日生日） ===
  const [focusFilter, setFocusFilter] = useState<'birthday' | null>(null)

  // === 客戶詳情 3 Tab ===
  type DetailTab = 'latest' | 'basic' | 'viewings'
  const [detailTab, setDetailTab] = useState<DetailTab>('latest')

  // === U5. 新增客戶 modal ===
  const [showNewClientModal, setShowNewClientModal] = useState(false)
  const [newClientName, setNewClientName] = useState('')
  const [creatingClient, setCreatingClient] = useState(false)

  // === U2. 新增帶看 modal ===
  const [showViewingModal, setShowViewingModal] = useState(false)
  const [viewingDate, setViewingDate] = useState('')
  const [viewingTime, setViewingTime] = useState('')
  const [viewingLocation, setViewingLocation] = useState('')
  const [viewingCommunityName, setViewingCommunityName] = useState('')
  const [viewingCommunityUrl, setViewingCommunityUrl] = useState('')
  const [viewingCommunityLejuUrl, setViewingCommunityLejuUrl] = useState('')
  const [viewingColleagueName, setViewingColleagueName] = useState('')
  const [viewingColleaguePhone, setViewingColleaguePhone] = useState('')
  const [viewingNote, setViewingNote] = useState('')
  const [creatingViewing, setCreatingViewing] = useState(false)

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
  // R2: 頂部快速輸入的日期/時間（重要事項 + 待辦各一組）
  const [quickImportantDate, setQuickImportantDate] = useState('')
  const [quickImportantTime, setQuickImportantTime] = useState('')
  const [quickTodoDate, setQuickTodoDate] = useState('')
  const [quickTodoTime, setQuickTodoTime] = useState('')

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

    // 🎂 今日生日篩選與 A/B/C 級互斥：開啟時只顯示 A/B/C 級 + 今日生日
    if (focusFilter === 'birthday') {
      filtered = filtered.filter((c) => isABCGrade(c.grade) && isTodayBirthday(c.birthday))
    } else {
      filtered = filtered.filter((c) => gradeMatches(c.grade, selectedGrade))
    }

    filtered.sort((a, b) => {
      const aOverdue = isOverdue(a.nextFollowUp)
      const bOverdue = isOverdue(b.nextFollowUp)
      if (aOverdue && !bOverdue) return -1
      if (!aOverdue && bOverdue) return 1
      return daysUntil(a.nextFollowUp) - daysUntil(b.nextFollowUp)
    })

    return filtered
  }, [clients, searchTerm, selectedGrade, focusFilter])

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) || null,
    [clients, selectedClientId]
  )

  // === A2. 快速新增重要事項（頂部） ===
  const handleQuickAddImportant = useCallback(async () => {
    if (!quickImportantText.trim()) return
    const clientId = quickImportantBound && selectedClientId ? selectedClientId : undefined
    const clientName = clientId ? selectedClient?.name : undefined

    // 有選日期時間 → 附在標題後面（重要事項 API 沒有日期欄位）
    const d = quickImportantDate ? new Date(quickImportantDate) : null
    const timeSuffix = quickImportantTime ? ` ${quickImportantTime}` : ''
    const dateSuffix = d ? ` (${d.getMonth() + 1}/${d.getDate()}${timeSuffix})` : ''
    const fullTitle = quickImportantText.trim() + dateSuffix

    try {
      const res = await fetch('/api/important-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: fullTitle,
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
      setQuickImportantDate('')
      setQuickImportantTime('')
      toast.success('已新增重要事項')
    } catch {
      toast.error('新增重要事項失敗')
    }
  }, [quickImportantText, quickImportantBound, quickImportantDate, quickImportantTime, selectedClientId, selectedClient])

  // === A2. 快速新增待辦（頂部） ===
  const handleQuickAddTodo = useCallback(async () => {
    if (!quickTodoText.trim()) return
    const clientId = quickTodoBound && selectedClientId ? selectedClientId : undefined
    const clientName = clientId ? selectedClient?.name : undefined
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const dateStr = quickTodoDate || todayStr

    // 標題附加 (M/D HH:MM) 讓列表顯示日期狀態（與客戶卡一致）
    const d = new Date(dateStr)
    const timeSuffix = quickTodoTime ? ` ${quickTodoTime}` : ''
    const fullTitle = `${quickTodoText.trim()} (${d.getMonth() + 1}/${d.getDate()}${timeSuffix})`

    try {
      const res = await fetch('/api/todo-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: fullTitle,
          date: dateStr,
          clientId,
          clientName: clientName || '',
        }),
      })
      if (!res.ok) throw new Error('API error')
      const item = await res.json()
      setTodoItems((prev) => [item, ...prev])

      // 有指定日期時間 → 建 Google Calendar 事件
      if (quickTodoDate && selectedClient) {
        const calendarDate = composeDatetime(quickTodoDate, quickTodoTime)
        fetch('/api/calendar/event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            summary: `[${selectedClient.name}] ${quickTodoText.trim()}`,
            date: calendarDate,
            description: `CRM 待辦 - 客戶：${selectedClient.name}`,
          }),
        }).catch((err) => console.error('Calendar event error:', err))
      }

      setQuickTodoText('')
      setQuickTodoDate('')
      setQuickTodoTime('')
      toast.success('已新增待辦事項')
    } catch {
      toast.error('新增待辦事項失敗')
    }
  }, [quickTodoText, quickTodoBound, quickTodoDate, quickTodoTime, selectedClientId, selectedClient])

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

  // ===================== 統計（🎂 今日生日） =====================

  const todayBirthdayCount = useMemo(
    () => clients.filter((c) => isABCGrade(c.grade) && isTodayBirthday(c.birthday)).length,
    [clients]
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
    // Tab 切換：選新客戶時回到 Tab 1
    setDetailTab('latest')
  }

  // Tab 2 基本資料欄位編輯後，更新左側列表的 client cache
  const handleBasicInfoUpdate = useCallback((patch: Partial<Client>) => {
    if (!selectedClientId) return
    setClients((prev) => prev.map((c) => (c.id === selectedClientId ? { ...c, ...patch } : c)))
  }, [selectedClientId])

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

  // D. 快速記錄（洽談/面談）或一般進度送出
  const handleQuickLogOrProgress = async () => {
    if (!newProgressText.trim() || !selectedClientId) return

    // 偵測是否為快速記錄（前綴含 📞 洽談 或 🤝 面談）
    const quickLogMatch = newProgressText.match(/^\[.*?(📞\s*洽談|🤝\s*面談)\]\s*/)
    if (!quickLogMatch) {
      // 不是快速記錄 → 走原本的進度流程（含跟進提示）
      return handleAddProgress()
    }

    const type = quickLogMatch[1].includes('洽談') ? '洽談' : '面談'
    const content = newProgressText.slice(quickLogMatch[0].length).trim()
    if (!content) {
      toast.error('請在前綴後面補充內容')
      return
    }

    setSubmitting('progress')
    try {
      const res = await fetch(`/api/clients/${selectedClientId}/quick-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, content }),
      })
      if (!res.ok) throw new Error('API error')
      const data = await res.json()

      // 更新之前進度
      setClientBlocks((prev) => [{ id: data.blockId, text: data.text, createdTime: new Date().toISOString() }, ...prev])
      setNewProgressText('')

      // 更新左側卡片跟進日
      if (data.newFollowUp) {
        setClients((prev) =>
          prev.map((c) => (c.id === selectedClientId ? { ...c, nextFollowUp: data.newFollowUp } : c))
        )
        toast.success(`已記錄，下次跟進：${formatDateDisplay(data.newFollowUp)}`)
      }

      // 容錯 warning
      if (data.warning) {
        toast.warning(data.warning)
      }
    } catch {
      toast.error('快速記錄失敗')
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

  // U2: 打開新增帶看 modal（預填預設時間）
  const openViewingModal = () => {
    if (!selectedClient) return
    setViewingDate(formatTodayISO())
    setViewingTime(computeDefaultTime())
    setViewingLocation('')
    setViewingCommunityName('')
    setViewingCommunityUrl('')
    setViewingCommunityLejuUrl('')
    setViewingColleagueName('')
    setViewingColleaguePhone('')
    setViewingNote('')
    setShowViewingModal(true)
  }

  // U2: 送出新增帶看
  const handleCreateViewing = async () => {
    if (!selectedClient) return
    if (!viewingDate || !viewingTime || !viewingLocation.trim() || !viewingColleagueName.trim() || !viewingColleaguePhone.trim()) {
      toast.error('請填寫：日期時間、地點、同事名、同事電話')
      return
    }
    const datetime = composeDatetime(viewingDate, viewingTime)
    setCreatingViewing(true)
    try {
      const res = await fetch('/api/viewings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerId: selectedClient.id,
          buyerName: selectedClient.name,
          datetime,
          location: viewingLocation.trim(),
          communityName: viewingCommunityName.trim() || undefined,
          communityUrl: viewingCommunityUrl.trim() || undefined,
          communityLejuUrl: viewingCommunityLejuUrl.trim() || undefined,
          colleagueName: viewingColleagueName.trim(),
          colleaguePhone: viewingColleaguePhone.trim(),
          note: viewingNote.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '新增帶看失敗')
        if (data.calendarEventId) {
          // Calendar 已建但 DB 失敗 — 提示使用者
          toast.warning(`Calendar 事件已建立（${data.calendarEventId}），但資料庫寫入失敗`)
        }
        return
      }
      toast.success('已新增帶看，Google Calendar 已同步')
      setShowViewingModal(false)
    } catch (err: any) {
      console.error(err)
      toast.error('新增帶看失敗')
    } finally {
      setCreatingViewing(false)
    }
  }

  // U5: 新增客戶 → 建 Notion 買方、打開 Notion 頁面
  const handleCreateClient = async () => {
    const name = newClientName.trim()
    if (!name) return
    setCreatingClient(true)
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error('API error')
      const data = await res.json()
      // 新分頁開啟 Notion 頁面讓使用者繼續補資料
      if (data.notionUrl) {
        window.open(data.notionUrl, '_blank', 'noopener,noreferrer')
      }
      toast.success(`已新增：${name}`)
      setShowNewClientModal(false)
      setNewClientName('')
      fetchClients()
    } catch {
      toast.error('新增客戶失敗')
    } finally {
      setCreatingClient(false)
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
        {/* 頂部計數條：🎂 今日生日（點擊篩選 A/B/C 級今日壽星） */}
        <div className="max-w-7xl mx-auto px-6 pt-5 pb-3">
          <div className="flex items-center gap-4 text-sm">
            <button
              onClick={() => {
                setFocusFilter(focusFilter === 'birthday' ? null : 'birthday')
                setActiveTab('marketing')
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors ${
                focusFilter === 'birthday'
                  ? 'bg-pink-600/30 text-pink-200 ring-1 ring-pink-500/60'
                  : 'text-pink-400 hover:bg-pink-900/30'
              }`}
              title={focusFilter === 'birthday' ? '清除篩選' : '篩選今日生日（A/B/C 級）'}
            >
              <span>🎂 今日生日</span>
              <span className="font-bold">({todayBirthdayCount})</span>
            </button>
          </div>
        </div>

        {/* 兩大欄（A1 收合 + A2 快速輸入） */}
        <div className="max-w-7xl mx-auto px-6 pb-5">
          <div className="grid grid-cols-2 gap-6">

            {/* === 近期重要事項 === */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              {/* A5: 標題列 + 快速輸入欄（收合時也看得見） */}
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2 shrink-0">
                  <Star size={14} className="text-amber-400" />
                  近期重要事項
                  <span className="text-xs text-slate-500 font-normal">({importantItems.length})</span>
                </h3>
                <input
                  type="text"
                  placeholder="+ 快速新增..."
                  value={quickImportantText}
                  onChange={(e) => setQuickImportantText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleQuickAddImportant()}
                  className="flex-1 min-w-0 bg-slate-900/50 border border-slate-600/50 rounded px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <DateTimePopover
                  date={quickImportantDate}
                  time={quickImportantTime}
                  onChange={(d, t) => { setQuickImportantDate(d); setQuickImportantTime(t) }}
                  align="right"
                  title="重要事項日期時間"
                />
                <button
                  onClick={toggleImportantCollapsed}
                  className="p-1.5 border border-slate-600 hover:border-indigo-500 bg-slate-900 text-slate-300 hover:text-indigo-400 rounded transition-colors shrink-0"
                  aria-label={importantCollapsed ? '展開' : '收合'}
                  title={importantCollapsed ? '展開' : '收合'}
                >
                  {importantCollapsed
                    ? <ChevronRight size={14} />
                    : <ChevronDown size={14} />
                  }
                </button>
              </div>

              {selectedClientId && selectedClient && quickImportantBound && (
                <div className="flex items-center gap-1.5 text-xs text-green-400 mt-2">
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

              {!importantCollapsed && (
                <div className="mt-3 max-h-36 overflow-y-auto">
                  {loadingDashboard ? (
                    <p className="text-xs text-slate-500">載入中...</p>
                  ) : importantItems.length === 0 ? (
                    <p className="text-xs text-slate-500">目前沒有重要事項</p>
                  ) : (
                    <div className="space-y-2">
                      {importantItems.map((item) => {
                        const hasClient = Boolean(item.clientId) && item.clientName !== '未關聯'
                        return (
                          <div key={item.id} className="flex items-start gap-2 text-sm group">
                            <div
                              onClick={() => hasClient && handleJumpToClient(item.clientId, item.source)}
                              className={`flex-1 min-w-0 text-slate-300 ${hasClient ? 'hover:text-indigo-400 cursor-pointer' : ''} transition-colors flex items-start gap-2`}
                            >
                              {hasClient && (
                                <span className="text-indigo-400 font-medium shrink-0">[{item.clientName}]</span>
                              )}
                              <span className="truncate">{item.title}</span>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCompleteImportant(item.id) }}
                              className="text-xs text-slate-500 hover:text-green-400 transition-colors shrink-0"
                              title="標記完成"
                            >
                              完成
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* === 待辦事項 === */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              {/* A5: 標題列 + 快速輸入欄（收合時也看得見） */}
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2 shrink-0">
                  <CheckSquare size={14} className="text-green-400" />
                  待辦事項
                  <span className="text-xs text-slate-500 font-normal">({todoItems.length})</span>
                </h3>
                <input
                  type="text"
                  placeholder="+ 快速新增（預設今天）..."
                  value={quickTodoText}
                  onChange={(e) => setQuickTodoText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleQuickAddTodo()}
                  className="flex-1 min-w-0 bg-slate-900/50 border border-slate-600/50 rounded px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <DateTimePopover
                  date={quickTodoDate}
                  time={quickTodoTime}
                  onChange={(d, t) => { setQuickTodoDate(d); setQuickTodoTime(t) }}
                  align="right"
                  title="待辦日期時間"
                />
                <button
                  onClick={toggleTodoCollapsed}
                  className="p-1.5 border border-slate-600 hover:border-indigo-500 bg-slate-900 text-slate-300 hover:text-indigo-400 rounded transition-colors shrink-0"
                  aria-label={todoCollapsed ? '展開' : '收合'}
                  title={todoCollapsed ? '展開' : '收合'}
                >
                  {todoCollapsed
                    ? <ChevronRight size={14} />
                    : <ChevronDown size={14} />
                  }
                </button>
              </div>

              {selectedClientId && selectedClient && quickTodoBound && (
                <div className="flex items-center gap-1.5 text-xs text-green-400 mt-2">
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

              {!todoCollapsed && (
                <div className="mt-3">
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
                                onClick={() => item.clientId && handleJumpToClient(item.clientId, item.source)}
                                className={`flex-1 ${item.clientId ? 'cursor-pointer hover:text-indigo-400' : ''} transition-all duration-300 ${
                                  phase === 'strikethrough' || phase === 'fading' ? 'line-through text-slate-500' : ''
                                }`}
                              >
                                {item.clientId && item.clientName !== '未關聯' && (
                                  <><span className="text-indigo-400 font-medium">[{item.clientName}]</span>{' '}</>
                                )}
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
            {/* 篩選狀態條：🎂 今日生日 */}
            {focusFilter === 'birthday' && (
              <div className="px-6 py-2 border-b border-pink-700/30 bg-pink-900/10 flex items-center gap-2 text-sm">
                <span className="text-pink-300">🎂 篩選中：今日生日（A/B/C 級）</span>
                <button
                  onClick={() => setFocusFilter(null)}
                  className="text-slate-400 hover:text-white transition-colors"
                  title="清除篩選"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* 等級篩選 + 搜尋 */}
            <div className="px-6 py-4 border-b border-slate-700 flex items-center gap-4">
              <div className="flex gap-2">
                {(['A級', 'B級', 'C級', 'all'] as const).map((grade) => (
                  <button
                    key={grade}
                    onClick={() => { setSelectedGrade(grade); setFocusFilter(null) }}
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
              <button
                onClick={() => { setNewClientName(''); setShowNewClientModal(true) }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors ml-auto"
                title="新增客戶"
              >
                <Plus size={14} />
                新增客戶
              </button>
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
                        <div className="flex items-center justify-between mb-1 gap-2">
                          <div className="font-medium text-white text-sm flex items-center gap-1.5 min-w-0 flex-1">
                            <span className="relative shrink-0">
                              {getSLAEmoji(client.grade, client.slaStatus)}
                              {client.slaStatus === 'warning' && (
                                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-yellow-400 rounded-full" />
                              )}
                            </span>
                            <span className="truncate min-w-0">{client.name}</span>
                            {client.nextFollowUp && (
                              <span className={`text-[11px] font-normal shrink-0 whitespace-nowrap ${
                                overdue ? 'text-red-400 font-medium' :
                                isTodayFollowUp ? 'text-amber-400 font-medium' :
                                days <= 3 ? 'text-amber-400' : 'text-slate-500'
                              }`}>
                                📅{overdue
                                  ? `逾期${Math.abs(days)}天`
                                  : isTodayFollowUp
                                  ? '今天'
                                  : formatDateDisplay(client.nextFollowUp)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${gradeColor}`}>
                              {client.grade || '-'}
                            </span>
                          </div>
                        </div>
                        {client.area && (
                          <div className="text-xs text-slate-500">{client.area}</div>
                        )}
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
                  <div className="p-6 pb-[200px] space-y-4">
                    {/* 客戶標頭 + B. 快速跟進按鈕 */}
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        {/* U6: 姓名 + 手機 + 跟進日 同一行 */}
                        <div className="flex items-center gap-3 flex-wrap">
                          <h2 className="text-xl font-bold text-white flex items-center gap-2 min-w-0">
                            <span className="relative shrink-0">
                              {getSLAEmoji(selectedClient.grade, selectedClient.slaStatus)}
                              {selectedClient.slaStatus === 'warning' && (
                                <span className="absolute -top-0.5 -right-1 w-2.5 h-2.5 bg-yellow-400 rounded-full" />
                              )}
                            </span>
                            <span className="truncate">{selectedClient.name}</span>
                          </h2>
                          {selectedClient.phone && (
                            <span className="text-sm text-slate-300 whitespace-nowrap">
                              📱 {selectedClient.phone}
                            </span>
                          )}
                          {isOverdue(selectedClient.nextFollowUp) && (
                            <span className="text-sm text-red-400 font-medium flex items-center gap-1 whitespace-nowrap">
                              <AlertTriangle size={14} />
                              跟進逾期 {Math.abs(daysUntil(selectedClient.nextFollowUp))} 天
                            </span>
                          )}
                          {selectedClient.nextFollowUp && !isOverdue(selectedClient.nextFollowUp) && (
                            <span className={`text-sm whitespace-nowrap ${daysUntil(selectedClient.nextFollowUp) === 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                              📅 跟進：{formatDateDisplay(selectedClient.nextFollowUp)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* B. 設跟進日按鈕 */}
                        <div className="relative">
                          <button
                            onClick={() => {
                              const nextOpen = !showFollowUpPicker
                              if (nextOpen) {
                                if (!followUpDate) setFollowUpDate(formatTodayISO())
                                if (!followUpTime) setFollowUpTime(computeDefaultTime())
                              }
                              setShowFollowUpPicker(nextOpen)
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-700 hover:bg-amber-600 text-white rounded-lg transition-colors"
                          >
                            <CalendarPlus size={14} />
                            設跟進日
                          </button>
                          {showFollowUpPicker && (
                            <div className="absolute right-0 top-10 z-10 bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-xl">
                              <div className="flex gap-2 items-center">
                                <input
                                  type="date"
                                  value={followUpDate}
                                  onChange={(e) => setFollowUpDate(e.target.value)}
                                  autoFocus
                                  className="bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                />
                                <select
                                  value={followUpTime ? followUpTime.split(':')[0] : ''}
                                  onChange={(e) => {
                                    const hh = e.target.value
                                    const mm = followUpTime ? followUpTime.split(':')[1] || '00' : '00'
                                    setFollowUpTime(hh ? `${hh}:${mm}` : '')
                                  }}
                                  className="bg-slate-900 border border-slate-600 rounded px-1.5 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
                                >
                                  {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map((h) => (
                                    <option key={h} value={h}>{h}</option>
                                  ))}
                                </select>
                                <span className="text-slate-500 text-sm">:</span>
                                <select
                                  value={followUpTime ? followUpTime.split(':')[1] : ''}
                                  onChange={(e) => {
                                    const mm = e.target.value
                                    const hh = followUpTime ? followUpTime.split(':')[0] : '09'
                                    setFollowUpTime(mm ? `${hh}:${mm}` : '')
                                  }}
                                  className="bg-slate-900 border border-slate-600 rounded px-1.5 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
                                >
                                  {['00', '15', '30', '45'].map((m) => (
                                    <option key={m} value={m}>{m}</option>
                                  ))}
                                </select>
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
                        {/* U2. 新增帶看 */}
                        <button
                          onClick={openViewingModal}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-sky-700 hover:bg-sky-600 text-white rounded-lg transition-colors"
                          title="新增帶看（30 分鐘 Google Calendar 事件）"
                        >
                          <Eye size={14} />
                          新增帶看
                        </button>
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

                    {/* Tab 切換列 */}
                    <div className="flex gap-1 border-b border-slate-700">
                      {([
                        { key: 'latest', label: '最新進度' },
                        { key: 'basic', label: '基本資料' },
                        { key: 'viewings', label: '帶看記錄卡' },
                      ] as const).map(({ key, label }) => (
                        <button
                          key={key}
                          onClick={() => setDetailTab(key)}
                          className={`px-4 py-2 text-sm transition-colors border-b-2 -mb-px ${
                            detailTab === key
                              ? 'border-indigo-500 text-indigo-400'
                              : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {/* === Tab 2：基本資料 === */}
                    {detailTab === 'basic' && (
                      <ClientBasicInfoTab
                        client={selectedClient}
                        onUpdate={handleBasicInfoUpdate}
                      />
                    )}

                    {/* === Tab 3：帶看記錄卡 === */}
                    {detailTab === 'viewings' && (
                      <ClientViewingsTab
                        clientId={selectedClient.id}
                      />
                    )}

                    {/* === Tab 1：最新進度（原有全部內容） === */}
                    {detailTab === 'latest' && (
                    <div className="space-y-4">
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
                        <DateTimePopover
                          date={newTodoDate}
                          time={newTodoTime}
                          onChange={(d, t) => {
                            setNewTodoDate(d)
                            setNewTodoTime(t)
                          }}
                          align="right"
                          title="待辦日期時間"
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
                        <p className="text-xs text-slate-500 mt-1.5">
                          📅 {newTodoDate}{newTodoTime ? ` ${newTodoTime}` : ''}・將同步建立 Google Calendar 事件
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
                          {[...clientBlocks]
                            .sort((a, b) => {
                              const at = a.createdTime ? new Date(a.createdTime).getTime() : 0
                              const bt = b.createdTime ? new Date(b.createdTime).getTime() : 0
                              return at - bt
                            })
                            .map((block) => (
                              <p key={block.id} className="text-sm text-slate-400">
                                {block.text}
                              </p>
                            ))}
                        </div>
                      )}
                    </div>

                    {/* ④ 目前進度 + D. 快速記錄 + C. 自動設跟進提示 */}
                    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-indigo-400 mb-3">目前進度</h3>
                      {/* D. 快速記錄按鈕 */}
                      <div className="flex gap-2 mb-2">
                        <button
                          onClick={() => {
                            const now = new Date()
                            const prefix = `[${now.getMonth() + 1}/${now.getDate()} 📞 洽談] `
                            setNewProgressText(prefix)
                            progressInputRef.current?.focus()
                          }}
                          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded transition-colors"
                        >
                          📞 洽談
                        </button>
                        <button
                          onClick={() => {
                            const now = new Date()
                            const prefix = `[${now.getMonth() + 1}/${now.getDate()} 🤝 面談] `
                            setNewProgressText(prefix)
                            progressInputRef.current?.focus()
                          }}
                          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded transition-colors"
                        >
                          🤝 面談
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <input
                          ref={progressInputRef}
                          type="text"
                          placeholder="輸入今天的進度..."
                          value={newProgressText}
                          onChange={(e) => setNewProgressText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleQuickLogOrProgress()}
                          className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          onClick={handleQuickLogOrProgress}
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
                          <DateTimePopover
                            date={promptFollowUpDate}
                            time={promptFollowUpTime}
                            onChange={(d, t) => {
                              setPromptFollowUpDate(d)
                              setPromptFollowUpTime(t)
                            }}
                            align="left"
                            defaultOpen
                            title="下次跟進日期時間"
                          />
                          {promptFollowUpDate && (
                            <span className="text-xs text-amber-200/80">
                              {promptFollowUpDate}{promptFollowUpTime ? ` ${promptFollowUpTime}` : ''}
                            </span>
                          )}
                          <button
                            onClick={() => handleSetFollowUp(promptFollowUpDate, promptFollowUpTime)}
                            disabled={!promptFollowUpDate || submitting === 'followup'}
                            className="px-3 py-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs rounded transition-colors ml-auto"
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

      {/* U2: 新增帶看 Modal */}
      {showViewingModal && selectedClient && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => !creatingViewing && setShowViewingModal(false)}
        >
          <div
            className="relative bg-slate-800 border border-slate-600 rounded-lg shadow-2xl w-full max-w-lg mx-4 p-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => !creatingViewing && setShowViewingModal(false)}
              className="absolute top-3 right-3 text-slate-500 hover:text-white transition-colors"
              disabled={creatingViewing}
              aria-label="關閉"
            >
              <X size={18} />
            </button>

            <div className="space-y-2.5">
              {/* 1. 日期時間 */}
              <div>
                <label className="block text-sm text-slate-400 mb-1">日期時間 <span className="text-slate-500 text-xs">(30 分鐘事件)</span></label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={viewingDate}
                    onChange={(e) => setViewingDate(e.target.value)}
                    className="bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                  <select
                    value={viewingTime ? viewingTime.split(':')[0] : ''}
                    onChange={(e) => {
                      const hh = e.target.value
                      const mm = viewingTime ? viewingTime.split(':')[1] || '00' : '00'
                      setViewingTime(hh ? `${hh}:${mm}` : '')
                    }}
                    className="bg-slate-900 border border-slate-600 rounded px-1.5 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
                  >
                    {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  <span className="text-slate-500 text-sm">:</span>
                  <select
                    value={viewingTime ? viewingTime.split(':')[1] : ''}
                    onChange={(e) => {
                      const mm = e.target.value
                      const hh = viewingTime ? viewingTime.split(':')[0] : '09'
                      setViewingTime(mm ? `${hh}:${mm}` : '')
                    }}
                    className="bg-slate-900 border border-slate-600 rounded px-1.5 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
                  >
                    {['00', '15', '30', '45'].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 3. 地點 */}
              <div>
                <label className="block text-sm text-slate-400 mb-1">地點</label>
                <input
                  type="text"
                  value={viewingLocation}
                  onChange={(e) => setViewingLocation(e.target.value)}
                  placeholder="例如：信義區松仁路 10 號"
                  className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* 4. 社區名稱（autocomplete：選中自動帶樂居連結） */}
              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  社區名稱 <span className="text-slate-500 text-xs">(選填，輸入歷史社區可自動帶樂居連結)</span>
                </label>
                <CommunityAutocomplete
                  name={viewingCommunityName}
                  onChange={setViewingCommunityName}
                  onSelectCommunity={(c) => {
                    setViewingCommunityName(c.name)
                    if (c.leju_url) setViewingCommunityLejuUrl(c.leju_url)
                  }}
                  placeholder="例如：太普"
                  inputClassName="w-full bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* 5. 永慶連結 */}
              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  永慶連結 <span className="text-slate-500 text-xs">(選填)</span>
                </label>
                <input
                  type="url"
                  value={viewingCommunityUrl}
                  onChange={(e) => setViewingCommunityUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* 6. 樂居連結 */}
              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  樂居連結 <span className="text-slate-500 text-xs">(選填)</span>
                </label>
                <input
                  type="url"
                  value={viewingCommunityLejuUrl}
                  onChange={(e) => setViewingCommunityLejuUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* 7 + 8. 同事 */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">同事名</label>
                  <input
                    type="text"
                    value={viewingColleagueName}
                    onChange={(e) => setViewingColleagueName(e.target.value)}
                    placeholder="例如：張大明"
                    className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">同事電話</label>
                  <input
                    type="tel"
                    value={viewingColleaguePhone}
                    onChange={(e) => setViewingColleaguePhone(e.target.value)}
                    placeholder="0912-345-678"
                    className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* 9. 備註 */}
              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  備註 <span className="text-slate-500 text-xs">(選填)</span>
                </label>
                <textarea
                  value={viewingNote}
                  onChange={(e) => setViewingNote(e.target.value)}
                  rows={2}
                  placeholder="其他需要記錄的事項..."
                  className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-4">
              <button
                onClick={() => setShowViewingModal(false)}
                disabled={creatingViewing}
                className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 text-sm rounded transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreateViewing}
                disabled={creatingViewing}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-sm rounded transition-colors"
              >
                <Eye size={14} />
                {creatingViewing ? '建立中...' : '建立帶看'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* U5: 新增客戶 Modal */}
      {showNewClientModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => !creatingClient && setShowNewClientModal(false)}
        >
          <div
            className="bg-slate-800 border border-slate-600 rounded-lg shadow-2xl w-full max-w-md mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Plus size={18} className="text-indigo-400" />
                新增客戶
              </h3>
              <button
                onClick={() => !creatingClient && setShowNewClientModal(false)}
                className="text-slate-500 hover:text-white transition-colors"
                disabled={creatingClient}
              >
                <X size={18} />
              </button>
            </div>
            <label className="block text-sm text-slate-400 mb-1.5">名稱</label>
            <input
              type="text"
              autoFocus
              value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newClientName.trim() && !creatingClient) handleCreateClient()
                if (e.key === 'Escape' && !creatingClient) setShowNewClientModal(false)
              }}
              placeholder="例如：黃致誠"
              className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <p className="text-xs text-slate-500 mt-2">
              按「Notion」後會建立新買方並開啟 Notion 頁面，你可以在那邊補填手機、區域、等級等欄位。
            </p>
            <div className="flex gap-2 justify-end mt-5">
              <button
                onClick={() => setShowNewClientModal(false)}
                disabled={creatingClient}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 text-sm rounded transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreateClient}
                disabled={!newClientName.trim() || creatingClient}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm rounded transition-colors"
              >
                <ExternalLink size={14} />
                {creatingClient ? '建立中...' : 'Notion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
