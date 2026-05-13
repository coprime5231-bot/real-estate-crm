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
  createNotionPage,
  updateNotionPage,
  compactProps,
  propTitle,
  propRichText,
  propUrl,
  propCheckbox,
  propSelect,
  propMultiSelect,
  propDate,
  propRelation,
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

type PropertyMutation = Partial<{
  name: string
  address: string
  householdAddress: string
  ownerIds: string[]
  status: PropertyStatus | null
  devLetter: boolean
  devProgress: string[]
  visitTodo: VisitTodo | null
  visitSynced: VisitTodo | null
  area: string
  mainBuilding: string
  layout: string
  parking: string[]
  price: string
  objectLetter: string
  householdLetter: string
  expiry: string | null
  important: string
  web: string
}>

function buildPropertyProps(body: PropertyMutation) {
  return compactProps({
    '名稱': propTitle(body.name),
    '物件地址': propRichText(body.address),
    '戶藉地址': propRichText(body.householdAddress),
    '屋主': propRelation(body.ownerIds),
    '狀態': propSelect(body.status),
    '開發信': propCheckbox(body.devLetter),
    '開發進度': propMultiSelect(body.devProgress),
    '待辦': propSelect(body.visitTodo),
    '已同步': propSelect(body.visitSynced),
    '坪數': propRichText(body.area),
    '主建物': propRichText(body.mainBuilding),
    '格局': propRichText(body.layout),
    '車位': propMultiSelect(body.parking),
    '開價': propRichText(body.price),
    '物信': propRichText(body.objectLetter),
    '戶信': propRichText(body.householdLetter),
    '委託到期日': propDate(body.expiry),
    '重要事項': propRichText(body.important),
    '網頁': propUrl(body.web),
  })
}

/**
 * POST /api/properties-v2  body=PropertyMutation（name 必填）
 */
export async function POST(request: NextRequest) {
  try {
    const dbId = process.env.NOTION_PROPERTY_DB_ID
    if (!dbId) {
      return NextResponse.json({ error: '未配置 NOTION_PROPERTY_DB_ID' }, { status: 400 })
    }
    const body = (await request.json()) as PropertyMutation
    if (!body.name) {
      return NextResponse.json({ error: 'name 必填' }, { status: 400 })
    }
    const page = await createNotionPage(dbId, buildPropertyProps(body))
    return NextResponse.json({ id: (page as any).id })
  } catch (err: any) {
    console.error('Failed to create property:', err)
    return NextResponse.json({ error: '無法建立物件', detail: err?.message }, { status: 500 })
  }
}

/**
 * PATCH /api/properties-v2  body={id, ...PropertyMutation}
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as PropertyMutation & { id?: string }
    if (!body.id) {
      return NextResponse.json({ error: 'id 必填' }, { status: 400 })
    }
    const { id, ...mutation } = body
    await updateNotionPage(id, buildPropertyProps(mutation))
    return NextResponse.json({ ok: true, id })
  } catch (err: any) {
    console.error('Failed to update property:', err)
    return NextResponse.json({ error: '無法更新物件', detail: err?.message }, { status: 500 })
  }
}
