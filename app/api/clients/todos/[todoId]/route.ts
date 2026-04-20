// 儲存路徑：app/api/todos/[todoId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import notion from '@/lib/notion'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { todoId: string } }
) {
  try {
    const body = await request.json()
    const updateProperties: any = {}
    if (body.todoFlag !== undefined) {
      updateProperties['待辦'] = { checkbox: !!body.todoFlag }
    }
    if (body.priority !== undefined) {
      updateProperties['優先度'] = body.priority
        ? { select: { name: body.priority } }
        : { select: null }
    }
    if (body.status !== undefined) {
      updateProperties['Status'] = body.status
        ? { status: { name: body.status } }
        : { status: null }
    }
    await notion.pages.update({ page_id: params.todoId, properties: updateProperties })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to update todo:', error)
    return NextResponse.json({ error: '無法更新待辦', detail: error?.message }, { status: 500 })
  }
}
