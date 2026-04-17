import { NextRequest, NextResponse } from 'next/server'
import notion from '@/lib/notion'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const type = body.type as '洽談' | '面談'
    const content = (body.content || '').trim()

    if (!content) {
      return NextResponse.json({ error: '內容不可為空' }, { status: 400 })
    }

    const emoji = type === '面談' ? '🤝' : '📞'
    const now = new Date()
    const timestamp = `${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const fullText = `[${timestamp} ${emoji} ${type}] ${content}`

    // Step 1: Append block to page body
    let blockId = ''
    try {
      const blockRes = await notion.blocks.children.append({
        block_id: params.id,
        children: [
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ type: 'text', text: { content: fullText } }],
            },
          },
        ],
      })
      blockId = (blockRes.results[0] as any)?.id || ''
    } catch (error: any) {
      console.error('Failed to append block:', error)
      return NextResponse.json({ error: '無法新增進度記錄', detail: error?.message }, { status: 500 })
    }

    // Step 2: Update 日期 field to +3 days
    const followUpDate = new Date()
    followUpDate.setDate(followUpDate.getDate() + 3)
    const newFollowUp = `${followUpDate.getFullYear()}-${String(followUpDate.getMonth() + 1).padStart(2, '0')}-${String(followUpDate.getDate()).padStart(2, '0')}`

    let dateWarning = false
    try {
      await notion.pages.update({
        page_id: params.id,
        properties: {
          '日期': { date: { start: newFollowUp } },
        },
      })
    } catch (error: any) {
      console.error('Failed to update follow-up date:', error)
      dateWarning = true
    }

    return NextResponse.json({
      blockId,
      text: fullText,
      newFollowUp: dateWarning ? null : newFollowUp,
      warning: dateWarning ? '已記錄但跟進日設定失敗，請手動設定' : null,
    })
  } catch (error: any) {
    console.error('Failed to quick-log:', error)
    return NextResponse.json({ error: '快速記錄失敗', detail: error?.message }, { status: 500 })
  }
}
