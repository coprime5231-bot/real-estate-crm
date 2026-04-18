import { pool } from './db'

export interface ViewingExtras {
  communityName: string | null
  communityUrl: string | null
  communityLejuUrl: string | null
  colleagueName: string | null
  colleaguePhone: string | null
  location: string | null
}

/**
 * 依 Google Calendar event id 撈出 CRM 寫入的帶看延伸欄位。
 * 沒找到（舊事件 / 非 CRM 建）回 null，呼叫端要 graceful degrade。
 */
export async function getViewingByCalendarEventId(
  calendarEventId: string,
): Promise<ViewingExtras | null> {
  const res = await pool.query(
    `SELECT community_name, community_url, community_leju_url,
            colleague_name, colleague_phone, location
     FROM viewings
     WHERE calendar_event_id = $1
     LIMIT 1`,
    [calendarEventId],
  )
  const row = res.rows[0]
  if (!row) return null
  return {
    communityName: row.community_name ?? null,
    communityUrl: row.community_url ?? null,
    communityLejuUrl: row.community_leju_url ?? null,
    colleagueName: row.colleague_name ?? null,
    colleaguePhone: row.colleague_phone ?? null,
    location: row.location ?? null,
  }
}
