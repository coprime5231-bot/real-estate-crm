/**
 * MBA daily_stats 更新邏輯
 *
 * 全清判定（2026-04-16 定）：
 *   全清 = 當天所有日任務（Calendar 拜訪/帶看）全完成
 *         + 週任務「今天是星期幾」那欄有對應 PG 紀錄的任務都有打勾
 *
 * 連擊：連續幾天達成全清（從今天往回數）
 *
 * 呼叫時機：每次按鈕 API 成功寫入 task_completions 後，呼叫 refreshDailyStats()
 */

import { pool, currentQuarter } from './db'

const TZ_OFFSET = 8 * 3600_000 // Asia/Taipei

/** 取今天的 Asia/Taipei 日期字串 (yyyy-mm-dd) */
function todayDateStr(): string {
  const now = new Date(Date.now() + TZ_OFFSET)
  return now.toISOString().slice(0, 10)
}

/** 取今天星期幾 (0=Sun, 1=Mon ... 6=Sat) */
function todayDow(): number {
  const now = new Date(Date.now() + TZ_OFFSET)
  return now.getUTCDay()
}

/** dow → PG action 欄位值（weekly route 用的 'mon'~'sun'） */
function dowToAction(dow: number): string {
  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][dow]
}

/**
 * 檢查今天是否全清 — 日任務 + 週任務
 *
 * 日任務全清：今天 Calendar 上的 task 全部在 PG task_completions 有紀錄
 *   → 用 calendar_event_id 不為 null 且 source in ('visit','viewing') 的當天紀錄數
 *   → 對比 Calendar API 回傳的今日事件數
 *   → 但 API route 裡不好再打 Calendar（避免迴圈），所以改用：
 *      如果當天有任何 visit/viewing 紀錄，且沒有未完成的事件 → 全清
 *      簡化做法：caller 傳入 totalDayTasks（今天 Calendar 事件總數）
 *
 * 週任務全清：今天星期 X，PG 裡 source='weekly' action=X 且 created_at 在今天的紀錄數
 *   → 對比 Notion 讀回的該天該有多少任務
 *   → 簡化做法：caller 傳入 totalWeeklyTasksToday
 */
export async function refreshDailyStats(ctx?: {
  totalDayTasks?: number
  totalWeeklyTasksToday?: number
}): Promise<{
  fullClear: boolean
  streak: number
  dailyTotalScore: number
  fullClearBonus: number
  streakBonus: number
}> {
  const dateStr = todayDateStr()
  const quarter = currentQuarter()
  const dayAction = dowToAction(todayDow())

  // 今天的日任務完成數 (visit + viewing)
  const dayDoneRes = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM task_completions
     WHERE source IN ('visit', 'viewing')
       AND quarter = $1
       AND created_at::date = $2::date`,
    [quarter, dateStr],
  )
  const dayDone: number = dayDoneRes.rows[0].cnt

  // 今天的週任務完成數（action = 今天星期幾）
  const weeklyDoneRes = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM task_completions
     WHERE source = 'weekly'
       AND action = $1
       AND quarter = $2
       AND created_at::date = $3::date`,
    [dayAction, quarter, dateStr],
  )
  const weeklyDone: number = weeklyDoneRes.rows[0].cnt

  // 判定全清
  // 如果 caller 有傳 total → 精確比對；沒傳 → 只看「今天有沒有做過至少 1 個日任務」
  const totalDay = ctx?.totalDayTasks
  const totalWeekly = ctx?.totalWeeklyTasksToday

  // 日任務：如果沒傳 total（不知道今天有幾個），預設只要有 1 個完成就算 OK（寬鬆）
  //         如果傳了 total=0 表示今天沒日任務，日任務部分直接 pass
  const dayCleared =
    totalDay !== undefined
      ? totalDay === 0 || dayDone >= totalDay
      : dayDone > 0

  // 週任務：如果沒傳 total，預設只要有 1 個完成就算 OK（寬鬆）
  //         如果傳了 total=0 表示今天沒週任務，直接 pass
  const weeklyCleared =
    totalWeekly !== undefined
      ? totalWeekly === 0 || weeklyDone >= totalWeekly
      : weeklyDone > 0

  const fullClear = dayCleared && weeklyCleared

  // 今日總分
  const todayScoreRes = await pool.query(
    `SELECT COALESCE(SUM(total_score), 0)::int AS total FROM task_completions
     WHERE quarter = $1 AND created_at::date = $2::date`,
    [quarter, dateStr],
  )
  const dailyTotalScore: number = todayScoreRes.rows[0].total

  // 計算連擊（從昨天的 daily_stats 往回看）
  let streak = 0
  if (fullClear) {
    const prevStreakRes = await pool.query(
      `SELECT streak_count FROM daily_stats
       WHERE user_id = 'coprime' AND date = ($1::date - interval '1 day')::date`,
      [dateStr],
    )
    const prevStreak: number = prevStreakRes.rows[0]?.streak_count ?? 0
    streak = prevStreak + 1
  }

  // 全清 bonus（+20）和連擊 bonus（+10/day，第 1 天不算）
  const fullClearBonus = fullClear ? 20 : 0
  const streakBonus = fullClear && streak > 1 ? 10 : 0

  // UPSERT daily_stats
  await pool.query(
    `INSERT INTO daily_stats (user_id, date, full_clear, streak_count, total_score)
     VALUES ('coprime', $1, $2, $3, $4)
     ON CONFLICT (date) DO UPDATE SET
       full_clear = EXCLUDED.full_clear,
       streak_count = EXCLUDED.streak_count,
       total_score = EXCLUDED.total_score`,
    [dateStr, fullClear, streak, dailyTotalScore + fullClearBonus + streakBonus],
  )

  // 如果全清 bonus/streak bonus 需要寫 task_completions 讓總分計入
  // → 用 source='daily_bonus' 標記，防重（一天只一筆）
  if (fullClear) {
    const bonusDup = await pool.query(
      `SELECT id FROM task_completions
       WHERE source = 'daily_bonus' AND quarter = $1 AND created_at::date = $2::date`,
      [quarter, dateStr],
    )
    if (bonusDup.rows.length === 0 && (fullClearBonus + streakBonus) > 0) {
      await pool.query(
        `INSERT INTO task_completions
          (source, action, base_score, full_clear_bonus, streak_bonus, total_score, card_color, quarter)
         VALUES ('daily_bonus', 'full_clear', 0, $1, $2, $3, 'gray', $4)`,
        [fullClearBonus, streakBonus, fullClearBonus + streakBonus, quarter],
      )
    }
  } else {
    // 如果之前全清但現在取消勾導致不再全清 → 刪掉當天的 daily_bonus
    await pool.query(
      `DELETE FROM task_completions
       WHERE source = 'daily_bonus' AND quarter = $1 AND created_at::date = $2::date`,
      [quarter, dateStr],
    )
  }

  return { fullClear, streak, dailyTotalScore, fullClearBonus, streakBonus }
}
