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
