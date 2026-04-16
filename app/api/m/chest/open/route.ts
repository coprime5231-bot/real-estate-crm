import { NextResponse } from 'next/server'
import { pool, currentQuarter } from '@/lib/mba/db'
import { openChest } from '@/lib/mba/chest'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const quarter = currentQuarter()
    const result = await openChest(quarter)

    if (!result.ok) {
      return NextResponse.json(result)
    }

    // 寶箱分數寫入 task_completions
    await pool.query(
      `INSERT INTO task_completions
        (source, action, base_score, total_score, card_color, quarter, stars_awarded)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ['chest', result.rarity, result.reward, result.reward, 'gray', quarter, 0],
    )

    return NextResponse.json({
      ok: true,
      reward_score: result.reward,
      rarity: result.rarity,
      remaining_stars: result.stars,
      chests_available: result.chestsAvailable,
    })
  } catch (err) {
    console.error('[chest/open] error', err)
    return NextResponse.json(
      { error: (err as Error).message ?? 'unknown' },
      { status: 500 },
    )
  }
}
