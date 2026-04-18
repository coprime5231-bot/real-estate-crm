import { NextRequest, NextResponse } from 'next/server'
import { pool, currentQuarter } from '@/lib/mba/db'
import { VIEWING_SCORE } from '@/lib/mba/scoring'
import { handleViewingBuyerWriteback } from '@/lib/mba/buyer-writeback'
import { updateEventColor } from '@/lib/mba/google-calendar'
import { refreshDailyStats } from '@/lib/mba/daily-stats'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VALID_ACTIONS = ['no', 'yes'] as const
type ViewingAction = (typeof VALID_ACTIONS)[number]

const ACTION_MAP: Record<ViewingAction, keyof typeof VIEWING_SCORE> = {
  no: 'uninterested',
  yes: 'interested',
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { eventId, action, description, eventStartIso, communityName } = body as {
      eventId?: string
      action?: string
      description?: string | null
      eventStartIso?: string | null
      communityName?: string | null
    }

    if (
      !eventId ||
      !action ||
      !VALID_ACTIONS.includes(action as ViewingAction) ||
      !eventStartIso
    ) {
      return NextResponse.json({ error: 'invalid params' }, { status: 400 })
    }

    const act = action as ViewingAction
    const quarter = currentQuarter()

    const dup = await pool.query(
      'SELECT id FROM task_completions WHERE calendar_event_id = $1 AND quarter = $2 LIMIT 1',
      [eventId, quarter],
    )
    if (dup.rows.length > 0) {
      return NextResponse.json({ ok: false, reason: 'already_done' })
    }

    const spec = VIEWING_SCORE[ACTION_MAP[act]]
    const totalScore = spec.baseScore
    const starsAwarded = 3

    const result = await pool.query(
      `INSERT INTO task_completions
        (source, action, calendar_event_id, base_score, total_score, card_color, quarter, stars_awarded)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, total_score, card_color, created_at`,
      ['viewing', act, eventId, spec.baseScore, totalScore, spec.cardColor, quarter, starsAwarded],
    )

    const wb = await handleViewingBuyerWriteback(description ?? null, {
      interest: act,
      communityName: communityName ?? null,
      eventStartIso,
    }).catch((err) => {
      console.error('[viewing] buyer writeback failed', err)
      return null
    })
    const buyerOk: boolean | null = wb?.success ?? null

    await updateEventColor(eventId, '8').catch((err) => {
      console.error('[viewing] calendar color update failed', err)
    })

    // 更新全清 / 連擊
    const daily = await refreshDailyStats().catch((err) => {
      console.error('[viewing] refreshDailyStats failed', err)
      return null
    })

    const row = result.rows[0]
    return NextResponse.json({
      ok: true,
      id: row.id,
      totalScore: row.total_score,
      cardColor: row.card_color,
      buyerWriteback: buyerOk,
      fullClear: daily?.fullClear ?? false,
      streak: daily?.streak ?? 0,
    })
  } catch (err) {
    console.error('[viewing] error', err)
    return NextResponse.json(
      { error: (err as Error).message ?? 'unknown' },
      { status: 500 },
    )
  }
}
