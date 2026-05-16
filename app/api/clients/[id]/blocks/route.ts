import { NextRequest, NextResponse } from 'next/server'
import notion from '@/lib/notion'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 分頁抓完整個頁面內文（Notion 一頁最多 100 block、舊客戶內文常 > 100）
    const allBlocks: any[] = []
    let cursor: string | undefined = undefined
    do {
      const response: any = await notion.blocks.children.list({
        block_id: params.id,
        page_size: 100,
        start_cursor: cursor,
      })
      allBlocks.push(...response.results)
      cursor = response.has_more ? response.next_cursor : undefined
    } while (cursor)

    // 只取文字類型的 block（paragraph, bulleted_list_item 等）
    const textBlocks = allBlocks
      .filter((block: any) => {
        const type = block.type
        return ['paragraph', 'bulleted_list_item', 'numbered_list_item', 'heading_1', 'heading_2', 'heading_3'].includes(type)
      })
      .map((block: any) => {
        const type = block.type
        const richText = block[type]?.rich_text || []
        const text = richText.map((t: any) => t.plain_text).join('')
        return {
          id: block.id,
          text,
          createdTime: block.created_time || '',
        }
      })
      .filter((b: any) => b.text.trim() !== '')

    // 全部回傳，倒序（最新在上）。前端「之前進度」卡固定高度 + 捲動看歷史
    const ordered = [...textBlocks].reverse()

    return NextResponse.json(ordered)
  } catch (error: any) {
    console.error('Failed to fetch blocks:', error)
    return NextResponse.json({ error: '無法獲取進度記錄', detail: error?.message }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const content = (body.content || '').trim()

    if (!content) {
      return NextResponse.json({ error: '內容不可為空' }, { status: 400 })
    }

    // 加時間戳
    const now = new Date()
    const timestamp = `${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const fullText = `${timestamp} - ${content}`

    const response = await notion.blocks.children.append({
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

    const newBlock = response.results[0] as any

    return NextResponse.json({
      id: newBlock?.id || '',
      text: fullText,
      createdTime: newBlock?.created_time || new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Failed to append block:', error)
    return NextResponse.json({ error: '無法新增進度記錄', detail: error?.message }, { status: 500 })
  }
}
