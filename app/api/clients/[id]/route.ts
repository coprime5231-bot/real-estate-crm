import { NextRequest, NextResponse } from 'next/server'
import notion from '@/lib/notion'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()

    const updateProperties: any = {}

    if (body.name !== undefined) {
      updateProperties['名稱'] = {
        title: [{ text: { content: body.name } }],
      }
    }

    if (body.phone !== undefined) {
      updateProperties['手機'] = {
        rich_text: [{ text: { content: body.phone } }],
      }
    }

    if (body.note !== undefined) {
      updateProperties['NOTE'] = {
        rich_text: [{ text: { content: body.note } }],
      }
    }

    if (body.progress !== undefined) {
      updateProperties['最近進展'] = {
        rich_text: [{ text: { content: body.progress } }],
      }
    }

    if (body.grade !== undefined) {
      updateProperties['等級'] = {
        select: { name: body.grade },
      }
    }

    if (body.budget !== undefined) {
      updateProperties['預算'] = {
        rich_text: [{ text: { content: body.budget } }],
      }
    }

    if (body.needs !== undefined) {
      updateProperties['需求'] = {
        rich_text: [{ text: { content: body.needs } }],
      }
    }

    if (body.area !== undefined) {
      updateProperties['區域'] = {
        rich_text: [{ text: { content: body.area } }],
      }
    }

    if (body.nextFollowUp !== undefined) {
      updateProperties['下次跟進'] = {
        date: { start: body.nextFollowUp },
      }
    }

    const response = await notion.pages.update({
      page_id: id,
      properties: updateProperties,
    })

    return NextResponse.json({
      success: true,
      id: response.id,
    })
  } catch (error) {
    console.error('Failed to update client:', error)
    return NextResponse.json(
      { error: '無法更新客戶資料' },
      { status: 500 }
    )
  }
}
