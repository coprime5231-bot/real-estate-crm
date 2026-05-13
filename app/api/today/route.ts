import { NextResponse } from 'next/server'
import notion, {
  extractText,
  extractSelectValue,
  queryDatabaseAll,
} from '@/lib/notion'
import { pool } from '@/lib/mba/db'

export const dynamic = 'force-dynamic'

// ============================================================================
// Types
// ============================================================================

export interface ViewingToday {
  id: number
  notion_buyer_id: string | null
  datetime: string // ISO
  location: string
  community_name: string | null
  colleague_name: string
  colleague_phone: string
  opinion: 'liked' | 'disliked' | null
}

export interface BuyerFollowUp {
  id: string
  name: string
  grade?: string
  phone?: string
  area?: string
  budget?: string
  progress?: string
  nextFollowUp: string // ISO date
  daysOverdue: number // 正數 = 已過期、0 = 今天該回、負數 = N 天後
}

export interface DevExpiring {
  id: string
  name: string
  owner?: string
  ownerPhone?: string
  address?: string
  expiry: string
  daysUntilExpiry: number // 正數=還有幾天、負數=已過期
  important?: string
}

export interface DevLetterPending {
  id: string
  name: string
  owner?: string
  address?: string
}

export interface TodayDashboard {
  date: string
  viewingsToday: ViewingToday[]
  followUpsDue: BuyerFollowUp[]
  followUpsOverdue: BuyerFollowUp[]
  entrustExpiring: DevExpiring[]
  entrustExpired: DevExpiring[]
  devLettersPending: { count: number; preview: DevLetterPending[] }
}

// ============================================================================
// Helpers
// ============================================================================

function todayTaipeiISO(): string {
  // Asia/Taipei (UTC+8) 的今天 yyyy-mm-dd
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const y = parts.find((p) => p.type === 'year')!.value
  const m = parts.find((p) => p.type === 'month')!.value
  const d = parts.find((p) => p.type === 'day')!.value
  return `${y}-${m}-${d}`
}

function daysDiff(dateStr: string, todayStr: string): number {
  const a = new Date(dateStr + 'T00:00:00+08:00').getTime()
  const b = new Date(todayStr + 'T00:00:00+08:00').getTime()
  return Math.round((b - a) / (1000 * 60 * 60 * 24))
}

// ============================================================================
// Sub-fetchers
// ============================================================================

async function fetchViewingsToday(today: string): Promise<ViewingToday[]> {
  // PG viewings: datetime 是 ISO with tz、抓 Asia/Taipei today
  const res = await pool.query(
    `SELECT id, notion_buyer_id, datetime, location, community_name,
            colleague_name, colleague_phone, opinion
       FROM viewings
      WHERE (datetime AT TIME ZONE 'Asia/Taipei')::date = $1::date
      ORDER BY datetime ASC`,
    [today]
  )
  return res.rows.map((r: any) => ({
    id: r.id,
    notion_buyer_id: r.notion_buyer_id,
    datetime: r.datetime instanceof Date ? r.datetime.toISOString() : String(r.datetime),
    location: r.location,
    community_name: r.community_name,
    colleague_name: r.colleague_name,
    colleague_phone: r.colleague_phone,
    opinion: r.opinion,
  }))
}

async function fetchBuyerFollowUps(today: string): Promise<{
  due: BuyerFollowUp[]
  overdue: BuyerFollowUp[]
}> {
  const dbId = process.env.NOTION_BUYER_DB_ID
  if (!dbId) return { due: [], overdue: [] }

  // 抓「日期 ≤ today」的全部、之後 in-memory 拆 due/overdue
  // 同時 filter 排除已成交 (成交日期 IS NOT EMPTY)
  const pages = await queryDatabaseAll(dbId, {
    and: [
      { property: '日期', date: { on_or_before: today } },
      { or: [
        { property: '成交日期', date: { is_empty: true } },
        // 萬一沒「成交日期」prop（舊 row）會被 is_empty 接住
      ] },
    ],
  })

  const due: BuyerFollowUp[] = []
  const overdue: BuyerFollowUp[] = []
  for (const p of pages as any[]) {
    const props = p.properties || {}
    const followUp = props['日期']?.date?.start as string | undefined
    if (!followUp) continue
    const item: BuyerFollowUp = {
      id: p.id,
      name: props['名稱']?.title?.[0]?.plain_text || '(未命名)',
      grade: extractSelectValue(props['客戶等級']?.select) || undefined,
      phone: props['手機']?.phone_number || undefined,
      area: (props['區域']?.multi_select || []).map((o: any) => o.name).join('、') || undefined,
      budget: extractSelectValue(props['預算']?.select) || undefined,
      progress: extractText(props['最近進展']?.rich_text || []) || undefined,
      nextFollowUp: followUp,
      daysOverdue: daysDiff(followUp, today),
    }
    if (item.daysOverdue === 0) due.push(item)
    else if (item.daysOverdue > 0) overdue.push(item)
  }
  // Sort overdue by daysOverdue DESC (最舊的最上面、最痛)
  overdue.sort((a, b) => b.daysOverdue - a.daysOverdue)
  // 同 due 內：A 級在前
  const gradeRank = (g?: string) => g === 'A級' ? 0 : g === 'B級' ? 1 : g === 'C級' ? 2 : 3
  due.sort((a, b) => gradeRank(a.grade) - gradeRank(b.grade))
  return { due, overdue }
}

async function fetchDevEntrust(today: string): Promise<{
  expiring: DevExpiring[]
  expired: DevExpiring[]
}> {
  const dbId = process.env.NOTION_DEV_DB_ID
  if (!dbId) return { expiring: [], expired: [] }

  // 委託 stage + 委託到期日有值 + 成交日期空
  const pages = await queryDatabaseAll(dbId, {
    and: [
      { property: '狀態', select: { equals: '委託' } },
      { property: '委託到期日', date: { is_not_empty: true } },
      { property: '成交日期', date: { is_empty: true } },
    ],
  })

  const expiring: DevExpiring[] = []
  const expired: DevExpiring[] = []
  for (const p of pages as any[]) {
    const props = p.properties || {}
    const expiry = props['委託到期日']?.date?.start as string | undefined
    if (!expiry) continue
    const days = daysDiff(today, expiry) // 正 = 還有 N 天到期、負 = 已過期 N 天
    const item: DevExpiring = {
      id: p.id,
      name: props['名稱']?.title?.[0]?.plain_text || '(未命名)',
      owner: extractText(props['屋主']?.rich_text || []) || undefined,
      ownerPhone: props['手機']?.phone_number || undefined,
      address: extractText(props['物件地址']?.rich_text || []) || undefined,
      expiry,
      daysUntilExpiry: days,
      important: extractText(props['重要事項']?.rich_text || []) || undefined,
    }
    if (days < 0) expired.push(item)
    else if (days <= 7) expiring.push(item)
  }
  expiring.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)
  expired.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry) // 過期越久越前
  return { expiring, expired }
}

async function fetchDevLettersPending(): Promise<{ count: number; preview: DevLetterPending[] }> {
  const dbId = process.env.NOTION_DEV_DB_ID
  if (!dbId) return { count: 0, preview: [] }
  const pages = await queryDatabaseAll(dbId, {
    and: [
      { property: '狀態', select: { equals: '募集' } },
      { property: '開發信', checkbox: { equals: false } },
    ],
  })
  const all: DevLetterPending[] = (pages as any[]).map((p) => {
    const props = p.properties || {}
    return {
      id: p.id,
      name: props['名稱']?.title?.[0]?.plain_text || '(未命名)',
      owner: extractText(props['屋主']?.rich_text || []) || undefined,
      address: extractText(props['物件地址']?.rich_text || []) || undefined,
    }
  })
  return { count: all.length, preview: all.slice(0, 5) }
}

// ============================================================================
// GET /api/today
// ============================================================================

export async function GET() {
  try {
    const today = todayTaipeiISO()
    const [viewingsToday, follow, dev, letters] = await Promise.all([
      fetchViewingsToday(today),
      fetchBuyerFollowUps(today),
      fetchDevEntrust(today),
      fetchDevLettersPending(),
    ])
    const payload: TodayDashboard = {
      date: today,
      viewingsToday,
      followUpsDue: follow.due,
      followUpsOverdue: follow.overdue,
      entrustExpiring: dev.expiring,
      entrustExpired: dev.expired,
      devLettersPending: letters,
    }
    return NextResponse.json(payload)
  } catch (err: any) {
    console.error('GET /api/today failed:', err?.message || err)
    return NextResponse.json({ error: '無法載入今日資料', detail: err?.message }, { status: 500 })
  }
}
