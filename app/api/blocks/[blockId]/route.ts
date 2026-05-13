import { NextRequest, NextResponse } from 'next/server'
import notion from '@/lib/notion'

export const dynamic = 'force-dynamic'

const SUPPORTED = ['paragraph', 'bulleted_list_item', 'numbered_list_item', 'heading_1', 'heading_2', 'heading_3']

/**
 * PATCH /api/blocks/[blockId]
 * 改 Notion block 的內文（rich_text）。先 retrieve 拿 type、再用同 type 寫回。
 * Body: { content: string }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { blockId: string } }
) {
  try {
    const body = await request.json()
    const content = (body.content || '').trim()
    if (!content) {
      return NextResponse.json({ error: '內容不可為空' }, { status: 400 })
    }

    const existing: any = await notion.blocks.retrieve({ block_id: params.blockId })
    const type = existing?.type
    if (!SUPPORTED.includes(type)) {
      return NextResponse.json({ error: `不支援的 block 類型: ${type}` }, { status: 400 })
    }

    const updated: any = await notion.blocks.update({
      block_id: params.blockId,
      [type]: { rich_text: [{ type: 'text', text: { content } }] },
    } as any)

    return NextResponse.json({
      id: updated?.id || params.blockId,
      text: content,
      createdTime: existing?.created_time || '',
    })
  } catch (err: any) {
    console.error('PATCH /api/blocks/[blockId] failed:', err?.message || err)
    return NextResponse.json({ error: '更新失敗', detail: err?.message }, { status: 500 })
  }
}

/**
 * DELETE /api/blocks/[blockId]
 * Notion block 是 archive（軟刪除）、UI 上會消失。
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { blockId: string } }
) {
  try {
    await notion.blocks.delete({ block_id: params.blockId })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('DELETE /api/blocks/[blockId] failed:', err?.message || err)
    return NextResponse.json({ error: '刪除失敗', detail: err?.message }, { status: 500 })
  }
}
