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

    // 客戶等級（select）
    if (body.grade !== undefined) {
      updateProperties['客戶等級'] = body.grade
        ? { select: { name: body.grade } }
        : { select: null }
    }

    // 預算（select）
    if (body.budget !== undefined) {
      updateProperties['預算'] = body.budget
        ? { select: { name: body.budget } }
        : { select: null }
    }

    if (body.needs !== undefined) {
      updateProperties['需求'] = {
        rich_text: [{ text: { content: body.needs } }],
      }
    }

    // 區域（multi_select）— 前端用「、」或「,」分隔字串
    if (body.area !== undefined) {
      const names =
        typeof body.area === 'string'
          ? body.area
              .split(/[、,，]/)
              .map((s: string) => s.trim())
              .filter(Boolean)
          : Array.isArray(body.area)
          ? body.area
          : []
      updateProperties['區域'] = {
        multi_select: names.map((name: string) => ({ name })),
      }
    }

    // 下次跟進 → 寫回 Notion「日期」欄位
    if (body.nextFollowUp !== undefined) {
      updateProperties['日期'] = body.nextFollowUp
        ? { date: { start: body.nextFollowUp } }
        : { date: null }
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
