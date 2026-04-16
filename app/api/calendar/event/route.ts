import { NextRequest, NextResponse } from 'next/server'
import { createEvent } from '@/lib/mba/google-calendar'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { summary, date, description } = body

    if (!summary?.trim() || !date) {
      return NextResponse.json({ error: '缺少標題或日期' }, { status: 400 })
    }

    const eventId = await createEvent(summary.trim(), date, description)

    return NextResponse.json({ eventId })
  } catch (error: any) {
    console.error('Failed to create calendar event:', error)
    return NextResponse.json(
      { error: '無法建立 Google Calendar 事件', detail: error?.message },
      { status: 500 }
    )
  }
}
