import { NextResponse } from 'next/server'
import { listTodayEvents } from '@/lib/mba/google-calendar'
import { parseTodayEvents } from '@/lib/mba/calendar'
import { geocodeAddress, distanceFromHome, distanceBonus } from '@/lib/mba/geocoding'
import { getViewingByCalendarEventId } from '@/lib/mba/viewings'

export const dynamic = 'force-dynamic'

/**
 * GET /api/m/calendar/today
 *
 * 回傳今日 MBA 任務卡片陣列。每張卡片含：
 *   - 基本資訊：eventId / summary / kind / timeLabel / location / description
 *   - 完成狀態：isDone（colorId === "8"）
 *   - 距離資訊：distanceKm（無地址則 null）、distanceBonus（int）
 *
 * 注意：
 *   - Geocoding 對有 location 的事件才呼叫，逐筆序列呼叫（量不大，一天大概 10–20 筆）
 *   - Geocoding 失敗 → distanceKm = null、distanceBonus = 0（不擋流程）
 */
export async function GET() {
  try {
    const raw = await listTodayEvents()
    const cards = parseTodayEvents(raw)

    const enriched = await Promise.all(
      cards.map(async (c) => {
        const [geo, viewingExtras] = await Promise.all([
          c.location ? geocodeAddress(c.location) : Promise.resolve(null),
          c.kind === 'viewing'
            ? getViewingByCalendarEventId(c.eventId).catch((err) => {
                console.error('[api/m/calendar/today] viewings lookup failed:', err)
                return null
              })
            : Promise.resolve(null),
        ])
        let distanceKm: number | null = null
        let bonus = 0
        if (geo) {
          distanceKm = distanceFromHome(geo.lat, geo.lng)
          bonus = distanceBonus(distanceKm)
        }
        return {
          ...c,
          isDone: c.colorId === '8',
          distanceKm,
          distanceBonus: bonus,
          viewingExtras,
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
