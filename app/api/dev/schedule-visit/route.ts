import { NextRequest, NextResponse } from 'next/server'
import notion, { extractText, extractSelectValue } from '@/lib/notion'
import { createTimedEvent } from '@/lib/mba/google-calendar'

export const dynamic = 'force-dynamic'

type VisitTodo = '物件地拜訪' | '戶藉地拜訪' | '物件地覆訪' | '戶藉地覆訪'

/**
 * POST /api/dev/schedule-visit  body={ id, scheduledAt }
 *   scheduledAt: ISO datetime string (帶 +08:00、例 "2026-05-22T15:00:00+08:00")
 *
 * - 從 Notion 撈名稱 / 屋主 / 地址（依目前 visitTodo 是物件 or 戶藉 stage）
 * - 呼 createTimedEvent → 取得 event id + htmlLink
 * - PATCH Notion：下次拜訪時間 + 行事曆ID（存 htmlLink、給 user 點開即可進該 event）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const id: string | undefined = body?.id
    const scheduledAt: string | undefined = body?.scheduledAt
    if (!id) return NextResponse.json({ error: 'id 必填' }, { status: 400 })
    if (!scheduledAt) return NextResponse.json({ error: 'scheduledAt 必填 (ISO datetime)' }, { status: 400 })

    const page: any = await notion.pages.retrieve({ page_id: id })
    const props = page.properties || {}
    const name = props['名稱']?.title?.[0]?.plain_text || '(未命名)'
    const owner = extractText(props['屋主']?.rich_text || []) || ''
    const ownerPhone = props['手機']?.phone_number || ''
    const visitTodo = (extractSelectValue(props['待辦']?.select) || '') as VisitTodo | ''
    const address = extractText(props['物件地址']?.rich_text || []) || ''
    const householdAddress = extractText(props['戶藉地址']?.rich_text || []) || ''

    const isHousehold = visitTodo === '戶藉地拜訪' || visitTodo === '戶藉地覆訪'
    const location = (isHousehold ? householdAddress : address).trim()
    if (!location) {
      return NextResponse.json(
        { error: `物件「${name}」缺${isHousehold ? '戶藉' : '物件'}地址、無法建立行事曆` },
        { status: 400 }
      )
    }

    const summary = `[${visitTodo || '拜訪'}] ${name}${owner ? ' · 屋主：' + owner : ''}`
    const descLines: string[] = []
    descLines.push(`物件：${name}`)
    if (owner) descLines.push(`屋主：${owner}`)
    if (ownerPhone) descLines.push(`手機：${ownerPhone}`)
    descLines.push(`地址：${location}`)
    descLines.push(`Notion：https://www.notion.so/${id.replace(/-/g, '')}`)
    const description = descLines.join('\n')

    const ev = await createTimedEvent(summary, scheduledAt, 30, description, location)
    if (!ev.id) {
      return NextResponse.json({ error: 'Google Calendar 回傳空 event id' }, { status: 502 })
    }

    // 存日期到 Notion（date 型只取日期+時間部分、Notion 自己會做 timezone）
    await notion.pages.update({
      page_id: id,
      properties: {
        '下次拜訪時間': { date: { start: scheduledAt } },
        '行事曆ID': { rich_text: [{ text: { content: ev.htmlLink || ev.id } }] },
      },
    })

    return NextResponse.json({
      ok: true,
      id,
      eventId: ev.id,
      htmlLink: ev.htmlLink,
      scheduledAt,
    })
  } catch (err: any) {
    console.error('POST /api/dev/schedule-visit failed:', err?.message || err)
    return NextResponse.json({ error: '無法建立行事曆', detail: err?.message }, { status: 500 })
  }
}
