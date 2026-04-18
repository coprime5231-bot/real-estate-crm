import { NextRequest, NextResponse } from 'next/server'
import { createTimedEvent } from '@/lib/mba/google-calendar'
import { pool } from '@/lib/mba/db'

/**
 * POST /api/viewings
 * 建立帶看：打 Google Calendar 30 min 事件 + INSERT 到 PG viewings 表。
 *
 * Body:
 *   buyerId          買方 Notion page ID（必填）
 *   buyerName        買方名稱（用於組 event summary，可從前端傳）
 *   datetime         ISO 字串，帶 tz offset，例 "2026-04-20T14:00:00+08:00"
 *   location         地點（必填）
 *   communityName    社區名稱（optional）
 *   communityUrl     永慶案件連結（optional）
 *   communityLejuUrl 樂居連結（optional）
 *   colleagueName    同事名
 *   colleaguePhone   同事電話
 *   note             備註（optional）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      buyerId,
      buyerName,
      datetime,
      location,
      communityName,
      communityUrl,
      communityLejuUrl,
      colleagueName,
      colleaguePhone,
      note,
    } = body

    // 必填檢查
    if (!buyerId || !datetime || !location?.trim() || !colleagueName?.trim() || !colleaguePhone?.trim()) {
      return NextResponse.json(
        { error: '必填欄位未填寫（買方、日期時間、地點、同事名、同事電話）' },
        { status: 400 }
      )
    }

    // 建 Google Calendar 事件
    const buyerNotionUrl = `https://www.notion.so/${String(buyerId).replace(/-/g, '')}`
    // 標題只含買方與社區名；地址走 location 欄位（📍），不進標題。
    const trimmedCommunity = communityName?.trim() || ''
    const summary = trimmedCommunity
      ? `帶看 ${buyerName || '客戶'} ${trimmedCommunity}`
      : `帶看 ${buyerName || '客戶'}`
    const descLines = [
      `買方：${buyerName || ''}`.trim(),
      `買方 Notion：${buyerNotionUrl}`,
      `同事：${colleagueName.trim()} / ${colleaguePhone.trim()}`,
    ]
    if (communityUrl?.trim()) descLines.push(`社區資料：${communityUrl.trim()}`)
    if (note?.trim()) descLines.push(`備註：${note.trim()}`)
    const description = descLines.join('\n')

    let calendarEventId: string
    try {
      calendarEventId = await createTimedEvent(summary, datetime, 30, description, location.trim())
    } catch (err: any) {
      console.error('Google Calendar createTimedEvent failed:', err?.message || err)
      return NextResponse.json(
        { error: '無法建立 Google Calendar 事件', detail: err?.message },
        { status: 502 }
      )
    }
    if (!calendarEventId) {
      return NextResponse.json(
        { error: 'Google Calendar 回傳空的 event id' },
        { status: 502 }
      )
    }

    // INSERT 到 viewings 表
    try {
      const insertRes = await pool.query(
        `INSERT INTO viewings (
          calendar_event_id, notion_buyer_id, datetime, location,
          community_name, community_url, community_leju_url,
          colleague_name, colleague_phone, note
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id, created_at`,
        [
          calendarEventId,
          buyerId,
          datetime,
          location.trim(),
          communityName?.trim() || null,
          communityUrl?.trim() || null,
          communityLejuUrl?.trim() || null,
          colleagueName.trim(),
          colleaguePhone.trim(),
          note?.trim() || null,
        ]
      )
      const row = insertRes.rows[0]
      return NextResponse.json({
        id: row.id,
        calendarEventId,
        createdAt: row.created_at,
      })
    } catch (err: any) {
      console.error('INSERT viewings failed:', err?.message || err)
      // 盡量報明確錯誤，但 Calendar 事件已建立，告知使用者以便人工修正
      return NextResponse.json(
        {
          error: 'Calendar 事件已建立，但 viewings 表寫入失敗',
          calendarEventId,
          detail: err?.message,
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('Failed to create viewing:', error)
    return NextResponse.json(
      { error: '無法建立帶看', detail: error?.message },
      { status: 500 }
    )
  }
}
