/**
 * Calendar event 解析與類型辨識
 *
 * 依 MBA SKILL.md「📱 任務類型 → 1. 日任務」規格：
 *   summary 由上到下比對：
 *     含「覆訪」 → 拜訪-覆訪（灰；按鈕：無效 / 再來一次 / 找到人了）
 *     含「拜訪」 → 拜訪（灰；按鈕：無效 / 再來一次 / 找到人了）
 *     含「帶看」 → 帶看（灰；按鈕：沒興趣 / 有興趣）
 *     其他 → 忽略（不塞進今日任務卡片）
 */

import type { RawCalendarEvent } from './google-calendar'

export type TaskKind = 'visit_revisit' | 'visit' | 'viewing'

export interface MbaTaskCard {
  /** Google Calendar event id，後續寫回/變灰用 */
  eventId: string
  /** 事件 summary（標題） */
  summary: string
  /** 任務類型（已分類） */
  kind: TaskKind
  /** 事件地點（location 欄；可能為空） */
  location: string | null
  /** 事件描述（description；buyer page URL 等藏在這） */
  description: string | null
  /** ISO 8601 開始時間（含 timezone） */
  start: string
  /** ISO 8601 結束時間 */
  end: string
  /** 目前 colorId（"8" 代表已完成變灰；其他為待辦） */
  colorId: string | null
  /** 時間字串（HH:mm，Asia/Taipei） */
  timeLabel: string
}

/**
 * API 回傳給前端的完整卡片（MbaTaskCard + 完成狀態 + 距離）
 */
export interface TodayTask extends MbaTaskCard {
  isDone: boolean
  distanceKm: number | null
  distanceBonus: number
}

/**
 * 判斷 summary 屬於哪一類任務。
 * 回傳 null 代表不是 MBA 任務（例如純行事曆事件、會議等）。
 */
export function classifyEventSummary(summary: string | null | undefined): TaskKind | null {
  if (!summary) return null
  // 由上到下比對（覆訪優先，因為「覆訪」字面包含「訪」但不含「拜訪」）
  if (summary.includes('覆訪')) return 'visit_revisit'
  if (summary.includes('拜訪')) return 'visit'
  if (summary.includes('帶看')) return 'viewing'
  return null
}

/**
 * 從 ISO 字串取 Asia/Taipei 的 HH:mm。
 * Google Calendar 會回 `2026-04-15T09:30:00+08:00`，直接字串切比 Date parsing 可靠。
 */
function extractTaipeiTime(iso: string | null | undefined): string {
  if (!iso) return ''
  // 若已是 +08:00 格式，直接取 T 後的 HH:mm
  const m = iso.match(/T(\d{2}):(\d{2})/)
  return m ? `${m[1]}:${m[2]}` : ''
}

/**
 * 把 Google Calendar 原始 event 轉成 MBA 任務卡片。
 * 非 MBA 任務（summary 不含關鍵字）會被過濾掉。
 */
export function parseTodayEvents(rawEvents: RawCalendarEvent[]): MbaTaskCard[] {
  const cards: MbaTaskCard[] = []
  for (const ev of rawEvents) {
    const kind = classifyEventSummary(ev.summary)
    if (!kind) continue
    if (!ev.id) continue
    const start = ev.start?.dateTime ?? ev.start?.date ?? null
    const end = ev.end?.dateTime ?? ev.end?.date ?? null
    if (!start || !end) continue

    cards.push({
      eventId: ev.id,
      summary: ev.summary ?? '',
      kind,
      location: ev.location ?? null,
      description: ev.description ?? null,
      start,
      end,
      colorId: ev.colorId ?? null,
      timeLabel: extractTaipeiTime(start),
    })
  }
  return cards
}
