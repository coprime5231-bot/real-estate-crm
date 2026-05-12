import { NextRequest, NextResponse } from 'next/server'
import {
  BuyerNeedData,
  BuyerNeedStatus,
  extractText,
  extractSelectValue,
  extractMultiSelectNames,
  extractRelationIds,
  queryDatabaseAll,
} from '@/lib/notion'

/**
 * GET /api/buyer-needs
 *   ?status=配案中 | 已成交 | 暫停 | 放棄  (optional, comma-separated 可多選)
 *   ?activeOnly=1                          (sugar: status=配案中)
 *   ?personId=<notion-page-id>             (該客戶名下所有需求)
 *
 * 讀 NOTION_BUYER_NEED_DB_ID（新買方需求 DB、Phase 2）
 */
export async function GET(request: NextRequest) {
  try {
    const dbId = process.env.NOTION_BUYER_NEED_DB_ID
    if (!dbId) {
      return NextResponse.json({ error: '未配置 NOTION_BUYER_NEED_DB_ID' }, { status: 400 })
    }

    const sp = request.nextUrl.searchParams
    const statusParam = sp.get('status')
    const activeOnly = sp.get('activeOnly') === '1'
    const personId = sp.get('personId')

    let statuses: string[] = []
    if (statusParam) statuses = statusParam.split(',').map((s) => s.trim()).filter(Boolean)
    else if (activeOnly) statuses = ['配案中']

    const andConditions: any[] = []
    if (statuses.length) {
      andConditions.push({ or: statuses.map((s) => ({ property: '狀態', select: { equals: s } })) })
    }
    if (personId) {
      andConditions.push({ property: '客戶', relation: { contains: personId } })
    }
    const filter = andConditions.length === 0 ? undefined
      : andConditions.length === 1 ? andConditions[0]
      : { and: andConditions }

    const pages = await queryDatabaseAll(dbId, filter)

    const needs: BuyerNeedData[] = pages
      .filter((p: any) => p.object === 'page')
      .map((p: any) => {
        const props = p.properties
        const clientIds = extractRelationIds(props['客戶'])
        return {
          id: p.id,
          name: props['名稱']?.title?.[0]?.plain_text || '(未命名)',
          clientId: clientIds[0] || undefined,
          status: (extractSelectValue(props['狀態']?.select) || undefined) as BuyerNeedStatus | undefined,
          budget: extractSelectValue(props['預算']?.select) || undefined,
          zones: extractMultiSelectNames(props['區域']),
          layouts: extractMultiSelectNames(props['格局']),
          needTags: extractMultiSelectNames(props['需求標籤']),
          needText: extractText(props['需求']?.rich_text || []) || undefined,
          note: extractText(props['NOTE']?.rich_text || []) || undefined,
          progress: extractText(props['最近進展']?.rich_text || []) || undefined,
          matchedPropertyIds: extractRelationIds(props['配上的物件']),
          viewedPropertyIds: extractRelationIds(props['帶看過的物件']),
        }
      })

    return NextResponse.json(needs)
  } catch (err: any) {
    console.error('Failed to fetch buyer-needs:', err)
    return NextResponse.json(
      { error: '無法獲取買方需求資料', detail: err?.message },
      { status: 500 }
    )
  }
}
