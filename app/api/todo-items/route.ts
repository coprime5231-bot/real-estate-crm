import { NextRequest, NextResponse } from 'next/server'
import notion from '@/lib/notion'

const TODO_DB_ID = process.env.NOTION_TODO_DB_ID!
const BUYER_DB_ID = process.env.NOTION_BUYER_DB_ID!
const TRACKING_DB_ID = process.env.NOTION_TRACKING_DB_ID!

// 快取 title 屬性名稱
let titlePropName: string | null = null
async function getTitlePropName(): Promise<string> {
  if (titlePropName) return titlePropName
  const db: any = await notion.databases.retrieve({ database_id: TODO_DB_ID })
  for (const [name, def] of Object.entries(db.properties || {})) {
    if ((def as any).type === 'title') {
      titlePropName = name
      return name
    }
  }
  return 'Name' // fallback
}

// 從 relation 取第一個關聯頁面的 title
async function getRelatedPageTitle(relationProp: any): Promise<{ id: string; name: string } | null> {
  if (!relationProp?.relation?.length) return null
  const pageId = relationProp.relation[0].id
  try {
    const page: any = await notion.pages.retrieve({ page_id: pageId })
    for (const [, def] of Object.entries(page.properties || {})) {
      const d = def as any
      if (d.type === 'title') {
        return { id: pageId, name: d.title?.[0]?.plain_text || '未命名' }
      }
    }
    return { id: pageId, name: '未命名' }
  } catch {
    return { id: pageId, name: '未命名' }
  }
}

export async function GET() {
  try {
    if (!TODO_DB_ID) {
      return NextResponse.json({ error: '未配置 NOTION_TODO_DB_ID' }, { status: 400 })
    }

    // 查詢未完成的待辦（待辦 checkbox = true 表示待辦中，false 或無 = 完成）
    // 根據現有邏輯，待辦 = true 代表「是待辦」，在 CRM 端我們顯示這些
    const response = await notion.databases.query({
      database_id: TODO_DB_ID,
      filter: {
        property: '待辦',
        checkbox: { equals: true },
      },
    })

    const items = await Promise.all(
      response.results
        .filter((page: any) => page.object === 'page')
        .map(async (page: any) => {
          const p = page.properties

          // 取得 title
          let title = '未命名'
          for (const [, def] of Object.entries(p)) {
            const d = def as any
            if (d.type === 'title') {
              title = d.title?.[0]?.plain_text || '未命名'
              break
            }
          }

          // 反查關聯的買方或委託
          const buyer = await getRelatedPageTitle(p['🤑 買方'])
          const tracking = await getRelatedPageTitle(p['🤩 追蹤與委託'])

          const source = buyer ? 'buyer' : tracking ? 'tracking' : 'buyer'
          const client = buyer || tracking

          return {
            id: page.id,
            title,
            clientName: client?.name || '未關聯',
            clientId: client?.id || '',
            source,
            completed: false,
            createdTime: (page as any).created_time || '',
          }
        })
    )

    // 排序：按建立時間（最新在前）
    items.sort((a, b) => {
      if (!a.createdTime) return 1
      if (!b.createdTime) return -1
      return new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime()
    })

    return NextResponse.json(items)
  } catch (error: any) {
    console.error('Failed to fetch todo items:', error)
    return NextResponse.json({ error: '無法獲取待辦事項', detail: error?.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!TODO_DB_ID) {
      return NextResponse.json({ error: '未配置 NOTION_TODO_DB_ID' }, { status: 400 })
    }

    const body = await request.json()
    const title = (body.title || '').trim()
    if (!title) return NextResponse.json({ error: '標題不可為空' }, { status: 400 })

    const titleKey = await getTitlePropName()
    const properties: any = {
      [titleKey]: { title: [{ text: { content: title } }] },
      '待辦': { checkbox: true },
    }

    // 日期欄位（預設今天）
    if (body.date) {
      properties['日期'] = { date: { start: body.date } }
    }

    // 可選：綁定買方
    if (body.clientId) {
      properties['🤑 買方'] = { relation: [{ id: body.clientId }] }
    }

    const page: any = await notion.pages.create({
      parent: { database_id: TODO_DB_ID },
      properties,
    })

    return NextResponse.json({
      id: page.id,
      title,
      clientName: body.clientName || '未關聯',
      clientId: body.clientId || '',
      source: 'buyer',
      completed: false,
      createdTime: page.created_time || '',
    })
  } catch (error: any) {
    console.error('Failed to create todo item:', error)
    return NextResponse.json({ error: '無法新增待辦事項', detail: error?.message }, { status: 500 })
  }
}
