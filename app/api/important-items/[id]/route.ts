import { NextRequest, NextResponse } from 'next/server'
import notion from '@/lib/notion'

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

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to update important item:', error)
    return NextResponse.json({ error: '無法更新重要大事', detail: error?.message }, { status: 500 })
  }
}
