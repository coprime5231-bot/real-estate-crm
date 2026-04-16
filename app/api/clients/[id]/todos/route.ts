// 儲存路徑：app/api/clients/[id]/todos/route.ts
import { NextRequest, NextResponse } from 'next/server'
import notion from '@/lib/notion'

const titleNameCache: Record<string, string> = {}
async function getTitlePropertyName(dbId: string): Promise<string> {
  if (titleNameCache[dbId]) return titleNameCache[dbId]
  const db: any = await notion.databases.retrieve({ database_id: dbId })
  for (const [name, def] of Object.entries(db.properties || {})) {
    if ((def as any).type === 'title') {
      titleNameCache[dbId] = name
      return name
    }
  }
  throw new Error(`Title property not found in ${dbId}`)
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const todoDbId = process.env.NOTION_TODO_DB_ID
    if (!todoDbId) {
      return NextResponse.json({ error: '未配置 NOTION_TODO_DB_ID' }, { status: 400 })
    }
    const titleProp = await getTitlePropertyName(todoDbId)
    const response = await notion.databases.query({
      database_id: todoDbId,
      filter: { property: '買方', relation: { contains: params.id } },
    })
    const todos = response.results
      .filter((page: any) => page.object === 'page')
      .map((page: any) => {
        const p = page.properties
        return {
          id: page.id,
          title: p[titleProp]?.title?.[0]?.plain_text || '未命名',
          status: p['Status']?.status?.name || null,
          priority: p['優先度']?.select?.name || null,
          todoFlag: p['待辦']?.checkbox ?? false,
        }
      })
      .sort((a: any, b: any) => Number(b.todoFlag) - Number(a.todoFlag))
    return NextResponse.json(todos)
  } catch (error: any) {
    console.error('Failed to fetch todos:', error)
    return NextResponse.json({ error: '無法獲取待辦', detail: error?.message }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const todoDbId = process.env.NOTION_TODO_DB_ID
    if (!todoDbId) {
      return NextResponse.json({ error: '未配置 NOTION_TODO_DB_ID' }, { status: 400 })
    }
    const body = await request.json()
    const title = (body.title || '').trim()
    if (!title) return NextResponse.json({ error: '標題不可為空' }, { status: 400 })
    const titleProp = await getTitlePropertyName(todoDbId)
    const properties: any = {
      [titleProp]: { title: [{ text: { content: title } }] },
      '買方': { relation: [{ id: params.id }] },
      '待辦': { checkbox: true },
    }
    if (body.priority) {
      properties['優先度'] = { select: { name: body.priority } }
    }
    const page: any = await notion.pages.create({
      parent: { database_id: todoDbId },
      properties,
    })
    return NextResponse.json({
      id: page.id,
      title,
      status: null,
      priority: body.priority || null,
      todoFlag: true,
    })
  } catch (error: any) {
    console.error('Failed to create todo:', error)
    return NextResponse.json({ error: '無法新增待辦', detail: error?.message }, { status: 500 })
  }
}
