import { NextRequest, NextResponse } from 'next/server'
import notion, { extractText } from '@/lib/notion'
import { appendClientBodyLine, saveBodyBlockId, formatBodyLine } from '@/lib/notion-body-log'

const IMPORTANT_DB_ID = process.env.NOTION_IMPORTANT_DB_ID!

// 從 relation 取第一個關聯頁面的 title
async function getRelatedPageTitle(relationProp: any): Promise<{ id: string; name: string } | null> {
  if (!relationProp?.relation?.length) return null
  const pageId = relationProp.relation[0].id
  try {
    const page: any = await notion.pages.retrieve({ page_id: pageId })
    // 找 title 類型的屬性
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
    if (!IMPORTANT_DB_ID) {
      return NextResponse.json({ error: '未配置 NOTION_IMPORTANT_DB_ID' }, { status: 400 })
    }

    const response = await notion.databases.query({
      database_id: IMPORTANT_DB_ID,
      filter: {
        property: '優先级',
        select: { does_not_equal: 'DONE' },
      },
    })

    const items = await Promise.all(
      response.results
        .filter((page: any) => page.object === 'page')
        .map(async (page: any) => {
          const p = page.properties

          const buyer = await getRelatedPageTitle(p['🤑 買方'])
          const tracking = await getRelatedPageTitle(p['🤩 追蹤與委託'])

          const source = buyer ? 'buyer' : 'tracking'
          const client = buyer || tracking

          return {
            id: page.id,
            title: p['名稱']?.title?.[0]?.plain_text || '未命名',
            clientName: client?.name || '未關聯',
            clientId: client?.id || '',
            source,
          }
        })
    )

    return NextResponse.json(items)
  } catch (error: any) {
    console.error('Failed to fetch important items:', error)
    return NextResponse.json({ error: '無法獲取重要大事', detail: error?.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!IMPORTANT_DB_ID) {
      return NextResponse.json({ error: '未配置 NOTION_IMPORTANT_DB_ID' }, { status: 400 })
    }

    const body = await request.json()
    const { title, clientId, source } = body

    if (!title?.trim()) {
      return NextResponse.json({ error: '標題不可為空' }, { status: 400 })
    }

    const properties: any = {
      '名稱': { title: [{ text: { content: title.trim() } }] },
      '優先级': { select: { name: '處理中' } },
    }

    if (clientId) {
      const relationKey = source === 'tracking' ? '🤩 追蹤與委託' : '🤑 買方'
      properties[relationKey] = { relation: [{ id: clientId }] }
    }

    const page: any = await notion.pages.create({
      parent: { database_id: IMPORTANT_DB_ID },
      properties,
    })

    // 綁定客戶時：回寫一行到客戶頁面內文、記下 block id（完成時據此劃線）。best-effort
    if (clientId) {
      const blockId = await appendClientBodyLine(
        clientId,
        formatBodyLine('重要', title.trim()),
      )
      if (blockId) await saveBodyBlockId(page.id, blockId)
    }

    return NextResponse.json({
      id: page.id,
      title: title.trim(),
      clientName: body.clientName || '',
      clientId: clientId || '',
      source: source || 'buyer',
    })
  } catch (error: any) {
    console.error('Failed to create important item:', error)
    return NextResponse.json({ error: '無法新增重要大事', detail: error?.message }, { status: 500 })
  }
}
