import { NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
import { getWeekInfo } from '@/lib/mba/week-calc'

/**
 * GET /api/notion/weekly-tasks
 *
 * 讀「策略」任務 DB，依當前 Week（Week 01/02/…）篩選，回傳本週任務清單。
 *
 * DB 欄位：
 *   - 策略任務 : Title
 *   - 目標     : Relation → 目標 DB（解析為頁面標題）
 *   - 週頻率   : Select（Daily / 1 Time / 2 Times / …）
 *   - weekly   : Relation → Weekly Review DB（篩選條件）
 */

const NOTION_TOKEN = process.env.NOTION_API_KEY!
const WEEKLY_DB_ID = process.env.NOTION_WEEKLY_TASKS_DB_ID
  || 'e7a56ff9a8598267801e811313635414'
const WEEKLY_REVIEW_DB_ID = process.env.NOTION_WEEKLY_REVIEW_DB_ID
  || '75256ff9a859825c827081967a324e3a'

const PROPS = {
  TITLE: '策略任務',
  GOAL: '目標',
  FREQUENCY: '週頻率',
  WEEKLY: 'weekly',
} as const

const WEEKLY_REVIEW_TITLE_PROP = '週別'

export interface DayChecks {
  mon: boolean
  tue: boolean
  wed: boolean
  thu: boolean
  fri: boolean
  sat: boolean
  sun: boolean
}

export interface WeeklyTask {
  id: string
  task: string
  goal: string
  frequency: number
  checks: DayChecks
}

const DAY_PROPS: Record<keyof DayChecks, string> = {
  mon: '一',
  tue: '二',
  wed: '三',
  thu: '四',
  fri: '五',
  sat: '六',
  sun: '日',
}

function readChecks(props: any): DayChecks {
  const out = {} as DayChecks
  for (const [key, name] of Object.entries(DAY_PROPS) as [keyof DayChecks, string][]) {
    const p = props[name]
    out[key] = p?.type === 'checkbox' ? !!p.checkbox : false
  }
  return out
}

const notion = new Client({ auth: NOTION_TOKEN })

function readTitle(props: any): string {
  for (const v of Object.values(props) as any[]) {
    if (v?.type === 'title') return v.title.map((t: any) => t.plain_text).join('')
  }
  return ''
}

function readPropString(prop: any): string {
  if (!prop) return ''
  switch (prop.type) {
    case 'title':
      return prop.title.map((t: any) => t.plain_text).join('')
    case 'rich_text':
      return prop.rich_text.map((t: any) => t.plain_text).join('')
    case 'select':
      return prop.select?.name ?? ''
    case 'multi_select':
      return prop.multi_select.map((s: any) => s.name).join(', ')
    default:
      return ''
  }
}

const FREQ_MAP: Record<string, number> = {
  Daily: 7,
  '1 Time': 1,
  '2 Times': 2,
  '3 Times': 3,
  '4 Times': 4,
  '5 Times': 5,
  '6 Times': 6,
}

function readFrequency(prop: any): number {
  if (!prop) return 0
  if (prop.type === 'number') return prop.number ?? 0
  const s = readPropString(prop).trim()
  if (s in FREQ_MAP) return FREQ_MAP[s]
  const m = s.match(/\d+/)
  return m ? parseInt(m[0], 10) : 0
}

function getRelationIds(prop: any): string[] {
  if (!prop || prop.type !== 'relation') return []
  return prop.relation.map((r: any) => r.id)
}

async function findWeekPageId(label: string): Promise<string | null> {
  const res = await notion.databases.query({
    database_id: WEEKLY_REVIEW_DB_ID,
    filter: {
      property: WEEKLY_REVIEW_TITLE_PROP,
      title: { equals: label },
    },
    page_size: 1,
  })
  const hit = res.results[0] as any
  return hit?.id ?? null
}

async function resolveGoals(relationIds: string[], cache: Map<string, string>): Promise<string> {
  const names: string[] = []
  for (const id of relationIds) {
    if (!cache.has(id)) {
      try {
        const page = await notion.pages.retrieve({ page_id: id }) as any
        cache.set(id, readTitle(page.properties))
      } catch {
        cache.set(id, '')
      }
    }
    const name = cache.get(id)
    if (name) names.push(name)
  }
  return names.join(', ')
}

export async function GET() {
  try {
    const { week, quarter } = getWeekInfo()
    const weekLabel = `Week ${String(week).padStart(2, '0')}`

    const weekPageId = await findWeekPageId(weekLabel)
    if (!weekPageId) {
      return NextResponse.json({
        ok: true,
        count: 0,
        quarter,
        week: weekLabel,
        tasks: [],
        note: `Weekly Review DB 找不到 "${weekLabel}" 頁面`,
      })
    }

    const res = await notion.databases.query({
      database_id: WEEKLY_DB_ID,
      filter: {
        property: PROPS.WEEKLY,
        relation: { contains: weekPageId },
      },
      page_size: 100,
    })

    const goalCache = new Map<string, string>()
    const tasks: WeeklyTask[] = []

    for (const p of res.results) {
      if ((p as any).object !== 'page') continue
      const props = (p as any).properties
      const task = readPropString(props[PROPS.TITLE]).trim()
      const frequency = readFrequency(props[PROPS.FREQUENCY])
      const goal = await resolveGoals(getRelationIds(props[PROPS.GOAL]), goalCache)
      if (!task || frequency <= 0) continue
      tasks.push({ id: (p as any).id, task, goal, frequency, checks: readChecks(props) })
    }

    return NextResponse.json({
      ok: true,
      count: tasks.length,
      quarter,
      week: weekLabel,
      tasks,
    })
  } catch (err: any) {
    console.error('[weekly-tasks] error:', err)
    return NextResponse.json(
      { ok: false, error: err.message || String(err) },
      { status: 500 },
    )
  }
}
