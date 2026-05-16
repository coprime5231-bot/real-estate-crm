import { NextResponse } from 'next/server'
import { listTodayEvents } from '@/lib/mba/google-calendar'
import { parseTodayEvents } from '@/lib/mba/calendar'
import { getViewingByCalendarEventId } from '@/lib/mba/viewings'
import { getVisitExtrasFromDescription } from '@/lib/mba/visit-extras'

export const dynamic = 'force-dynamic'

/**
 * GET /api/m/calendar/today
 *
 * 回傳今日 MBA 任務卡片陣列。每張卡片含：
 *   - 基本資訊：eventId / summary / kind / timeLabel / location / description
 *   - 完成狀態：isDone（colorId === "8"）
 *   - 帶看延伸欄位：viewingExtras（從 PG viewings 撈；非帶看 / 查無則 null）
 */
export async function GET() {
  try {
    const raw = await listTodayEvents()
    const cards = parseTodayEvents(raw)

    const enriched = await Promise.all(
      cards.map(async (c) => {
        const viewingExtras =
          c.kind === 'viewing'
            ? await getViewingByCalendarEventId(c.eventId).catch((err) => {
                console.error('[api/m/calendar/today] viewings lookup failed:', err)
                return null
              })
            : null
        const visitExtras =
          c.kind === 'visit' || c.kind === 'visit_revisit'
            ? await getVisitExtrasFromDescription(c.description).catch((err) => {
                console.error('[api/m/calendar/today] visit-extras lookup failed:', err)
                return null
              })
            : null
        return {
          ...c,
          isDone: c.colorId === '8',
          viewingExtras,
          visitExtras,
        }
      })
    )

    return NextResponse.json({ tasks: enriched })
  } catch (err: any) {
    console.error('[api/m/calendar/today] error:', err)
    return NextResponse.json(
      { error: err?.message ?? 'failed', tasks: [] },
      { status: 500 }
    )
  }
}

// TodayTask 型別定義在 @/lib/mba/calendar
