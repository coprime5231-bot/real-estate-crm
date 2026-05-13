import { NextRequest, NextResponse } from 'next/server'
import notion from '@/lib/notion'
import { resolveBothIds } from '@/lib/mba/id-map'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Phase 4.2：blocks 仍掛在舊買方 DB page 下
    const ids = await resolveBothIds(params.id)
    const response = await notion.blocks.children.list({
      block_id: ids.buyerNotionId,
      page_size: 100,
    })

    // 只取文字類型的 block（paragraph, bulleted_list_item 等）
    const textBlocks = response.results
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

    // 取最後 3 筆，倒序（最新在上）
    const last3 = textBlocks.slice(-3).reverse()

    return NextResponse.json(last3)
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

    // Phase 4.2：blocks 寫到舊買方 DB page 下
    const ids = await resolveBothIds(params.id)
    const response = await notion.blocks.children.append({
      block_id: ids.buyerNotionId,
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
