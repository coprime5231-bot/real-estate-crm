import { NextRequest, NextResponse } from 'next/server'
import {
  PropertyV2Data,
  PropertyStatus,
  VisitTodo,
  extractText,
  extractSelectValue,
  extractMultiSelectNames,
  extractRelationIds,
  queryDatabaseAll,
} from '@/lib/notion'

/**
 * GET /api/properties-v2
 *   ?status=開發信 | 追蹤 | 委託 | 過期 | 成交  (optional 過濾、可多選 comma-separated)
 *   ?activeOnly=1                              (sugar：等同 status=開發信,追蹤,委託)
 *
 * 讀 NOTION_PROPERTY_DB_ID（新物件 DB、Phase 2）
 */
export async function GET(request: NextRequest) {
  try {
    const dbId = process.env.NOTION_PROPERTY_DB_ID
    if (!dbId) {
      return NextResponse.json({ error: '未配置 NOTION_PROPERTY_DB_ID' }, { status: 400 })
    }

    const sp = request.nextUrl.searchParams
    const statusParam = sp.get('status')
    const activeOnly = sp.get('activeOnly') === '1'

    let statuses: string[] = []
    if (statusParam) statuses = statusParam.split(',').map((s) => s.trim()).filter(Boolean)
    else if (activeOnly) statuses = ['開發信', '追蹤', '委託']

    const filter = statuses.length
      ? {
          or: statuses.map((s) => ({ property: '狀態', select: { equals: s } })),
        }
      : undefined

    const pages = await queryDatabaseAll(dbId, filter)

    const properties: PropertyV2Data[] = pages
      .filter((p: any) => p.object === 'page')
      .map((p: any) => {
        const props = p.properties
        return {
          id: p.id,
          name: props['名稱']?.title?.[0]?.plain_text || '(未命名)',
          address: extractText(props['物件地址']?.rich_text || []) || undefined,
          householdAddress: extractText(props['戶藉地址']?.rich_text || []) || undefined,
          ownerIds: extractRelationIds(props['屋主']),
          status: (extractSelectValue(props['狀態']?.select) || undefined) as PropertyStatus | undefined,
          devLetter: props['開發信']?.checkbox === true,
          devProgress: extractMultiSelectNames(props['開發進度']),
          visitTodo: (extractSelectValue(props['待辦']?.select) || undefined) as VisitTodo | undefined,
          visitSynced: (extractSelectValue(props['已同步']?.select) || undefined) as VisitTodo | undefined,
          area: extractText(props['坪數']?.rich_text || []) || undefined,
          mainBuilding: extractText(props['主建物']?.rich_text || []) || undefined,
          layout: extractText(props['格局']?.rich_text || []) || undefined,
          parking: extractMultiSelectNames(props['車位']),
          price: extractText(props['開價']?.rich_text || []) || undefined,
          objectLetter: extractText(props['物信']?.rich_text || []) || undefined,
          householdLetter: extractText(props['戶信']?.rich_text || []) || undefined,
          expiry: props['委託到期日']?.date?.start ?? null,
          important: extractText(props['重要事項']?.rich_text || []) || undefined,
          web: props['網頁']?.url || undefined,
        }
      })

    return NextResponse.json(properties)
  } catch (err: any) {
    console.error('Failed to fetch properties-v2:', err)
    return NextResponse.json(
      { error: '無法獲取物件資料', detail: err?.message },
      { status: 500 }
    )
  }
}
