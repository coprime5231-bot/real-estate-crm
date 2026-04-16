// MBA 分數計算純函數
// 規格見 SKILL.md「🎮 分數系統」

export type CardColor = 'gray' | 'green' | 'blue' | 'purple' | 'orange'

export type SpecialAction = 'revisit' | 'entrust' | 'deposit' | 'close'

/** 特殊自訂任務（覆看 / 委託 / 收斡 / 成交）的基礎分與卡色 */
export const SPECIAL_TASK_MAP: Record<
  SpecialAction,
  { label: string; baseScore: number; cardColor: CardColor; stars: number }
> = {
  revisit: { label: '覆看', baseScore: 100, cardColor: 'green', stars: 0 },
  entrust: { label: '委託', baseScore: 500, cardColor: 'purple', stars: 30 },
  deposit: { label: '收斡', baseScore: 500, cardColor: 'purple', stars: 30 },
  close: { label: '成交', baseScore: 5000, cardColor: 'orange', stars: 100 },
}

/** 拜訪按鈕分數（找到人=藍卡，其餘綠卡） */
export const VISIT_SCORE: Record<
  'invalid' | 'retry' | 'found',
  { baseScore: number; cardColor: CardColor }
> = {
  invalid: { baseScore: 10, cardColor: 'green' },
  retry: { baseScore: 10, cardColor: 'green' },
  found: { baseScore: 50, cardColor: 'blue' },
}

/** 帶看按鈕分數 */
export const VIEWING_SCORE: Record<
  'uninterested' | 'interested',
  { baseScore: number; cardColor: CardColor }
> = {
  uninterested: { baseScore: 30, cardColor: 'green' },
  interested: { baseScore: 60, cardColor: 'green' },
}

/** 距離加分：<10km=0、10–20=10、20–30=20... */
export function distanceBonus(km: number | null | undefined): number {
  if (km == null || km < 10) return 0
  return Math.floor(km / 10) * 10
}

/** 等級門檻：Lv n 累計 = n(n+1)/2 * 100 */
export function levelFromTotal(total: number): { level: number; next: number; prev: number } {
  let lv = 1
  while ((lv * (lv + 1)) / 2 * 100 <= total) lv++
  const prev = ((lv - 1) * lv) / 2 * 100
  const next = (lv * (lv + 1)) / 2 * 100
  return { level: lv, prev, next }
}
