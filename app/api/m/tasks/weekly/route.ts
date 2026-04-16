import { NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
import { pool, currentQuarter } from '@/lib/mba/db'
import { getWeekStart } from '@/lib/mba/week-calc'
import { refreshDailyStats } from '@/lib/mba/daily-stats'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const notion = new Client({ auth: process.env.NOTION_API_KEY! })

/** Notion 欄位名：一二三四五六日 */
const DAY_TO_NOTION: Record<string, string> = {
  mon: '一',
  tue: '二',
  wed: '三',
  thu: '四',
  fri: '五',
  sat: '六',
  sun: '日',
}

const VALID_DAYS = new Set(Object.keys(DAY_TO_NOTION))

/**
 * POST /api/m/tasks/weekly
 *
 * Body: {
 *   notionPageId: string   — Notion page ID
 *   day: 'mon'|'tue'|...   — 哪一天的 checkbox
 *   checked: boolean        — true=打勾, false=取消勾
 *   taskName: string        — 任務名（PG 記錄用）
 *   frequency: number       — 目標次數
 * }
 *
 * 打勾：① PATCH Notion checkbox ② 寫 PG task_completions (+10, 達標再 +20 + 5⭐)
 * 取消：① PATCH Notion checkbox=false ② 刪 PG 對應紀錄
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { notionPageId, day, checked, taskName, frequency } = body

    if (!notionPageId || !day || !VALID_DAYS.has(day) || typeof checked !== 'boolean') {
      return NextResponse.json({ ok: false, error: 'invalid params' }, { status: 400 })
    }

    const notionProp = DAY_TO_NOTION[day]
    const quarter = currentQuarter()

    // ① PATCH Notion checkbox
    await notion.pages.update({
      page_id: notionPageId,
      properties: {
        [notionProp]: { checkbox: checked },
      },
    })

    // ② PG 操作
    if (checked) {
      // --- 打勾 ---
      // 防重：同 page + 同 day 不重複寫
      const dup = await pool.query(
        `SELECT id FROM task_completions
         WHERE source = 'weekly' AND notion_page_id = $1 AND action = $2 AND quarter = $3`,
        [notionPageId, day, quarter],
      )
      if (dup.rows.length > 0) {
        return NextResponse.json({ ok: true, reason: 'already_checked', score: 0 })
      }

      // 計算本週同任務已完成幾次（用 PG 紀錄）
      const weekStart = getWeekStart()
      const countRes = await pool.query(
        `SELECT COUNT(*)::int AS cnt
         FROM task_completions
         WHERE source = 'weekly'
           AND notion_page_id = $1
           AND quarter = $2
           AND created_at >= $3`,
        [notionPageId, quarter, weekStart.toISOString()],
      )
      const existingCount: number = countRes.rows[0].cnt

      // 達標判定：這次打勾後剛好 == frequency → bonus +20 + 5⭐
      const freq = frequency || 0
      const isReachingTarget = freq > 0 && existingCount === freq - 1
      const baseScore = 10
      const bonusScore = isReachingTarget ? 20 : 0
      const totalScore = baseScore + bonusScore
      const starsAwarded = isReachingTarget ? 5 : 0

      await pool.query(
        `INSERT INTO task_completions
          (source, action, notion_page_id, weekly_task_name, weekly_task_target,
           base_score, total_score, card_color, quarter, stars_awarded)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          'weekly', day, notionPageId, taskName, freq,
          baseScore, totalScore, 'green', quarter, starsAwarded,
        ],
      )

      // 更新全清 / 連擊
      const daily = await refreshDailyStats().catch((err) => {
        console.error('[weekly] refreshDailyStats failed', err)
        return null
      })

      return NextResponse.json({
        ok: true,
        checked: true,
        score: totalScore,
        bonus: bonusScore > 0,
        stars: starsAwarded,
        fullClear: daily?.fullClear ?? false,
        streak: daily?.streak ?? 0,
      })
    } else {
      // --- 取消勾 ---
      const del = await pool.query(
        `DELETE FROM task_completions
         WHERE source = 'weekly' AND notion_page_id = $1 AND action = $2 AND quarter = $3
         RETURNING total_score, stars_awarded`,
        [notionPageId, day, quarter],
      )
      const removed = del.rows[0]

      // 取消勾後重算全清（可能從全清變成非全清）
      await refreshDailyStats().catch((err) => {
        console.error('[weekly] refreshDailyStats failed', err)
      })

      return NextResponse.json({
        ok: true,
        checked: false,
        removedScore: removed?.total_score ?? 0,
        removedStars: removed?.stars_awarded ?? 0,
      })
    }
  } catch (err) {
    console.error('[tasks/weekly] error', err)
    return NextResponse.json(
      { error: (err as Error).message ?? 'unknown' },
      { status: 500 },
    )
  }
}
