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
  Printer,
  X,
  Send,
  Phone,
  MapPin,
  Loader2,
  Award,
  Copy,
  Undo2,
  FileDown,
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
import BlockItem from '@/components/BlockItem'
import PropertyDetailModal, { DevProperty, DevStatus, VisitTodo } from '@/components/PropertyDetailModal'

type Tab = 'marketing' | 'entrust' | 'closed' | 'videos' | 'ai'

// Phase 1 灰度：只對這三筆客戶顯示「物件配對」按鈕
// Phase 2 擴大時把陣列清空或改成全開
const OBJECT_MATCH_WHITELIST = ['B67', 'B58', 'B71']

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

// 戶藉地址分區：高雄 / 南部 (嘉義/台南/屏東) / 中北部 (其他、含空)
type HouseholdRegionKey = 'kaohsiung' | 'south' | 'north'
function classifyHouseholdRegion(addr?: string): HouseholdRegionKey {
  const a = (addr || '').trim()
  if (a.startsWith('高雄市') || a.startsWith('高雄縣') || a.startsWith('高雄')) return 'kaohsiung'
  if (
    a.startsWith('嘉義縣') || a.startsWith('嘉義市') || a.startsWith('嘉義') ||
    a.startsWith('台南市') || a.startsWith('台南縣') || a.startsWith('台南') ||
    a.startsWith('臺南市') || a.startsWith('臺南縣') || a.startsWith('臺南') ||
    a.startsWith('屏東縣') || a.startsWith('屏東市') || a.startsWith('屏東')
  ) return 'south'
  return 'north'
}

// 把 Notion 存的 ISO datetime 拆成 picker state {date: "YYYY-MM-DD", time: "HH:MM"}
function parseISOToPick(iso?: string | null): { date: string; time: string } {
  if (!iso) return { date: '', time: '' }
  const d = new Date(iso)
  if (isNaN(d.getTime())) return { date: '', time: '' }
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return { date: `${y}-${m}-${day}`, time: `${h}:${mm}` }
}

// 把 ISO datetime 顯示成「5/22 下午 3:00」型式（12 小時制）
function fmtVisitTime(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const md = `${d.getMonth() + 1}/${d.getDate()}`
  const h = d.getHours()
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ampm = h >= 12 ? '下午' : '上午'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${md} ${ampm} ${h12}:${mm}`
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
  // B7: 社區名失焦 → 查 /api/search/leju 自動補樂居連結
  const [lejuSearching, setLejuSearching] = useState(false)
  // B6: i智慧 物件編號 → 自動帶入
  const [ismartLookupInput, setIsmartLookupInput] = useState('')
  const [ismartLookupStatus, setIsmartLookupStatus] = useState<'idle' | 'loading' | 'ok' | 'error' | 'auth_expired'>('idle')
  const [ismartLookupMessage, setIsmartLookupMessage] = useState('')
  const [userscriptReady, setUserscriptReady] = useState(false)
  // B6 列印：userscript 查到的 i智慧 內部 caseIdx（給列印頁 URL 用，跟對外編號不同）
  const [ycutCaseIdx, setYcutCaseIdx] = useState<string | null>(null)
  const ismartRequestIdRef = useRef<string | null>(null)
  const ismartTimeoutRef = useRef<number | null>(null)

  // === A1. 頂部收合 ===
  // 初值固定為 false，實際值在 mount 後用 effect 從 localStorage 補讀，
  // 否則 SSR(false) 與 CSR(localStorage) 不一致會觸發 React #418/#423 hydration 錯誤。
  const [dashboardCollapsed, setDashboardCollapsed] = useState(false)
  useEffect(() => {
    // 新 key 優先、舊兩個 key 任一是 true 也算收合（向後相容）
    const v = localStorage.getItem('crm.topBar.collapsed')
    if (v !== null) {
      setDashboardCollapsed(v === 'true')
    } else {
      const legacy =
        localStorage.getItem('crm.topBar.importantCollapsed') === 'true' ||
        localStorage.getItem('crm.topBar.todoCollapsed') === 'true'
      setDashboardCollapsed(legacy)
    }
  }, [])

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

  const progressInputRef = useRef<HTMLTextAreaElement>(null)
  const [conversationModeOn, setConversationModeOn] = useState(true)

  // ===================== 委託 tab 狀態 =====================
  type EntrustSubTab = '開發' | '追蹤' | '委託'
  type DevLetterFilter = 'pending' | 'sent'
  // 開發 sub-tab 內的 5 個拜訪/信件 子分頁
  type DevSubTab = 'visit-property' | 'revisit-property' | 'visit-household' | 'revisit-household' | 'letter'
  const DEV_SUBTAB_LABEL: Record<DevSubTab, string> = {
    'visit-property': '拜訪物件地',
    'revisit-property': '覆訪物件地',
    'visit-household': '拜訪戶藉地',
    'revisit-household': '覆訪戶藉地',
    'letter': '待寄信',
  }
  const DEV_SUBTAB_ORDER: DevSubTab[] = [
    'visit-property',
    'revisit-property',
    'visit-household',
    'revisit-household',
    'letter',
  ]
  const DEV_SUBTAB_VISIT: Record<Exclude<DevSubTab, 'letter'>, VisitTodo> = {
    'visit-property': '物件地拜訪',
    'revisit-property': '物件地覆訪',
    'visit-household': '戶藉地拜訪',
    'revisit-household': '戶藉地覆訪',
  }
  const ENTRUST_TAB_TO_STATUS: Record<EntrustSubTab, DevStatus> = {
    '開發': '募集',
    '追蹤': '追蹤',
    '委託': '委託',
  }
  const [entrustSubTab, setEntrustSubTab] = useState<EntrustSubTab>('開發')
  const [devSubTab, setDevSubTab] = useState<DevSubTab>('visit-property')
  const [entrustDevLetterFilter, setEntrustDevLetterFilter] = useState<DevLetterFilter>('pending')
  const [entrustSearchTerm, setEntrustSearchTerm] = useState('')
  const [properties, setProperties] = useState<DevProperty[]>([])
  const [propertiesLoading, setPropertiesLoading] = useState(true)
  const [propertiesError, setPropertiesError] = useState<string | null>(null)
  const [propertyPendingId, setPropertyPendingId] = useState<string | null>(null)
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null)
  const [propertyModalOpen, setPropertyModalOpen] = useState(false)
  // 委託 tab 右側 sub-tab（鏡像行銷的 detailTab）
  type EntrustDetailTab = 'latest' | 'basic' | 'records'
  const [entrustDetailTab, setEntrustDetailTab] = useState<EntrustDetailTab>('latest')
  // 開發信「已寄出」按下時的 fade-to-grey 動畫狀態
  const [fadingDevLetters, setFadingDevLetters] = useState<Set<string>>(new Set())
  // 開發信「待寄」勾選 ID（產生標籤用）
  const [selectedDevLetterIds, setSelectedDevLetterIds] = useState<Set<string>>(new Set())
  const [generatingLabels, setGeneratingLabels] = useState(false)
  // 拜訪卡片 per-id 暫存 picker state（純排程、不做狀態切換）
  const [visitPicks, setVisitPicks] = useState<Record<string, { date: string; time: string }>>({})
  const [visitSchedulingId, setVisitSchedulingId] = useState<string | null>(null)
  // 戶藉地 tab 區域 filter（單選）；預設高雄
  type HouseholdRegion = 'kaohsiung' | 'south' | 'north'
  const [householdRegion, setHouseholdRegion] = useState<HouseholdRegion>('kaohsiung')

  // ===================== 成交客戶 tab 狀態 =====================
  const [closedProperties, setClosedProperties] = useState<DevProperty[]>([])
  const [closedLoading, setClosedLoading] = useState(true)
  const [closedError, setClosedError] = useState<string | null>(null)
  const [closedSearchTerm, setClosedSearchTerm] = useState('')

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

  // === 委託 tab：載入物件 ===
  const fetchProperties = useCallback(async () => {
    setPropertiesLoading(true)
    setPropertiesError(null)
    try {
      const res = await fetch('/api/dev?activeOnly=1')
      if (!res.ok) throw new Error(`${res.status}`)
      const data = (await res.json()) as DevProperty[]
      setProperties(data)
    } catch (e: any) {
      setPropertiesError(e?.message || '載入失敗')
    } finally {
      setPropertiesLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'entrust' && properties.length === 0 && !propertiesError) {
      fetchProperties()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // === 成交客戶 tab：載入 ===
  const fetchClosedProperties = useCallback(async () => {
    setClosedLoading(true)
    setClosedError(null)
    try {
      const res = await fetch('/api/closed-customers')
      if (!res.ok) throw new Error(`${res.status}`)
      const data = (await res.json()) as DevProperty[]
      setClosedProperties(data)
    } catch (e: any) {
      setClosedError(e?.message || '載入失敗')
    } finally {
      setClosedLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'closed' && closedProperties.length === 0 && !closedError) {
      fetchClosedProperties()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  const filteredClosed = useMemo(() => {
    let list = closedProperties
    const q = closedSearchTerm.trim().toLowerCase()
    if (q) {
      list = list.filter((p) => {
        const hay = [p.name, p.owner, p.address, p.ownerPhone].filter(Boolean).join(' ').toLowerCase()
        return hay.includes(q)
      })
    }
    // 成交日期新到舊
    return [...list].sort((a, b) => {
      const ad = a.closingDate ? new Date(a.closingDate).getTime() : 0
      const bd = b.closingDate ? new Date(b.closingDate).getTime() : 0
      return bd - ad
    })
  }, [closedProperties, closedSearchTerm])

  // === 委託 tab：PATCH 物件 ===
  const patchProperty = useCallback(
    async (id: string, patch: Partial<DevProperty>) => {
      setPropertyPendingId(id)
      try {
        const apiPatch: any = {}
        for (const k of Object.keys(patch)) {
          ;(apiPatch as any)[k] = (patch as any)[k]
        }
        const res = await fetch('/api/dev', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ...apiPatch }),
        })
        if (!res.ok) throw new Error(`PATCH ${res.status}`)
        setProperties((prev) =>
          prev.map((p) => (p.id === id ? { ...p, ...patch } : p))
        )
        setClosedProperties((prev) =>
          prev.map((p) => (p.id === id ? { ...p, ...patch } : p))
        )
      } catch (e: any) {
        toast.error(`更新失敗：${e?.message || e}`)
        throw e
      } finally {
        setPropertyPendingId(null)
      }
    },
    []
  )

  // === 拜訪卡片：建立行事曆 ===
  const setVisitPick = useCallback((id: string, date: string, time: string) => {
    setVisitPicks((prev) => ({ ...prev, [id]: { date, time } }))
  }, [])

  const handleScheduleVisit = useCallback(
    async (id: string) => {
      const pick = visitPicks[id]
      if (!pick?.date || !pick?.time) {
        toast.error('請先選日期和時間')
        return
      }
      const scheduledAt = `${pick.date}T${pick.time}:00+08:00`
      setVisitSchedulingId(id)
      try {
        const res = await fetch('/api/dev/schedule-visit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, scheduledAt }),
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j?.error || `HTTP ${res.status}`)
        }
        toast.success('已加入 Google Calendar')
        setVisitPicks((prev) => {
          const next = { ...prev }
          delete next[id]
          return next
        })
        await fetchProperties()
      } catch (e: any) {
        toast.error(`建立行事曆失敗：${e?.message || e}`)
      } finally {
        setVisitSchedulingId(null)
      }
    },
    [visitPicks, fetchProperties]
  )

  const handlePropertyModalSave = useCallback(
    async (id: string, patch: Partial<DevProperty>, opts?: { autoPromoted?: boolean }) => {
      await patchProperty(id, patch)
      if (opts?.autoPromoted) {
        toast.success('手機已填、自動升級到「追蹤」')
      } else {
        toast.success('已保存')
      }
    },
    [patchProperty]
  )

  // 開發信「已寄出」: 先 fade 300ms、再實際 patch → 卡片自動從待寄消失
  const handleMarkDevLetterSent = useCallback(
    (id: string) => {
      setFadingDevLetters((prev) => {
        const next = new Set(prev)
        next.add(id)
        return next
      })
      // 從產生標籤勾選列表也移除
      setSelectedDevLetterIds((prev) => {
        if (!prev.has(id)) return prev
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      window.setTimeout(() => {
        patchProperty(id, { devLetter: true })
          .catch(() => {})
          .finally(() => {
            setFadingDevLetters((prev) => {
              const next = new Set(prev)
              next.delete(id)
              return next
            })
          })
      }, 300)
    },
    [patchProperty]
  )

  // 切換 sub-tab / pending↔sent 時清空產生標籤勾選
  useEffect(() => {
    setSelectedDevLetterIds(new Set())
  }, [entrustSubTab, entrustDevLetterFilter])

  // 一筆 property 會產幾張 label：直接看 Notion「物件地址」「戶藉地址」兩個欄位
  // letter 內容不參與判斷（只是給人複製用）。戶藉欄位是「同」「同上」等視為等同物件
  const labelCountFor = useCallback((prop: DevProperty): number => {
    const sameMarkers = ['同', '同上', '同物件地址', '同物件', '同地址']
    const addr = (prop.address || '').trim()
    let h = (prop.householdAddress || '').trim()
    if (sameMarkers.includes(h)) h = ''
    if (!addr && !h) return 0
    if (!addr || !h) return 1
    if (addr.replace(/\s+/g, '') === h.replace(/\s+/g, '')) return 1
    return 2
  }, [])

  // totalSelectedLabels / handleGenerateLabels 定義在 filteredProperties 之後

  const selectedProperty = useMemo(
    () =>
      properties.find((p) => p.id === selectedPropertyId) ||
      closedProperties.find((p) => p.id === selectedPropertyId) ||
      null,
    [properties, closedProperties, selectedPropertyId]
  )

  // === 委託 tab：篩選後的列表 ===
  const filteredProperties = useMemo(() => {
    const want = ENTRUST_TAB_TO_STATUS[entrustSubTab]
    let list = properties.filter((p) => p.status === want)
    if (entrustSubTab === '開發') {
      if (devSubTab === 'letter') {
        list = list.filter((p) =>
          entrustDevLetterFilter === 'sent' ? p.devLetter === true : !p.devLetter
        )
      } else {
        const want = DEV_SUBTAB_VISIT[devSubTab]
        list = list.filter((p) => p.visitTodo === want)
        // 戶藉 tab 額外吃區域 filter（單選）
        if (devSubTab === 'visit-household' || devSubTab === 'revisit-household') {
          list = list.filter((p) => classifyHouseholdRegion(p.householdAddress) === householdRegion)
        }
      }
    }
    const q = entrustSearchTerm.trim().toLowerCase()
    if (q) {
      list = list.filter((p) => {
        const hay = [
          p.name,
          p.owner,
          p.address,
          p.ownerPhone,
        ].filter(Boolean).join(' ').toLowerCase()
        return hay.includes(q)
      })
    }
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [properties, entrustSubTab, devSubTab, entrustDevLetterFilter, entrustSearchTerm, householdRegion])

  const propertyCounts = useMemo(() => {
    const c: Record<EntrustSubTab, number> = { '開發': 0, '追蹤': 0, '委託': 0 }
    for (const p of properties) {
      for (const t of Object.keys(ENTRUST_TAB_TO_STATUS) as EntrustSubTab[]) {
        if (p.status === ENTRUST_TAB_TO_STATUS[t]) c[t]++
      }
    }
    return c
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [properties])

  // 戶藉 tab 內、區域 chip 計數（過濾「該 visitTodo + 募集」後再分區）
  const householdRegionCounts = useMemo(() => {
    const c: Record<HouseholdRegion, number> = { kaohsiung: 0, south: 0, north: 0 }
    if (entrustSubTab !== '開發') return c
    if (devSubTab !== 'visit-household' && devSubTab !== 'revisit-household') return c
    const wantVisit = DEV_SUBTAB_VISIT[devSubTab]
    for (const p of properties) {
      if (p.status !== '募集') continue
      if (p.visitTodo !== wantVisit) continue
      const r = classifyHouseholdRegion(p.householdAddress)
      c[r]++
    }
    return c
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [properties, entrustSubTab, devSubTab])

  // 開發 sub-tab 內各分頁的計數（僅 募集 物件）
  const devSubTabCounts = useMemo(() => {
    const c: Record<DevSubTab, number> = {
      'visit-property': 0,
      'revisit-property': 0,
      'visit-household': 0,
      'revisit-household': 0,
      'letter': 0,
    }
    for (const p of properties) {
      if (p.status !== '募集') continue
      if (p.visitTodo === '物件地拜訪') c['visit-property']++
      else if (p.visitTodo === '物件地覆訪') c['revisit-property']++
      else if (p.visitTodo === '戶藉地拜訪') c['visit-household']++
      else if (p.visitTodo === '戶藉地覆訪') c['revisit-household']++
      else if (!p.devLetter) c['letter']++
      // devLetter=true 且 visitTodo 空 → 算「已寄留底」、不計入 letter 待寄（裡面已寄子分頁仍可見）
    }
    return c
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [properties])

  // 產生標籤：勾選總 label 數 + 下載 handler
  const totalSelectedLabels = useMemo(() => {
    let n = 0
    for (const p of filteredProperties) {
      if (selectedDevLetterIds.has(p.id)) n += labelCountFor(p)
    }
    return n
  }, [filteredProperties, selectedDevLetterIds, labelCountFor])

  function formatLabelCounter(total: number): string {
    if (total === 0) return '0/6'
    const full = Math.floor(total / 6)
    const rem = total % 6
    if (full === 0) return `${rem}/6`
    if (rem === 0) return `${full}頁`
    return `${full}頁 ${rem}/6`
  }

  const handleGenerateLabels = useCallback(async () => {
    const ids = Array.from(selectedDevLetterIds).filter((id) =>
      filteredProperties.find((p) => p.id === id)
    )
    if (ids.length === 0) {
      toast.error('請先勾選物件')
      return
    }
    setGeneratingLabels(true)
    try {
      const res = await fetch('/api/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyIds: ids }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error || `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const cd = res.headers.get('content-disposition') || ''
      let fname = 'labels.docx'
      const m = cd.match(/filename\*=UTF-8''([^;]+)/i) || cd.match(/filename="([^"]+)"/i)
      if (m) {
        try { fname = decodeURIComponent(m[1]) } catch { fname = m[1] }
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fname
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`已下載 ${fname}`)
      // 下載成功後自動把這些物件標記為 已寄出 → 切到「已寄留底」
      for (const id of ids) {
        handleMarkDevLetterSent(id)
      }
      setSelectedDevLetterIds(new Set())
    } catch (e: any) {
      toast.error(`產生標籤失敗：${e?.message || e}`)
    } finally {
      setGeneratingLabels(false)
    }
  }, [selectedDevLetterIds, filteredProperties, handleMarkDevLetterSent])

  const openPropertyModal = (id: string) => {
    setSelectedPropertyId(id)
    setPropertyModalOpen(true)
  }
  const closePropertyModal = () => {
    setPropertyModalOpen(false)
    // 保留 selectedPropertyId 短時間、避免 modal 飛走時 prop 變 null
    setTimeout(() => setSelectedPropertyId(null), 200)
  }

  // 選中客戶時載入詳情
  const fetchClientDetail = useCallback(async (clientId: string) => {
    setLoadingDetail(true)
    try {
      const [todosRes, blocksRes] = await Promise.all([
        fetch(`/api/clients/${clientId}/todos?待辦=false`),
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

  // === A1. 收合 localStorage 同步（一鍵同收重要事項 + 待辦） ===
  const toggleDashboardCollapsed = useCallback(() => {
    setDashboardCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('crm.topBar.collapsed', String(next))
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
  // 流程：checked → await PATCH → (ok) strikethrough/fading/remove + toast / (fail) rollback + 紅 toast
  const handleAnimatedToggleTodo = useCallback(async (todoId: string, title: string) => {
    setTodoAnimPhase((prev) => ({ ...prev, [todoId]: 'checked' }))

    try {
      const res = await fetch(`/api/clients/todos/${todoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ todoFlag: true }),
      })
      if (!res.ok) throw new Error(`PATCH ${res.status}`)
    } catch (err) {
      console.error('toggle todo failed:', err)
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

      toast.success(`✓ 已完成：${title.slice(0, 20)}`, {
        action: {
          label: '復原',
          onClick: async () => {
            try {
              const res = await fetch(`/api/clients/todos/${todoId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ todoFlag: false }),
              })
              if (!res.ok) throw new Error(`PATCH ${res.status}`)
              fetchDashboard()
              toast.success('已復原')
            } catch (err) {
              console.error('undo todo failed:', err)
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
      }
    } finally {
      setSubmitting(null)
    }
  }

  // 動畫版 toggle 客戶待辦完成（對齊白色 handleAnimatedToggleTodo 時序：300/600/800 ms）
  // 流程：checked → await PATCH → (ok) strikethrough → fading → remove / (fail) rollback（不 toast）
  const handleAnimatedToggleClientTodo = useCallback(async (todoId: string) => {
    setTodoAnimPhase((prev) => ({ ...prev, [todoId]: 'checked' }))

    try {
      const res = await fetch(`/api/clients/todos/${todoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ todoFlag: true }),
      })
      if (!res.ok) throw new Error(`PATCH ${res.status}`)
    } catch (err) {
      console.error('toggle client todo failed:', err)
      setTodoAnimPhase((prev) => ({ ...prev, [todoId]: 'idle' }))
      return
    }

    setTimeout(() => {
      setTodoAnimPhase((prev) => ({ ...prev, [todoId]: 'strikethrough' }))
    }, 300)

    setTimeout(() => {
      setTodoAnimPhase((prev) => ({ ...prev, [todoId]: 'fading' }))
    }, 600)

    setTimeout(() => {
      setClientTodos((prev) => prev.filter((t) => t.id !== todoId))
      setTodoItems((prev) => prev.filter((t) => t.id !== todoId))
      setTodoAnimPhase((prev) => {
        const next = { ...prev }
        delete next[todoId]
        return next
      })
    }, 800)
  }, [])

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

  // D. 洽談快速記錄（雙寫 PG + Notion，自動 +3 天跟進）
  const handleQuickLogOrProgress = async () => {
    const content = newProgressText.trim()
    if (!content || !selectedClientId) return

    setSubmitting('progress')
    try {
      const res = await fetch(`/api/clients/${selectedClientId}/quick-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (!res.ok) throw new Error('API error')
      const data = await res.json()

      // 更新之前進度（只在 Notion append 成功時 prepend）
      if (data.blockId && data.text) {
        setClientBlocks((prev) => [
          { id: data.blockId, text: data.text, createdTime: new Date().toISOString() },
          ...prev,
        ])
      }
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

      // 送出後重新 focus 方便連續輸入
      setTimeout(() => progressInputRef.current?.focus(), 0)
    } catch {
      toast.error('送出失敗，請重試')
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
    setIsmartLookupInput('')
    setIsmartLookupStatus('idle')
    setIsmartLookupMessage('')
    setYcutCaseIdx(null)
    ismartRequestIdRef.current = null
    if (ismartTimeoutRef.current) {
      window.clearTimeout(ismartTimeoutRef.current)
      ismartTimeoutRef.current = null
    }
    setShowViewingModal(true)
  }

  // B6: i智慧 物件查詢（透過 Tampermonkey userscript 代打 API）
  const handleIsmartLookup = () => {
    const input = ismartLookupInput.trim()
    if (!input) return
    if (ismartLookupStatus === 'loading') return
    const requestId =
      (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `req-${Date.now()}-${Math.random().toString(36).slice(2)}`
    ismartRequestIdRef.current = requestId
    setIsmartLookupStatus('loading')
    setIsmartLookupMessage('查詢中…')
    window.postMessage({ type: 'CRM_ISMART_LOOKUP', requestId, caseNumber: input }, '*')
    if (ismartTimeoutRef.current) window.clearTimeout(ismartTimeoutRef.current)
    ismartTimeoutRef.current = window.setTimeout(() => {
      if (ismartRequestIdRef.current !== requestId) return
      ismartRequestIdRef.current = null
      setIsmartLookupStatus('error')
      setIsmartLookupMessage('⚠️ userscript 無回應，請確認 Tampermonkey 已啟用 + 已安裝 userscript')
    }, 15000) as unknown as number
  }

  // B7 UX 續攤：社區名變更 → 自動補樂居連結。
  // 綁 useEffect on state 變更（不是 onBlur），以支援 userscript postMessage 灌值這條路徑
  // —— userscript setState 不會觸發 input 的 blur 事件，原本綁 onBlur 的版本永遠不會 fire。
  // 500ms debounce 避免使用者逐字輸入時浪費 Serper 配額（2500 次免費額度有限）。
  // cancelled flag 防 race：使用者快速改社區名，舊請求回來時不覆蓋新值。
  useEffect(() => {
    if (!showViewingModal) return
    const name = viewingCommunityName.trim()
    if (!name) return                              // 空名不搜（痛點 2：公寓/透天留空）
    if (viewingCommunityLejuUrl.trim()) return     // 已有值（使用者手填 / CommunityAutocomplete cache 帶入）不覆蓋
    let cancelled = false
    const t = setTimeout(async () => {
      if (cancelled) return
      setLejuSearching(true)
      try {
        const res = await fetch(`/api/search/leju?name=${encodeURIComponent(name)}`)
        const data = await res.json().catch(() => null)
        if (!cancelled && res.ok && data?.url && typeof data.url === 'string') {
          setViewingCommunityLejuUrl((prev) => (prev.trim() ? prev : data.url))
        }
      } catch (err) {
        if (!cancelled) console.error('leju search failed:', err)
      } finally {
        if (!cancelled) setLejuSearching(false)
      }
    }, 500)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [viewingCommunityName, viewingCommunityLejuUrl, showViewingModal])

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

  // B6: 監聽 userscript 回傳的 i智慧 查詢結果
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.source !== window) return
      const data = event.data as any
      if (!data || typeof data !== 'object') return
      if (data.type !== 'CRM_ISMART_LOOKUP_RESULT') return
      if (data.requestId !== ismartRequestIdRef.current) return
      if (ismartTimeoutRef.current) {
        window.clearTimeout(ismartTimeoutRef.current)
        ismartTimeoutRef.current = null
      }
      ismartRequestIdRef.current = null

      if (data.ok && data.data) {
        const d = data.data
        // B6.1：所有欄位都「空才覆寫」，支援二次按帶入只補空欄、不洗掉手動編輯
        const applyIfEmpty = (
          setter: (updater: (prev: string) => string) => void,
          next?: string,
        ) => {
          if (!next) return
          setter((prev) => (prev.trim() !== '' ? prev : next))
        }
        applyIfEmpty(setViewingCommunityName, d.communityName)
        applyIfEmpty(setViewingCommunityUrl, d.shareUrl)
        applyIfEmpty(setViewingColleagueName, d.agentName)
        applyIfEmpty(setViewingColleaguePhone, d.agentPhone)
        applyIfEmpty(setViewingLocation, d.address)
        // 備註欄不再自動填 x樓/共x樓（使用者要求留空自己寫）
        setYcutCaseIdx(typeof d.ycutCaseIdx === 'string' && d.ycutCaseIdx ? d.ycutCaseIdx : null)
        setIsmartLookupStatus('ok')
        const bits = [d.communityName, d.agentName].filter(Boolean).join(' / ')
        const base = bits ? `✅ 已帶入（${bits}）` : '✅ 已帶入'
        const missing = Array.isArray(data.missing) ? data.missing : []
        setIsmartLookupMessage(missing.length ? `${base}｜未帶入：${missing.join('、')}` : base)
      } else {
        const error = (data.error || '') as string
        const message = (data.message || '查詢失敗') as string
        setYcutCaseIdx(null)
        if (error === 'auth_expired') {
          setIsmartLookupStatus('auth_expired')
          setIsmartLookupMessage(message)
        } else {
          setIsmartLookupStatus('error')
          setIsmartLookupMessage(`⚠️ ${message}`)
        }
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  // B6: Modal 打開時做 PING/PONG 握手，確認 userscript 有在這個 tab 活著。
  // 放在獨立 useEffect 裡，不跟 SSR/hydration 打架。
  useEffect(() => {
    if (!showViewingModal) return
    setUserscriptReady(false)
    const handler = (event: MessageEvent) => {
      if (event.source !== window) return
      const data = event.data as any
      if (!data || typeof data !== 'object') return
      if (data.type === 'CRM_ISMART_PONG') setUserscriptReady(true)
    }
    window.addEventListener('message', handler)
    window.postMessage({ type: 'CRM_ISMART_PING' }, '*')
    return () => window.removeEventListener('message', handler)
  }, [showViewingModal])

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
            <button
              onClick={toggleDashboardCollapsed}
              className="ml-auto flex items-center gap-1.5 p-1.5 border border-slate-600 hover:border-indigo-500 bg-slate-900 text-slate-300 hover:text-indigo-400 rounded transition-colors"
              aria-label={dashboardCollapsed ? '展開重要事項與待辦' : '收合重要事項與待辦'}
              title={dashboardCollapsed ? '展開重要事項與待辦' : '收合重要事項與待辦'}
            >
              {dashboardCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
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

              {!dashboardCollapsed && (
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

              {!dashboardCollapsed && (
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
              { key: 'marketing', label: '行銷', icon: Users, active: 'border-sky-500 text-sky-400 bg-sky-500/10' },
              { key: 'entrust', label: '委託', icon: FileText, active: 'border-amber-500 text-amber-400 bg-amber-500/10' },
              { key: 'closed', label: '成交客戶', icon: Award, active: 'border-indigo-500 text-indigo-400 bg-indigo-500/10' },
              { key: 'videos', label: '短影音', icon: Video, active: 'border-emerald-500 text-emerald-400 bg-emerald-500/10' },
              { key: 'ai', label: 'AI', icon: Zap, active: 'border-violet-500 text-violet-400 bg-violet-500/10' },
            ] as const).map(({ key, label, icon: Icon, active }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all border-b-2 ${
                  activeTab === key
                    ? active
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
                          {/* 物件配對（Phase 1 白名單）— 跳 i智慧 深連結 */}
                          {selectedClient.name?.trim() &&
                            selectedClient.textId &&
                            OBJECT_MATCH_WHITELIST.includes(selectedClient.textId.trim()) && (
                              <button
                                onClick={() => {
                                  const name = encodeURIComponent(selectedClient.name.trim())
                                  const id = encodeURIComponent(selectedClient.textId!.trim())
                                  window.open(
                                    `https://is.ycut.com.tw/magent/CustomerNew.aspx#match=${name}&id=${id}`,
                                    '_blank',
                                    'noopener,noreferrer'
                                  )
                                }}
                                className="flex items-center gap-1 px-2 py-0.5 text-xs bg-slate-700/60 hover:bg-slate-600 text-slate-300 rounded transition-colors whitespace-nowrap"
                                title="到 i智慧 物件配對頁"
                              >
                                🔗 物件配對
                              </button>
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
                            const phase = todoAnimPhase[todo.id] || 'idle'
                            return (
                              <div
                                key={todo.id}
                                className={`flex items-center gap-2 text-sm transition-all duration-200 ${style.bg} ${
                                  phase === 'fading' ? 'opacity-0 max-h-0 overflow-hidden' : 'opacity-100 max-h-20'
                                }`}
                              >
                                <button
                                  onClick={() => handleAnimatedToggleClientTodo(todo.id)}
                                  disabled={phase !== 'idle'}
                                  className="text-slate-500 hover:text-green-400 transition-colors shrink-0"
                                >
                                  {phase === 'idle' ? (
                                    <Square size={14} />
                                  ) : (
                                    <CheckSquare size={14} className="text-green-500" />
                                  )}
                                </button>
                                <span
                                  className={`transition-all duration-300 ${
                                    phase === 'strikethrough' || phase === 'fading'
                                      ? 'line-through text-slate-500'
                                      : style.text
                                  }`}
                                >
                                  {todo.title}
                                </span>
                                {phase === 'idle' && style.badge && (
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
                        <div className="space-y-1">
                          {[...clientBlocks]
                            .sort((a, b) => {
                              const at = a.createdTime ? new Date(a.createdTime).getTime() : 0
                              const bt = b.createdTime ? new Date(b.createdTime).getTime() : 0
                              return at - bt
                            })
                            .map((block) => (
                              <BlockItem
                                key={block.id}
                                block={block}
                                onUpdate={(patch) =>
                                  setClientBlocks((prev) =>
                                    prev.map((b) => (b.id === block.id ? { ...b, ...patch } : b))
                                  )
                                }
                                onDelete={() =>
                                  setClientBlocks((prev) => prev.filter((b) => b.id !== block.id))
                                }
                              />
                            ))}
                        </div>
                      )}
                    </div>

                    {/* ④ 目前進度 + D. 快速記錄 + C. 自動設跟進提示 */}
                    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-indigo-400 mb-3">目前進度</h3>
                      {/* D. 洽談模式切換按鈕（純 UX 提示：送出時固定記成洽談） */}
                      <div className="flex gap-2 mb-2">
                        <button
                          onClick={() => setConversationModeOn((v) => !v)}
                          className={`px-3 py-1.5 text-sm rounded transition-colors ${
                            conversationModeOn
                              ? 'bg-purple-600 ring-2 ring-purple-400 text-white'
                              : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                          }`}
                        >
                          📞 洽談
                        </button>
                      </div>
                      <div className="flex flex-col gap-2">
                        <textarea
                          ref={progressInputRef}
                          rows={4}
                          placeholder="輸入洽談內容（Enter 換行、Ctrl/Cmd+Enter 送出）"
                          value={newProgressText}
                          onChange={(e) => setNewProgressText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                              e.preventDefault()
                              handleQuickLogOrProgress()
                            }
                          }}
                          className="w-full min-h-[96px] max-h-48 resize-none bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                        <button
                          onClick={handleQuickLogOrProgress}
                          disabled={submitting === 'progress' || !newProgressText.trim()}
                          className="self-end px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm rounded transition-colors"
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
          <div>
            {/* 篩選 chips + 搜尋 + 新增物件（鏡像行銷頂列） */}
            <div className="px-6 py-4 border-b border-slate-700 flex items-center gap-4 flex-wrap">
              <div className="flex gap-2">
                {(Object.keys(ENTRUST_TAB_TO_STATUS) as EntrustSubTab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setEntrustSubTab(t)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      entrustSubTab === t
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    {t}
                    <span className="ml-1.5 text-xs opacity-70">{propertyCounts[t]}</span>
                  </button>
                ))}
              </div>
              <div className="flex-1 relative max-w-xs">
                <Search className="absolute left-3 top-2 text-slate-500" size={16} />
                <input
                  type="text"
                  placeholder="搜尋物件 / 屋主 / 地址 / 電話"
                  value={entrustSearchTerm}
                  onChange={(e) => setEntrustSearchTerm(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <button
                onClick={fetchProperties}
                disabled={propertiesLoading}
                className="text-xs text-slate-400 hover:text-white px-2 py-1.5 rounded border border-slate-700 disabled:opacity-50"
                title="重新整理"
              >
                {propertiesLoading ? '載入中…' : '↻ 重新整理'}
              </button>
              <button
                onClick={() => toast.info('新增物件功能尚未開放')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors ml-auto"
                title="新增物件"
              >
                <Plus size={14} />
                新增物件
              </button>
            </div>

            {/* 開發 sub-tabs：拜訪/覆訪/待寄信 */}
            {entrustSubTab === '開發' && (
              <div className="px-6 py-2 border-b border-slate-700 flex gap-2 flex-wrap">
                {DEV_SUBTAB_ORDER.map((t) => (
                  <button
                    key={t}
                    onClick={() => setDevSubTab(t)}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded border transition-colors ${
                      devSubTab === t
                        ? 'border-indigo-500 bg-indigo-950/50 text-indigo-200'
                        : 'border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t === 'letter' ? <Send size={12} /> : <MapPin size={12} />}
                    {DEV_SUBTAB_LABEL[t]}
                    <span className="ml-0.5 opacity-70">{devSubTabCounts[t]}</span>
                  </button>
                ))}
                {/* 待寄信 內的 已寄留底 切換 */}
                {devSubTab === 'letter' && (
                  <div className="flex gap-1 ml-2 pl-2 border-l border-slate-700">
                    <button
                      onClick={() => setEntrustDevLetterFilter('pending')}
                      className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors ${
                        entrustDevLetterFilter === 'pending'
                          ? 'border-indigo-500 bg-indigo-950/50 text-indigo-200'
                          : 'border-slate-700 text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      待寄
                    </button>
                    <button
                      onClick={() => setEntrustDevLetterFilter('sent')}
                      className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors ${
                        entrustDevLetterFilter === 'sent'
                          ? 'border-emerald-600 bg-emerald-950/40 text-emerald-200'
                          : 'border-slate-700 text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      <Eye size={11} /> 已寄留底
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* === 開發 view：待寄信卡片 (含待寄/已寄留底) === */}
            {entrustSubTab === '開發' && devSubTab === 'letter' && (
              <div className="px-6 py-5">
                {propertiesError && (
                  <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-rose-950/40 border border-rose-900/60 rounded text-rose-300 text-sm">
                    <AlertTriangle size={14} />
                    {propertiesError}
                  </div>
                )}
                {propertiesLoading ? (
                  <div className="flex items-center justify-center py-16 text-slate-500">
                    <Loader2 className="animate-spin" size={20} />
                  </div>
                ) : filteredProperties.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-sm">
                    {entrustSearchTerm
                      ? '沒有符合搜尋的物件'
                      : entrustDevLetterFilter === 'sent'
                      ? '尚無已寄留底的物件'
                      : '目前沒有待寄的開發信物件'}
                  </div>
                ) : entrustDevLetterFilter === 'pending' ? (
                  /* 待寄：每筆物件一張卡片、物信戶信左右並排 */
                  <div className="max-w-5xl mx-auto">
                    {/* 產生標籤 action bar */}
                    {(() => {
                      const eligibleIds = filteredProperties.filter((p) => labelCountFor(p) > 0).map((p) => p.id)
                      const allSelected = eligibleIds.length > 0 && eligibleIds.every((id) => selectedDevLetterIds.has(id))
                      return (
                        <div className="mb-3 flex items-center justify-between gap-3 bg-slate-800/40 border border-slate-700 rounded-lg px-4 py-2 flex-wrap">
                          <div className="flex items-center gap-3 text-sm text-slate-300">
                            <button
                              onClick={() =>
                                setSelectedDevLetterIds(allSelected ? new Set() : new Set(eligibleIds))
                              }
                              disabled={eligibleIds.length === 0}
                              className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                                eligibleIds.length === 0
                                  ? 'border-slate-700 text-slate-600 cursor-not-allowed'
                                  : allSelected
                                  ? 'border-indigo-500 bg-indigo-950/50 text-indigo-200 hover:bg-indigo-950/70'
                                  : 'border-slate-600 text-slate-300 hover:border-indigo-500 hover:text-indigo-300'
                              }`}
                              title={allSelected ? '取消全選' : `全選 ${eligibleIds.length} 筆`}
                            >
                              {allSelected ? '取消全選' : '全選'}
                            </button>
                            <span>
                              勾選 <span className="text-white font-medium">{selectedDevLetterIds.size}</span> 筆、共
                              <span className="ml-1 px-1.5 py-0.5 rounded bg-indigo-950/60 text-indigo-300 font-mono text-xs">{formatLabelCounter(totalSelectedLabels)}</span>
                              <span className="ml-1 text-xs text-slate-500">張標籤</span>
                            </span>
                          </div>
                          <button
                            onClick={handleGenerateLabels}
                            disabled={totalSelectedLabels === 0 || generatingLabels}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                            title="產生 .docx 並下載"
                          >
                            <FileDown size={14} />
                            {generatingLabels ? '產生中…' : '產生標籤'}
                          </button>
                        </div>
                      )
                    })()}
                    <div className="space-y-3">
                    {filteredProperties.map((prop) => {
                      const isFading = fadingDevLetters.has(prop.id)
                      const isSelected = selectedDevLetterIds.has(prop.id)
                      const count = labelCountFor(prop)
                      return (
                      <div
                        key={prop.id}
                        className={`bg-slate-800/40 border rounded-lg overflow-hidden transition-all duration-300 ${
                          isFading ? 'opacity-30 grayscale pointer-events-none border-slate-700' : isSelected ? 'border-indigo-500/60' : 'border-slate-700'
                        }`}
                      >
                        {/* 卡片頭：checkbox + 張數 + 物件名 + 屋主 + 已寄出 + 物件地址 */}
                        <div className="px-4 py-2 border-b border-slate-700 flex items-center gap-3 flex-wrap">
                          <button
                            onClick={() => {
                              setSelectedDevLetterIds((prev) => {
                                const next = new Set(prev)
                                if (next.has(prop.id)) next.delete(prop.id)
                                else next.add(prop.id)
                                return next
                              })
                            }}
                            disabled={count === 0}
                            className={`transition-colors ${
                              count === 0
                                ? 'text-slate-700 cursor-not-allowed'
                                : isSelected
                                ? 'text-indigo-400 hover:text-indigo-300'
                                : 'text-slate-500 hover:text-slate-300'
                            }`}
                            title={count === 0 ? '無物件地址、無法產生標籤' : isSelected ? '取消勾選' : '勾選'}
                          >
                            {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                          </button>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded border ${
                              count === 2
                                ? 'bg-amber-900/30 text-amber-300 border-amber-800/60'
                                : count === 1
                                ? 'bg-slate-700/50 text-slate-300 border-slate-600'
                                : 'bg-slate-800/50 text-slate-500 border-slate-700'
                            }`}
                            title={count === 2 ? '物件地 + 戶藉地各一張' : count === 1 ? '物件地一張' : '無地址'}
                          >
                            {count} 張
                          </span>
                          <a
                            href={`https://www.notion.so/${prop.id.replace(/-/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-base font-bold text-white hover:text-indigo-400 transition-colors truncate"
                            title="開啟 Notion 頁面"
                          >
                            {prop.name}
                          </a>
                          {prop.owner && (
                            <span className="text-sm text-slate-300">屋主：{prop.owner}</span>
                          )}
                        </div>
                        {/* 物件 / 戶藉 兩列地址 */}
                        <div className="px-4 py-2 space-y-1 text-sm">
                          <div className="flex gap-2">
                            <span className="text-slate-500 shrink-0 w-12">物件：</span>
                            <span className="text-slate-300 whitespace-pre-wrap break-all">
                              {prop.address || <span className="text-slate-600">（未填）</span>}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-slate-500 shrink-0 w-12">戶藉：</span>
                            <span className="text-slate-300 whitespace-pre-wrap break-all">
                              {prop.householdAddress || <span className="text-slate-600">（未填）</span>}
                            </span>
                          </div>
                        </div>
                      </div>
                      )
                    })}
                    </div>
                  </div>
                ) : (
                  /* 已寄留底：壓縮列、單行卡片 */
                  <div className="space-y-1 max-w-4xl mx-auto">
                    {filteredProperties.map((prop) => (
                      <div
                        key={prop.id}
                        className="bg-slate-800/40 border border-slate-700 rounded px-3 py-2 flex items-center gap-3 flex-wrap text-sm hover:border-slate-500 transition-colors"
                      >
                        <a
                          href={`https://www.notion.so/${prop.id.replace(/-/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-white hover:text-indigo-400 transition-colors truncate"
                          title="開啟 Notion 頁面"
                        >
                          {prop.name}
                        </a>
                        {prop.owner && <span className="text-slate-400">屋主：{prop.owner}</span>}
                        {prop.address && <span className="text-slate-500 truncate">{prop.address}</span>}
                        <button
                          onClick={() =>
                            patchProperty(prop.id, { devLetter: false }).catch(() => {})
                          }
                          disabled={propertyPendingId === prop.id}
                          className="ml-auto p-1 text-slate-500 hover:text-indigo-400 transition-colors"
                          title="復原、移回待寄"
                        >
                          <Undo2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* === 開發 view：拜訪/覆訪 卡片 === */}
            {entrustSubTab === '開發' && devSubTab !== 'letter' && (
              <div className="px-6 py-5">
                {propertiesError && (
                  <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-rose-950/40 border border-rose-900/60 rounded text-rose-300 text-sm">
                    <AlertTriangle size={14} />
                    {propertiesError}
                  </div>
                )}
                {/* 戶藉 tab：區域 filter chip */}
                {(devSubTab === 'visit-household' || devSubTab === 'revisit-household') && (
                  <div className="mb-3 flex items-center gap-2 flex-wrap text-xs">
                    <span className="text-slate-500">區域：</span>
                    {([
                      { key: 'kaohsiung' as HouseholdRegion, label: '高雄' },
                      { key: 'south' as HouseholdRegion, label: '南部' },
                      { key: 'north' as HouseholdRegion, label: '中北部' },
                    ]).map(({ key, label }) => {
                      const on = householdRegion === key
                      return (
                        <button
                          key={key}
                          onClick={() => setHouseholdRegion(key)}
                          className={`px-2.5 py-1 rounded border transition-colors flex items-center gap-1 ${
                            on
                              ? 'border-indigo-500 bg-indigo-950/50 text-indigo-200'
                              : 'border-slate-700 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {label}
                          <span className="opacity-70">{householdRegionCounts[key]}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
                {propertiesLoading ? (
                  <div className="flex items-center justify-center py-16 text-slate-500">
                    <Loader2 className="animate-spin" size={20} />
                  </div>
                ) : filteredProperties.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-sm">
                    {entrustSearchTerm
                      ? '沒有符合搜尋的物件'
                      : (devSubTab === 'visit-household' || devSubTab === 'revisit-household') &&
                        Object.values(householdRegionCounts).some((n) => n > 0)
                      ? '此區域沒有物件、試試切換區域'
                      : `目前沒有「${DEV_SUBTAB_LABEL[devSubTab]}」待辦的物件`}
                  </div>
                ) : (
                  <div className="max-w-5xl mx-auto space-y-3">
                    {filteredProperties.map((prop) => {
                      const isHousehold = devSubTab === 'visit-household' || devSubTab === 'revisit-household'
                      const displayAddr = isHousehold ? prop.householdAddress : prop.address
                      const savedPick = parseISOToPick(prop.nextVisitAt)
                      const userPick = visitPicks[prop.id]
                      const displayPick = userPick || savedPick
                      const hasUserChange = !!userPick && (userPick.date !== savedPick.date || userPick.time !== savedPick.time)
                      const canSubmit = !!displayPick.date && !!displayPick.time && (!prop.nextVisitAt || hasUserChange)
                      const isScheduling = visitSchedulingId === prop.id
                      return (
                        <div
                          key={prop.id}
                          className="bg-slate-800/40 border border-slate-700 rounded-lg overflow-hidden"
                        >
                          {/* 頭：物件名 + 屋主 */}
                          <div className="px-4 py-2 border-b border-slate-700 flex items-center gap-3 flex-wrap">
                            <a
                              href={`https://www.notion.so/${prop.id.replace(/-/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-base font-bold text-white hover:text-indigo-400 transition-colors truncate"
                              title="開啟 Notion 頁面"
                            >
                              {prop.name}
                            </a>
                            {prop.owner && (
                              <span className="text-sm text-slate-300">屋主：{prop.owner}</span>
                            )}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {prop.occupancy && (
                                <span
                                  className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                    prop.occupancy === '空屋'
                                      ? 'bg-emerald-500/25 text-emerald-200'
                                      : prop.occupancy === '自住'
                                        ? 'bg-orange-500/25 text-orange-200'
                                        : 'bg-slate-700/60 text-slate-300'
                                  }`}
                                >
                                  {prop.occupancy}
                                </span>
                              )}
                              {prop.area && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-300">
                                  {prop.area.endsWith('坪') ? prop.area : `${prop.area}坪`}
                                </span>
                              )}
                              {prop.price && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-300">
                                  {prop.price.endsWith('萬') ? prop.price : `${prop.price}萬`}
                                </span>
                              )}
                              {prop.layout && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-300">
                                  {prop.layout}
                                </span>
                              )}
                              {prop.web && (
                                <a
                                  href={prop.web}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs px-1.5 py-0.5 rounded bg-indigo-900/40 text-indigo-300 hover:bg-indigo-800/50 hover:text-indigo-200 transition-colors"
                                  title="開啟社區網頁"
                                >
                                  社區
                                </a>
                              )}
                            </div>
                            {prop.ownerPhone && (
                              <a
                                href={`tel:${prop.ownerPhone}`}
                                className="ml-auto text-xs text-slate-400 hover:text-indigo-400 flex items-center gap-1"
                                title="撥打"
                              >
                                <Phone size={12} /> {prop.ownerPhone}
                              </a>
                            )}
                          </div>
                          {/* 地址 */}
                          <div className="px-4 py-2 text-sm flex gap-2">
                            <span className="text-slate-500 shrink-0 w-12">
                              {isHousehold ? '戶藉：' : '物件：'}
                            </span>
                            <span className="text-slate-300 whitespace-pre-wrap break-all">
                              {displayAddr || <span className="text-slate-600">（未填）</span>}
                            </span>
                          </div>
                          {/* 排程列：picker + 建立行事曆。已排 / 未排 共用同一個 layout */}
                          <div className="px-4 py-2 border-t border-slate-700 flex items-center gap-2 flex-wrap">
                            <DateTimePopover
                              date={displayPick.date}
                              time={displayPick.time}
                              hour12
                              showLabel
                              labelPrefix={prop.nextVisitAt && !hasUserChange ? '已排' : ''}
                              onChange={(d, t) => setVisitPick(prop.id, d, t)}
                              title={prop.nextVisitAt ? '改時間' : '選日期 + 時間'}
                              iconSize={14}
                              buttonClass="text-xs text-slate-400 hover:text-indigo-400 border border-slate-700 hover:border-indigo-500 rounded px-2 py-1 flex items-center gap-1"
                              activeButtonClass="text-xs text-indigo-300 border border-indigo-500/60 bg-indigo-950/40 rounded px-2 py-1 flex items-center gap-1"
                            />
                            <button
                              onClick={() => handleScheduleVisit(prop.id)}
                              disabled={!canSubmit || isScheduling}
                              className="text-xs px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white flex items-center gap-1"
                            >
                              <CalendarPlus size={12} />
                              {isScheduling ? '建立中…' : '建立行事曆'}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* === 追蹤 / 委託 view：左右欄（鏡像行銷） === */}
            {entrustSubTab !== '開發' && (
            <div className="flex" style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}>
              {/* 左側列表 */}
              <div className="w-[280px] shrink-0 border-r border-slate-700 overflow-y-auto">
                {propertiesError && (
                  <div className="m-3 flex items-center gap-2 px-3 py-2 bg-rose-950/40 border border-rose-900/60 rounded text-rose-300 text-sm">
                    <AlertTriangle size={14} />
                    {propertiesError}
                  </div>
                )}
                {propertiesLoading ? (
                  <div className="p-6 flex items-center justify-center text-slate-500">
                    <Loader2 className="animate-spin" size={20} />
                  </div>
                ) : filteredProperties.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-sm">
                    {entrustSearchTerm
                      ? '沒有符合搜尋的物件'
                      : `目前沒有「${entrustSubTab}」物件`}
                  </div>
                ) : (
                  filteredProperties.map((prop) => {
                    const isSelected = prop.id === selectedPropertyId && !propertyModalOpen
                    const expired = prop.expiry ? new Date(prop.expiry).getTime() < Date.now() : false
                    return (
                      <div
                        key={prop.id}
                        onClick={() => {
                          setSelectedPropertyId(prop.id)
                          setEntrustDetailTab('latest')
                        }}
                        className={`px-4 py-3 cursor-pointer transition-all border-l-[3px] ${
                          isSelected
                            ? 'bg-indigo-900/20 border-l-indigo-500'
                            : expired
                            ? 'border-l-red-500/50 hover:bg-red-900/10'
                            : 'border-l-transparent hover:bg-slate-800/50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1 gap-2">
                          <div className="font-medium text-white text-sm flex items-center gap-1.5 min-w-0 flex-1">
                            <span className="truncate min-w-0">{prop.name}</span>
                            {prop.price && (
                              <span className="text-[11px] font-normal shrink-0 whitespace-nowrap text-amber-400">
                                {prop.price}
                              </span>
                            )}
                          </div>
                          {expired && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded border bg-rose-900/50 text-rose-300 border-rose-700 shrink-0">
                              過期
                            </span>
                          )}
                        </div>
                        {prop.address && (
                          <div className="text-xs text-slate-500 truncate">{prop.address}</div>
                        )}
                        {prop.owner && (
                          <div className="text-xs text-slate-500 truncate">屋主：{prop.owner}</div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>

              {/* 右側詳情面板 */}
              <div className="flex-1 min-h-0 overflow-y-auto">
                {!selectedProperty || selectedProperty.status === '成交' ? (
                  <div className="flex items-center justify-center h-full text-slate-500">
                    <div className="text-center">
                      <FileText size={48} className="mx-auto mb-3 opacity-30" />
                      <p>選擇左側物件查看詳情</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 pb-[200px] space-y-4">
                    {/* 物件標頭 + 按鈕（鏡像行銷右側標頭） */}
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h2 className="text-xl font-bold text-white flex items-center gap-2 min-w-0">
                            <span className="truncate">{selectedProperty.name}</span>
                          </h2>
                          {selectedProperty.ownerPhone && (
                            <span className="text-sm text-slate-300 whitespace-nowrap">
                              📱 {selectedProperty.ownerPhone}
                            </span>
                          )}
                          {selectedProperty.owner && (
                            <span className="text-sm text-slate-400 whitespace-nowrap">
                              👤 {selectedProperty.owner}
                            </span>
                          )}
                          {selectedProperty.expiry && (
                            <span className="text-sm text-slate-400 whitespace-nowrap flex items-center gap-1">
                              <Calendar size={14} />
                              到期 {selectedProperty.expiry}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openPropertyModal(selectedProperty.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-sky-700 hover:bg-sky-600 text-white rounded-lg transition-colors"
                          title="開啟詳細編輯"
                        >
                          <FileText size={14} />
                          詳細編輯
                        </button>
                        <a
                          href={`https://www.notion.so/${selectedProperty.id.replace(/-/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
                        >
                          <ExternalLink size={14} />
                          Notion
                        </a>
                      </div>
                    </div>

                    {/* Sub-tab 切換列（最新進度 / 基本資料 / 經營記錄卡） */}
                    <div className="flex gap-1 border-b border-slate-700">
                      {([
                        { key: 'latest', label: '最新進度' },
                        { key: 'basic', label: '基本資料' },
                        { key: 'records', label: '經營記錄卡' },
                      ] as const).map(({ key, label }) => (
                        <button
                          key={key}
                          onClick={() => setEntrustDetailTab(key)}
                          className={`px-4 py-2 text-sm transition-colors border-b-2 -mb-px ${
                            entrustDetailTab === key
                              ? 'border-indigo-500 text-indigo-400'
                              : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {entrustDetailTab === 'basic' && (
                      <div className="space-y-4">
                        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-2 text-sm">
                          <div className="flex gap-3">
                            <span className="w-20 text-slate-500 shrink-0">屋主</span>
                            <span className="text-slate-200">{selectedProperty.owner || '—'}</span>
                          </div>
                          <div className="flex gap-3">
                            <span className="w-20 text-slate-500 shrink-0">電話</span>
                            <span className="text-slate-200">{selectedProperty.ownerPhone || '—'}</span>
                          </div>
                          <div className="flex gap-3">
                            <span className="w-20 text-slate-500 shrink-0">等級</span>
                            <span className="text-slate-200">{selectedProperty.ownerGrade || '—'}</span>
                          </div>
                          <div className="flex gap-3">
                            <span className="w-20 text-slate-500 shrink-0">地址</span>
                            <span className="text-slate-200">{selectedProperty.address || '—'}</span>
                          </div>
                          <div className="flex gap-3">
                            <span className="w-20 text-slate-500 shrink-0">委託到期</span>
                            <span className="text-slate-200">{selectedProperty.expiry || '—'}</span>
                          </div>
                          <div className="flex gap-3">
                            <span className="w-20 text-slate-500 shrink-0">價格</span>
                            <span className="text-slate-200">{selectedProperty.price || '—'}</span>
                          </div>
                          <div className="flex gap-3">
                            <span className="w-20 text-slate-500 shrink-0">狀態</span>
                            <span className="text-slate-200">{selectedProperty.status || '—'}</span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500">完整編輯請點上方「詳細編輯」</p>
                      </div>
                    )}

                    {entrustDetailTab === 'latest' && (
                      <div className="space-y-4">
                        {/* ① 重要事項（鏡像行銷「重要大事」、wiring 後續細修） */}
                        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                          <div className="flex items-center gap-3">
                            <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2 shrink-0">
                              <Star size={14} />
                              重要事項
                            </h3>
                            <input
                              type="text"
                              placeholder="新增重要事項...（尚未串接）"
                              disabled
                              className="flex-1 min-w-0 bg-slate-900 border border-slate-600 rounded px-3 py-1 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                            />
                            <button
                              disabled
                              className="px-2.5 py-1 bg-amber-600 disabled:opacity-50 text-white text-sm rounded shrink-0"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                          {selectedProperty.important ? (
                            <div className="mt-3 text-xs text-amber-300/80 bg-amber-950/30 border border-amber-900/40 rounded px-2 py-1.5">
                              ⚠ {selectedProperty.important}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500 mt-3">目前無重要事項</p>
                          )}
                        </div>

                        {/* ② 待辦事項（skeleton、wiring 後續細修） */}
                        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                          <div className="flex items-center gap-3">
                            <h3 className="text-sm font-semibold text-green-400 flex items-center gap-2 shrink-0">
                              <CheckSquare size={14} />
                              待辦事項
                            </h3>
                            <input
                              type="text"
                              placeholder="新增待辦...（尚未串接）"
                              disabled
                              className="flex-1 min-w-0 bg-slate-900 border border-slate-600 rounded px-3 py-1 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                            />
                            <button
                              disabled
                              className="px-2.5 py-1 bg-green-600 disabled:opacity-50 text-white text-sm rounded shrink-0"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                          <p className="text-xs text-slate-500 mt-3">目前無待辦事項</p>
                        </div>

                        {/* ④ 目前進度（skeleton、wiring 後續細修） */}
                        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                          <h3 className="text-sm font-semibold text-indigo-400 mb-3">目前進度</h3>
                          <div className="flex flex-col gap-2">
                            <textarea
                              rows={4}
                              placeholder="輸入進度（尚未串接）"
                              disabled
                              className="w-full min-h-[96px] max-h-48 resize-none bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
                            />
                            <button
                              disabled
                              className="self-end px-4 py-2 bg-indigo-600 disabled:opacity-50 text-white text-sm rounded"
                            >
                              送出
                            </button>
                          </div>
                        </div>

                      </div>
                    )}

                    {entrustDetailTab === 'records' && (
                      <div className="space-y-4">
                        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                          <h3 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
                            <Clock size={14} />
                            經營記錄卡
                          </h3>
                          <p className="text-xs text-slate-500">尚未串接、後續細修補上資料來源</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            )}
          </div>
        )}

        {/* --- 成交客戶 Tab --- */}
        {activeTab === 'closed' && (
          <div className="px-6 py-5">
            <div className="flex items-center gap-2 flex-wrap mb-4">
              <div className="text-sm text-slate-300 font-medium pr-2">
                成交客戶
                <span className="ml-2 text-xs text-slate-500">{closedProperties.length}</span>
              </div>

              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  value={closedSearchTerm}
                  onChange={(e) => setClosedSearchTerm(e.target.value)}
                  placeholder="搜尋物件 / 屋主 / 地址 / 電話"
                  className="w-full bg-slate-800/60 border border-slate-700 rounded pl-8 pr-3 py-1.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                onClick={fetchClosedProperties}
                disabled={closedLoading}
                className="text-xs text-slate-400 hover:text-white px-2 py-1.5 rounded border border-slate-700 disabled:opacity-50"
              >
                {closedLoading ? '載入中…' : '↻ 重新整理'}
              </button>
            </div>

            {closedError && (
              <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-rose-950/40 border border-rose-900/60 rounded text-rose-300 text-sm">
                <AlertTriangle size={14} />
                {closedError}
              </div>
            )}

            {closedLoading ? (
              <div className="flex items-center justify-center py-16 text-slate-500">
                <Loader2 className="animate-spin" size={20} />
              </div>
            ) : filteredClosed.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                {closedSearchTerm ? '沒有符合搜尋的物件' : '還沒有成交記錄'}
              </div>
            ) : (
              <div>
                {filteredClosed.map((prop) => (
                  <div
                    key={prop.id}
                    className="border border-slate-700 bg-slate-900/60 rounded-lg p-3 mb-2 hover:border-slate-500 transition-colors"
                  >
                    <button
                      onClick={() => openPropertyModal(prop.id)}
                      className="w-full text-left"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-white truncate">{prop.name}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded border ${
                            prop.source === 'buyer'
                              ? 'bg-sky-900/40 text-sky-300 border-sky-800/60'
                              : 'bg-amber-900/30 text-amber-300 border-amber-800/60'
                          }`}
                        >
                          {prop.source === 'buyer' ? '行銷' : '開發'}
                        </span>
                        {prop.price && <span className="text-amber-400 text-sm">{prop.price}</span>}
                        {prop.closingDate && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-300 border border-emerald-800/60">
                            成交 {prop.closingDate}
                          </span>
                        )}
                      </div>
                      {prop.address && (
                        <div className="text-xs text-slate-400 mt-0.5 truncate flex items-center gap-1">
                          <MapPin size={11} /> {prop.address}
                        </div>
                      )}
                      <div className="text-xs text-slate-400 mt-1 flex items-center gap-3 flex-wrap">
                        {prop.owner && <span>屋主：{prop.owner}</span>}
                        {prop.ownerPhone && (
                          <span className="flex items-center gap-1 text-slate-500">
                            <Phone size={11} /> {prop.ownerPhone}
                          </span>
                        )}
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            )}
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
              {/* B6: i智慧 物件自動帶入 */}
              <div className="rounded border border-indigo-800/60 bg-indigo-950/40 px-3 py-2">
                <label className="block text-xs text-indigo-300 mb-1 flex items-center gap-2">
                  <span>i智慧 物件編號 <span className="text-slate-500">(選填，自動帶入社區 / 樓層 / 永慶連結 / 同事)</span></span>
                  {userscriptReady ? (
                    <span className="text-[10px] text-emerald-400">● userscript ok</span>
                  ) : (
                    <span className="text-[10px] text-amber-400">● 等待 userscript…</span>
                  )}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={ismartLookupInput}
                    onChange={(e) => {
                      setIsmartLookupInput(e.target.value)
                      setYcutCaseIdx(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleIsmartLookup()
                      }
                    }}
                    placeholder="例如：1847905（或貼 i智慧 detail URL）"
                    disabled={ismartLookupStatus === 'loading'}
                    className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={handleIsmartLookup}
                    disabled={!ismartLookupInput.trim() || ismartLookupStatus === 'loading'}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm rounded transition-colors whitespace-nowrap"
                  >
                    {ismartLookupStatus === 'loading' ? '查詢中…' : '🔍 帶入'}
                  </button>
                </div>
                {ismartLookupMessage && (
                  <div
                    className={`mt-1.5 text-xs ${
                      ismartLookupStatus === 'ok'
                        ? 'text-emerald-400'
                        : ismartLookupStatus === 'loading'
                        ? 'text-slate-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {ismartLookupMessage}
                    {ismartLookupStatus === 'auth_expired' && (
                      <>
                        {' '}
                        <a
                          href="https://is.ycut.com.tw/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-amber-300"
                        >
                          （點這裡開 i智慧）
                        </a>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* 1. 日期時間 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm text-slate-400">日期時間 <span className="text-slate-500 text-xs">(30 分鐘事件)</span></label>
                  <button
                    type="button"
                    onClick={() => {
                      if (!ycutCaseIdx) return
                      const empNo = process.env.NEXT_PUBLIC_YCUT_EMP_NO || 'C30419'
                      const url = `https://is.ycut.com.tw/case/report/market/redirect?caseIdx=${encodeURIComponent(ycutCaseIdx)}&empNo=${encodeURIComponent(empNo)}&autoPrint=1`
                      window.open(url, '_blank', 'noopener,noreferrer')
                    }}
                    disabled={!ycutCaseIdx}
                    title={ycutCaseIdx ? '在新分頁打開 i智慧 成交行情列印頁' : '請先在上方輸入 i智慧 物件編號並按「🔍 帶入」'}
                    className="flex items-center gap-1 px-2 py-0.5 border border-slate-600 hover:border-sky-500 hover:text-sky-300 disabled:border-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-300 text-xs rounded transition-colors"
                  >
                    <Printer size={12} />
                    列印
                  </button>
                </div>
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

              {/* 6. 樂居連結（B7: 社區名失焦後自動帶，使用者可改/清空） */}
              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  樂居連結 <span className="text-slate-500 text-xs">(選填)</span>
                  {lejuSearching && <span className="ml-2 text-xs text-slate-500">搜尋中…</span>}
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

      {/* 委託 tab：物件詳情 Modal */}
      <PropertyDetailModal
        property={selectedProperty}
        isOpen={propertyModalOpen && !!selectedProperty}
        onClose={closePropertyModal}
        onSave={handlePropertyModalSave}
      />
    </div>
  )
}
