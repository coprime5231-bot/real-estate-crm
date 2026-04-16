import { NextRequest, NextResponse } from 'next/server'
import { pool, currentQuarter } from '@/lib/mba/db'
import { SPECIAL_TASK_MAP, SpecialAction } from '@/lib/mba/scoring'
import { refreshDailyStats } from '@/lib/mba/daily-stats'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/m/tasks/special
 * body: { action: 'revisit' | 'entrust' | 'deposit' | 'close' }
 *
 * 寫入 task_completions，不動 Notion、不套距離倍率。
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const action = body?.action as SpecialAction | undefined

    if (!action || !(action in SPECIAL_TASK_MAP)) {
      return NextResponse.json({ error: 'invalid action' }, { status: 400 })
    }

    const spec = SPECIAL_TASK_MAP[action]
    const quarter = currentQuarter()

    const result = await pool.query(
      `insert into task_completions
        (source, action, base_score, total_score, card_color, quarter, stars_awarded)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning id, total_score, card_color, created_at`,
      ['custom_special', action, spec.baseScore, spec.baseScore, spec.cardColor, quarter, spec.stars]
    )

    // 更新全清 / 連擊
    await refreshDailyStats().catch((err) => {
      console.error('[special] refreshDailyStats failed', err)
    })

    const row = result.rows[0]
    return NextResponse.json({
      ok: true,
      id: row.id,
      score: row.total_score,
      cardColor: row.card_color,
      label: spec.label,
    })
  } catch (err) {
    console.error('[special] error', err)
    return NextResponse.json(
      { error: (err as Error).message ?? 'unknown' },
      { status: 500 }
    )
  }
}
