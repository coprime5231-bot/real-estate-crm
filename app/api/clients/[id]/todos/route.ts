// 儲存路徑：app/api/clients/[id]/todos/route.ts
import { NextRequest, NextResponse } from 'next/server'
import notion from '@/lib/notion'
import { resolveBothIds } from '@/lib/mba/id-map'

export const dynamic = 'force-dynamic'

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
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const todoDbId = process.env.NOTION_TODO_DB_ID
    if (!todoDbId) {
      return NextResponse.json({ error: '未配置 NOTION_TODO_DB_ID' }, { status: 400 })
    }
    const titleProp = await getTitlePropertyName(todoDbId)
    // G22 語意：待辦=true = done、false = pending。?待辦=false → 只列 pending
    const pendingOnly = request.nextUrl.searchParams.get('待辦') === 'false'
    // Phase 4.2：input id 可能是新 person ID、todos 仍走舊買方 relation
    const idsResolved = await resolveBothIds(params.id)
    const buyerPageId = idsResolved.buyerNotionId
    const buyerFilter = { property: '🤑 買方', relation: { contains: buyerPageId } }
    const filter: any = pendingOnly
      ? { and: [buyerFilter, { property: '待辦', checkbox: { equals: false } }] }
      : buyerFilter
    const response = await notion.databases.query({
      database_id: todoDbId,
      filter,
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
      // todoFlag=true 是 done（排後面），false 是 pending（排前面）
      .sort((a: any, b: any) => Number(a.todoFlag) - Number(b.todoFlag))
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
    // Phase 4.2：input id 可能是新 person ID、todos 仍 relation 到舊買方頁
    const idsResolved = await resolveBothIds(params.id)
    const buyerPageId = idsResolved.buyerNotionId
    const properties: any = {
      [titleProp]: { title: [{ text: { content: title } }] },
      '🤑 買方': { relation: [{ id: buyerPageId }] },
      '待辦': { checkbox: false },
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
      todoFlag: false,
    })
  } catch (error: any) {
    console.error('Failed to create todo:', error)
    return NextResponse.json({ error: '無法新增待辦', detail: error?.message }, { status: 500 })
  }
}
