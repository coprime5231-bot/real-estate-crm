import { NextRequest, NextResponse } from 'next/server'
import { pool, currentQuarter } from '@/lib/mba/db'
import { VISIT_SCORE, distanceBonus as calcDistanceBonus } from '@/lib/mba/scoring'
import { handleVisitWriteback } from '@/lib/mba/notion-writeback'
import { updateEventColor } from '@/lib/mba/google-calendar'
import { refreshDailyStats } from '@/lib/mba/daily-stats'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VALID_ACTIONS = ['invalid', 'retry', 'found'] as const
type VisitAction = (typeof VALID_ACTIONS)[number]

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { eventId, action, summary, description, distanceKm } = body as {
      eventId?: string
      action?: string
      summary?: string
      description?: string | null
      distanceKm?: number | null
    }

    if (
      !eventId ||
      !action ||
      !VALID_ACTIONS.includes(action as VisitAction)
    ) {
      return NextResponse.json({ error: 'invalid params' }, { status: 400 })
    }

    const act = action as VisitAction
    const quarter = currentQuarter()

    const dup = await pool.query(
      'SELECT id FROM task_completions WHERE calendar_event_id = $1 AND quarter = $2 LIMIT 1',
      [eventId, quarter],
    )
    if (dup.rows.length > 0) {
      return NextResponse.json({ ok: false, reason: 'already_done' })
    }

    const spec = VISIT_SCORE[act]
    const bonus = calcDistanceBonus(distanceKm)
    const totalScore = spec.baseScore + bonus

    const starsAwarded = 3

    const result = await pool.query(
      `INSERT INTO task_completions
        (source, action, calendar_event_id, base_score, distance_bonus,
         total_score, card_color, distance_km, quarter, stars_awarded)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, total_score, card_color, created_at`,
      [
        'visit',
        act,
        eventId,
        spec.baseScore,
        bonus,
        totalScore,
        spec.cardColor,
        distanceKm ?? null,
        quarter,
        starsAwarded,
      ],
    )

    let notionOk: boolean | null = null
    if (act !== 'found' && summary) {
      const wb = await handleVisitWriteback({
        summary,
        description: description ?? null,
        action: act,
      }).catch((err) => {
        console.error('[visit] notion writeback failed', err)
        return null
      })
      notionOk = wb?.success ?? null
    }

    await updateEventColor(eventId, '8').catch((err) => {
      console.error('[visit] calendar color update failed', err)
    })

    // 更新全清 / 連擊
    const daily = await refreshDailyStats().catch((err) => {
      console.error('[visit] refreshDailyStats failed', err)
      return null
    })

    const row = result.rows[0]
    return NextResponse.json({
      ok: true,
      id: row.id,
      totalScore: row.total_score,
      cardColor: row.card_color,
      notionWriteback: notionOk,
      fullClear: daily?.fullClear ?? false,
      streak: daily?.streak ?? 0,
    })
  } catch (err) {
    console.error('[visit] error', err)
    return NextResponse.json(
      { error: (err as Error).message ?? 'unknown' },
      { status: 500 },
    )
  }
}
