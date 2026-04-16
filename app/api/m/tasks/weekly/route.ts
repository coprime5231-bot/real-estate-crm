import { NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
import { pool, currentQuarter } from '@/lib/mba/db'
import { getWeekStart, getWeekInfo } from '@/lib/mba/week-calc'
import { refreshDailyStats } from '@/lib/mba/daily-stats'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const notion = new Client({ auth: process.env.NOTION_API_KEY! })

const WEEKLY_DB_ID = process.env.NOTION_WEEKLY_TASKS_DB_ID
  || 'e7a56ff9a8598267801e811313635414'
const WEEKLY_REVIEW_DB_ID = process.env.NOTION_WEEKLY_REVIEW_DB_ID
  || '75256ff9a859825c827081967a324e3a'

/** Map today's JS day (0=Sun) to Notion checkbox name */
function todayNotionCheckbox(): string {
  const dayMap: Record<number, string> = {
    0: '日', 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六',
  }
  const now = new Date()
  // Taipei = UTC+8
  const taipeiHour = (now.getUTCHours() + 8) % 24
  const taipeiDay = taipeiHour < (now.getUTCHours() + 8 >= 24 ? 0 : 0)
    ? now.getUTCDay()
    : now.getUTCDay()
  // Simpler: just use Date in Taipei offset
  const taipeiMs = now.getTime() + 8 * 3600_000
  const taipeiDate = new Date(taipeiMs)
  return dayMap[taipeiDate.getUTCDay()] ?? '一'
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
    default:
      return ''
  }
}

const FREQ_MAP: Record<string, number> = {
  Daily: 7, '1 Time': 1, '2 Times': 2, '3 Times': 3,
  '4 Times': 4, '5 Times': 5, '6 Times': 6,
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
      property: '週別',
      title: { equals: label },
    },
    page_size: 1,
  })
  const hit = res.results[0] as any
  return hit?.id ?? null
}

const goalCache = new Map<string, string>()

async function resolveGoals(relationIds: string[]): Promise<string> {
  const names: string[] = []
  for (const id of relationIds) {
    if (!goalCache.has(id)) {
      try {
        const page = await notion.pages.retrieve({ page_id: id }) as any
        for (const v of Object.values(page.properties) as any[]) {
          if (v?.type === 'title') {
            goalCache.set(id, v.title.map((t: any) => t.plain_text).join(''))
            break
          }
        }
        if (!goalCache.has(id)) goalCache.set(id, '')
      } catch {
        goalCache.set(id, '')
      }
    }
    const name = goalCache.get(id)
    if (name) names.push(name)
  }
  return names.join(', ')
}

/**
 * GET /api/m/tasks/weekly
 *
 * Fetch Notion weekly tasks + PG completion counts for this week.
 */
export async function GET() {
  try {
    const { week, quarter } = getWeekInfo()
    const weekLabel = `Week ${String(week).padStart(2, '0')}`
    const weekStart = getWeekStart()

    const weekPageId = await findWeekPageId(weekLabel)
    if (!weekPageId) {
      return NextResponse.json({ ok: true, tasks: [], note: `找不到 "${weekLabel}"` })
    }

    const res = await notion.databases.query({
      database_id: WEEKLY_DB_ID,
      filter: { property: 'weekly', relation: { contains: weekPageId } },
      page_size: 100,
    })

    // Collect all notion page IDs to batch-query PG counts
    const notionTasks: Array<{
      id: string; task: string; goal: string; frequency: number
    }> = []

    for (const p of res.results) {
      if ((p as any).object !== 'page') continue
      const props = (p as any).properties
      const task = readPropString(props['策略任務']).trim()
      const frequency = readFrequency(props['週頻率'])
      const goal = await resolveGoals(getRelationIds(props['目標']))
      if (!task || frequency <= 0) continue
      notionTasks.push({ id: (p as any).id, task, goal, frequency })
    }

    // Batch PG counts for this week
    const pgCounts = new Map<string, number>()
    const pgBonus = new Map<string, boolean>()
    if (notionTasks.length > 0) {
      const ids = notionTasks.map((t) => t.id)
      const countRes = await pool.query(
        `SELECT notion_page_id,
                COUNT(*)::int AS cnt,
                MAX(CASE WHEN total_score > base_score THEN 1 ELSE 0 END)::int AS has_bonus
         FROM task_completions
         WHERE source = 'weekly'
           AND notion_page_id = ANY($1)
           AND created_at >= $2
         GROUP BY notion_page_id`,
        [ids, weekStart.toISOString()],
      )
      for (const row of countRes.rows) {
        pgCounts.set(row.notion_page_id, row.cnt)
        pgBonus.set(row.notion_page_id, row.has_bonus === 1)
      }
    }

    const tasks = notionTasks.map((t) => ({
      id: t.id,
      task: t.task,
      goal: t.goal,
      frequency: t.frequency,
      count: pgCounts.get(t.id) ?? 0,
      bonusClaimed: pgBonus.get(t.id) ?? false,
    }))

    return NextResponse.json({ ok: true, quarter, week: weekLabel, tasks })
  } catch (err) {
    console.error('[tasks/weekly GET] error', err)
    return NextResponse.json(
      { error: (err as Error).message ?? 'unknown' },
      { status: 500 },
    )
  }
}

/**
 * POST /api/m/tasks/weekly
 *
 * Body: { notionPageId, taskName, frequency }
 *
 * "完成 +1" = INSERT PG one row + PATCH today's Notion checkbox = true
 * 達標 (PG count >= frequency): +20 bonus + 5 stars (one-time)
 * 超做: +10 per completion (no extra bonus)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { notionPageId, taskName, frequency } = body

    if (!notionPageId || !taskName) {
      return NextResponse.json({ ok: false, error: 'invalid params' }, { status: 400 })
    }

    const quarter = currentQuarter()
    const weekStart = getWeekStart()
    const freq = frequency || 0

    // Count existing completions this week
    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS cnt
       FROM task_completions
       WHERE source = 'weekly'
         AND notion_page_id = $1
         AND created_at >= $2`,
      [notionPageId, weekStart.toISOString()],
    )
    const existingCount: number = countRes.rows[0].cnt

    // Check if bonus was already claimed this week
    const bonusRes = await pool.query(
      `SELECT 1 FROM task_completions
       WHERE source = 'weekly'
         AND notion_page_id = $1
         AND created_at >= $2
         AND total_score > base_score
       LIMIT 1`,
      [notionPageId, weekStart.toISOString()],
    )
    const bonusAlreadyClaimed = bonusRes.rows.length > 0

    // Reaching target: this completion makes count == frequency, and bonus not yet claimed
    const isReachingTarget = freq > 0 && existingCount === freq - 1 && !bonusAlreadyClaimed
    const baseScore = 10
    const bonusScore = isReachingTarget ? 20 : 0
    const totalScore = baseScore + bonusScore
    const starsAwarded = isReachingTarget ? 5 : 0

    // INSERT PG completion
    await pool.query(
      `INSERT INTO task_completions
        (source, action, notion_page_id, weekly_task_name, weekly_task_target,
         base_score, total_score, card_color, quarter, stars_awarded)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        'weekly', 'complete', notionPageId, taskName, freq,
        baseScore, totalScore, 'green', quarter, starsAwarded,
      ],
    )

    // PATCH today's Notion checkbox = true
    const todayProp = todayNotionCheckbox()
    notion.pages.update({
      page_id: notionPageId,
      properties: { [todayProp]: { checkbox: true } },
    }).catch((err) => {
      console.error('[weekly] Notion checkbox patch failed', err)
    })

    // Refresh daily stats
    await refreshDailyStats().catch((err) => {
      console.error('[weekly] refreshDailyStats failed', err)
    })

    return NextResponse.json({
      ok: true,
      score: totalScore,
      bonus: bonusScore > 0,
      stars: starsAwarded,
      newCount: existingCount + 1,
    })
  } catch (err) {
    console.error('[tasks/weekly POST] error', err)
    return NextResponse.json(
      { error: (err as Error).message ?? 'unknown' },
      { status: 500 },
    )
  }
}
