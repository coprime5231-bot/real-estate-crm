import { NextResponse } from 'next/server'
import { pool, currentQuarter } from '@/lib/mba/db'
import { levelFromTotal } from '@/lib/mba/scoring'
import { getStarBalance } from '@/lib/mba/chest'
import { getWeekInfo } from '@/lib/mba/week-calc'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 稱號對照表（橘卡跨季累計 → 稱號）
 */
const TITLES: [number, string][] = [
  [10, '泰坦喵喵'],
  [9, '星界喵喵'],
  [8, '無面喵喵'],
  [7, '屠龍喵喵'],
  [6, '聖光喵喵'],
  [5, '黑曜喵喵'],
  [4, '血色喵喵'],
  [3, '白銀喵喵'],
  [2, '角鬥喵喵'],
  [1, '炸雞喵喵'],
  [0, '見習喵喵'],
]

function titleFromOrangeCards(count: number): string {
  for (const [threshold, name] of TITLES) {
    if (count >= threshold) return name
  }
  return '見習喵喵'
}

/**
 * GET /api/m/stats/player
 *
 * 回傳：
 * - totalScore: 當季總分（task_completions + chest_opens）
 * - level / nextLevelScore / prevLevelScore: 等級 + 經驗條
 * - title: 稱號（橘卡跨季累計）
 * - orangeCardsTotal: 橘卡跨季累計張數
 * - blueCards / purpleCards / orangeCards: 本季稀有卡片
 * - streak: 連續全清天數
 * - stars / chestsAvailable: 星星
 * - week / daysToQuarterEnd / quarter
 */
export async function GET() {
  try {
    const quarter = currentQuarter()
    const weekInfo = getWeekInfo(new Date())

    // 平行查 6 個 query
    const [
      taskScoreRes,
      chestScoreRes,
      rareCardsRes,
      orangeTotalRes,
      streakRes,
      starBalance,
    ] = await Promise.all([
      // 當季 task_completions 總分
      pool.query(
        'SELECT COALESCE(SUM(total_score), 0)::int AS total FROM task_completions WHERE quarter = $1',
        [quarter],
      ),
      // 當季寶箱總收益
      pool.query(
        'SELECT COALESCE(SUM(reward_score), 0)::int AS total FROM chest_opens WHERE quarter = $1',
        [quarter],
      ),
      // 本季稀有卡片（藍/紫/橘）
      pool.query(
        `SELECT card_color, COUNT(*)::int AS cnt
         FROM task_completions
         WHERE quarter = $1 AND card_color IN ('blue', 'purple', 'orange')
         GROUP BY card_color`,
        [quarter],
      ),
      // 橘卡跨季累計（稱號用）
      pool.query(
        `SELECT COUNT(*)::int AS total
         FROM task_completions
         WHERE card_color = 'orange'`,
      ),
      // 連擊：從 daily_stats 取最近連續全清天數
      pool.query(
        `SELECT streak_count FROM daily_stats
         WHERE user_id = 'coprime'
         ORDER BY date DESC LIMIT 1`,
      ),
      // 星星
      getStarBalance(quarter),
    ])

    const taskScore: number = taskScoreRes.rows[0].total
    const chestScore: number = chestScoreRes.rows[0].total
    const totalScore = taskScore + chestScore

    const { level, next, prev } = levelFromTotal(totalScore)

    // 稀有卡片
    const cardMap: Record<string, number> = { blue: 0, purple: 0, orange: 0 }
    for (const row of rareCardsRes.rows) {
      cardMap[row.card_color] = row.cnt
    }

    const orangeCardsTotal: number = orangeTotalRes.rows[0].total
    const title = titleFromOrangeCards(orangeCardsTotal)

    const streak: number = streakRes.rows[0]?.streak_count ?? 0

    return NextResponse.json({
      totalScore,
      level,
      nextLevelScore: next,
      prevLevelScore: prev,
      title,
      orangeCardsTotal,
      blueCards: cardMap.blue,
      purpleCards: cardMap.purple,
      orangeCards: cardMap.orange,
      streak,
      stars: starBalance.stars,
      chestsAvailable: starBalance.chestsAvailable,
      week: weekInfo.week,
      daysToQuarterEnd: weekInfo.daysToQuarterEnd,
      quarter: weekInfo.quarter,
    })
  } catch (err) {
    console.error('[stats/player] error', err)
    return NextResponse.json(
      { error: (err as Error).message ?? 'unknown' },
      { status: 500 },
    )
  }
}
