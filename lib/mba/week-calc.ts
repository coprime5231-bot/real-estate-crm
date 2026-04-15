/**
 * MBA Week / Quarter 計算
 *
 * 規則：
 *  - 季別命名：2026Q1 / 2026Q2 / 2026Q3 / 2026Q4
 *  - 季起算日：1/1, 4/1, 7/1, 10/1
 *  - 季結束日：3/31, 6/30, 9/30, 12/31
 *  - Week 編號：以季第一天為 Week 01 第一天
 *      week = Math.floor((today - quarterStart) / 7) + 1
 *  - 若標準 12 週後仍有剩餘日（例如 6/24–6/30），全算 Week 13
 *
 * 全部以本地時區（Asia/Taipei）計算。函式接受 Date 物件，
 * 內部用 UTC midnight 對齊以避免日光節約等漂移。
 */

export type Quarter = `${number}Q${1 | 2 | 3 | 4}`

export interface WeekInfo {
  quarter: Quarter
  /** 季的第 1 週 = 1，最大 13 */
  week: number
  /** 0 = 季第一天 */
  daysIntoQuarter: number
  /** 距離季末（含當天）剩幾天，季末當天 = 1 */
  daysToQuarterEnd: number
  /** 季開始日 (yyyy-mm-dd) */
  quarterStart: string
  /** 季結束日 (yyyy-mm-dd) */
  quarterEnd: string
}

const TZ_OFFSET_HOURS = 8 // Asia/Taipei

function toLocalDateOnly(d: Date): Date {
  // 取本地 (UTC+8) 當天的 00:00 並轉回 UTC 表示，方便做純日期算術
  const utcMs = d.getTime()
  const localMs = utcMs + TZ_OFFSET_HOURS * 3600_000
  const local = new Date(localMs)
  const y = local.getUTCFullYear()
  const m = local.getUTCMonth()
  const day = local.getUTCDate()
  return new Date(Date.UTC(y, m, day))
}

function fmt(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function quarterBounds(date: Date): { start: Date; end: Date; q: 1 | 2 | 3 | 4; year: number } {
  const local = toLocalDateOnly(date)
  const y = local.getUTCFullYear()
  const m = local.getUTCMonth() // 0–11
  const q = (Math.floor(m / 3) + 1) as 1 | 2 | 3 | 4
  const startMonth = (q - 1) * 3
  const start = new Date(Date.UTC(y, startMonth, 1))
  const end = new Date(Date.UTC(y, startMonth + 3, 0)) // 下一季第 0 天 = 本季最後一天
  return { start, end, q, year: y }
}

export function getWeekInfo(date: Date = new Date()): WeekInfo {
  const today = toLocalDateOnly(date)
  const { start, end, q, year } = quarterBounds(date)
  const daysIntoQuarter = Math.floor((today.getTime() - start.getTime()) / 86_400_000)
  const totalDays = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1
  const rawWeek = Math.floor(daysIntoQuarter / 7) + 1
  const week = Math.min(rawWeek, 13)
  const daysToQuarterEnd = Math.floor((end.getTime() - today.getTime()) / 86_400_000) + 1
  return {
    quarter: `${year}Q${q}` as Quarter,
    week,
    daysIntoQuarter,
    daysToQuarterEnd,
    quarterStart: fmt(start),
    quarterEnd: fmt(end),
    _totalDays: totalDays,
  } as WeekInfo & { _totalDays: number }
}

/** 週起始日（週一）— 給「週任務每週一 00:00 重置」用 */
export function getWeekStart(date: Date = new Date()): Date {
  const today = toLocalDateOnly(date)
  const dow = today.getUTCDay() // 0=Sun
  const diff = dow === 0 ? -6 : 1 - dow
  return new Date(today.getTime() + diff * 86_400_000)
}
