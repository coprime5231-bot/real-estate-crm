/**
 * Google Calendar client（OAuth2 + refresh token）
 *
 * 使用 n8n 同一個 Google 帳號（coprime5231@gmail.com）的主曆「預定工作」。
 * 認證走 refresh token，長期有效；access token 由 google-auth-library 自動刷新。
 *
 * Env vars:
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *   GOOGLE_REFRESH_TOKEN
 */

import { google, calendar_v3 } from 'googleapis'

const CALENDAR_ID = 'coprime5231@gmail.com'
const TZ = 'Asia/Taipei'

let cachedClient: calendar_v3.Calendar | null = null

function getCalendarClient(): calendar_v3.Calendar {
  if (cachedClient) return cachedClient

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Missing Google OAuth env vars (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN)'
    )
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret)
  oauth2.setCredentials({ refresh_token: refreshToken })

  cachedClient = google.calendar({ version: 'v3', auth: oauth2 })
  return cachedClient
}

export type RawCalendarEvent = calendar_v3.Schema$Event

/**
 * 抓 coprime5231@gmail.com 今日（Asia/Taipei）的所有事件。
 * recurring event 會展開為實際實例。
 */
export async function listTodayEvents(): Promise<RawCalendarEvent[]> {
  const cal = getCalendarClient()

  // Asia/Taipei 今日起迄（YYYY-MM-DDT00:00:00+08:00 / 23:59:59+08:00）
  const now = new Date()
  const taipeiOffsetMs = 8 * 60 * 60 * 1000
  const taipeiNow = new Date(now.getTime() + taipeiOffsetMs - now.getTimezoneOffset() * 60 * 1000)
  const y = taipeiNow.getUTCFullYear()
  const m = String(taipeiNow.getUTCMonth() + 1).padStart(2, '0')
  const d = String(taipeiNow.getUTCDate()).padStart(2, '0')
  const timeMin = `${y}-${m}-${d}T00:00:00+08:00`
  const timeMax = `${y}-${m}-${d}T23:59:59+08:00`

  const res = await cal.events.list({
    calendarId: CALENDAR_ID,
    timeMin,
    timeMax,
    singleEvents: true, // 展開週期事件
    orderBy: 'startTime',
    maxResults: 100,
    timeZone: TZ,
  })

  return res.data.items ?? []
}

/**
 * 更新事件顏色。完成的任務用 colorId = "8"（灰）。
 * 參考 n8n 「Calendar grey」節點。
 */
export async function updateEventColor(eventId: string, colorId: string): Promise<void> {
  const cal = getCalendarClient()
  await cal.events.patch({
    calendarId: CALENDAR_ID,
    eventId,
    requestBody: { colorId },
  })
}

/**
 * 建立全天事件。用於 CRM 待辦事項設定日期時同步到 Google Calendar。
 * @param summary  事件標題（例：「[林太太] 寄合約副本給代書」）
 * @param date     日期字串，格式 YYYY-MM-DD
 * @param description 可選的事件說明
 * @returns 新建的事件 ID
 */
export async function createEvent(
  summary: string,
  date: string,
  description?: string
): Promise<string> {
  const cal = getCalendarClient()
  const res = await cal.events.insert({
    calendarId: CALENDAR_ID,
    requestBody: {
      summary,
      description,
      start: { date, timeZone: TZ },
      end: { date, timeZone: TZ },
    },
  })
  return res.data.id || ''
}

/**
 * 建立定時事件（start/end dateTime）。用於帶看等需要精確時間的安排。
 * @param summary 事件標題
 * @param startISO 起始時間 ISO 字串（含 tz offset，例 "2026-04-20T14:00:00+08:00"）
 * @param durationMinutes 事件長度（分鐘），預設 30
 * @param description 事件說明（帶看可放買方 Notion URL）
 * @param location 事件地點（會顯示在 Calendar event 📍 欄位）
 * @returns 新建的事件 ID
 */
export async function createTimedEvent(
  summary: string,
  startISO: string,
  durationMinutes: number = 30,
  description?: string,
  location?: string
): Promise<string> {
  const cal = getCalendarClient()
  const start = new Date(startISO)
  if (isNaN(start.getTime())) {
    throw new Error(`Invalid startISO: ${startISO}`)
  }
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000)
  const trimmedLocation = location?.trim()
  const requestBody: calendar_v3.Schema$Event = {
    summary,
    description,
    start: { dateTime: start.toISOString(), timeZone: TZ },
    end: { dateTime: end.toISOString(), timeZone: TZ },
  }
  if (trimmedLocation) {
    requestBody.location = trimmedLocation
  }
  const res = await cal.events.insert({
    calendarId: CALENDAR_ID,
    requestBody,
  })
  return res.data.id || ''
}
