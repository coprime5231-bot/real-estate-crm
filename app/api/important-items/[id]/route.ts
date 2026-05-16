import { NextRequest, NextResponse } from 'next/server'
import notion from '@/lib/notion'
import { strikeItemBodyLine } from '@/lib/notion-body-log'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const updateProperties: any = {}

    if (body.status === 'done') {
      updateProperties['優先级'] = { select: { name: 'DONE' } }
    }

    await notion.pages.update({
      page_id: params.id,
      properties: updateProperties,
    })

    // 完成 → 客戶內文那一行加刪除線（只劃線、留著）。best-effort
    if (body.status === 'done') {
      await strikeItemBodyLine(params.id, true)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to update important item:', error)
    return NextResponse.json({ error: '無法更新重要大事', detail: error?.message }, { status: 500 })
  }
}
