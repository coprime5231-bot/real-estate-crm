import { NextRequest, NextResponse } from 'next/server'
import notion, {
  extractText,
  extractSelectValue,
  extractMultiSelectNames,
  queryDatabaseAll,
} from '@/lib/notion'

export const dynamic = 'force-dynamic'

export type DevStatus = '募集' | '追蹤' | '委託' | '成交' | '過期'
export type VisitTodo = '物件地拜訪' | '戶藉地拜訪' | '物件地覆訪' | '戶藉地覆訪'

export interface DevPropertyData {
  id: string
  name: string
  owner?: string
  address?: string
  householdAddress?: string
  status?: DevStatus
  closingDate?: string | null
  expiry?: string | null
  important?: string
  web?: string
  ownerPhone?: string
  ownerGrade?: string
  ownerIdNumber?: string
  area?: string
  mainBuilding?: string
  layout?: string
  parking: string[]
  price?: string
  objectLetter?: string
  householdLetter?: string
  devLetter?: boolean
  devProgress: string[]
  visitTodo?: VisitTodo
  visitSynced?: VisitTodo
  nextVisitAt?: string | null
  calendarEventId?: string
}

const ACTIVE_STATUSES: DevStatus[] = ['募集', '追蹤', '委託']

function mapPage(p: any): DevPropertyData {
  const props = p.properties
  return {
    id: p.id,
    name: props['名稱']?.title?.[0]?.plain_text || '(未命名)',
    owner: extractText(props['屋主']?.rich_text || []) || undefined,
    address: extractText(props['物件地址']?.rich_text || []) || undefined,
    householdAddress: extractText(props['戶藉地址']?.rich_text || []) || undefined,
    status: (extractSelectValue(props['狀態']?.select) || undefined) as DevStatus | undefined,
    closingDate: props['成交日期']?.date?.start ?? null,
    expiry: props['委託到期日']?.date?.start ?? null,
    important: extractText(props['重要事項']?.rich_text || []) || undefined,
    web: props['網頁']?.url || undefined,
    ownerPhone: props['手機']?.phone_number || undefined,
    ownerGrade: extractSelectValue(props['客戶等級']?.select) || undefined,
    ownerIdNumber: extractText(props['身份證字號']?.rich_text || []) || undefined,
    area: extractText(props['坪數']?.rich_text || []) || undefined,
    mainBuilding: extractText(props['主建物']?.rich_text || []) || undefined,
    layout: extractText(props['格局']?.rich_text || []) || undefined,
    parking: extractMultiSelectNames(props['車位']),
    price: extractText(props['開價']?.rich_text || []) || undefined,
    objectLetter: extractText(props['物信']?.rich_text || []) || undefined,
    householdLetter: extractText(props['戶信']?.rich_text || []) || undefined,
    devLetter: props['開發信']?.checkbox === true,
    devProgress: extractMultiSelectNames(props['開發進度']),
    visitTodo: (extractSelectValue(props['待辦']?.select) || undefined) as VisitTodo | undefined,
    visitSynced: (extractSelectValue(props['已同步']?.select) || undefined) as VisitTodo | undefined,
    nextVisitAt: props['下次拜訪時間']?.date?.start ?? null,
    calendarEventId: extractText(props['行事曆ID']?.rich_text || []) || undefined,
  }
}

/**
 * GET /api/dev
 *   ?status=募集 | 追蹤 | 委託 | 成交 | 過期   (可 comma-separated 多選)
 *   ?activeOnly=1                              (sugar: status=募集,追蹤,委託 且 成交日期 IS EMPTY)
 *
 * 讀 NOTION_DEV_DB_ID (30156ff9 開發、原新募極限 + 追蹤與委託 合併後)
 */
export async function GET(request: NextRequest) {
  try {
    const dbId = process.env.NOTION_DEV_DB_ID
    if (!dbId) {
      return NextResponse.json({ error: '未配置 NOTION_DEV_DB_ID' }, { status: 400 })
    }

    const sp = request.nextUrl.searchParams
    const statusParam = sp.get('status')
    const activeOnly = sp.get('activeOnly') === '1'

    let statuses: string[] = []
    if (statusParam) statuses = statusParam.split(',').map((s) => s.trim()).filter(Boolean)
    else if (activeOnly) statuses = ACTIVE_STATUSES

    const conditions: any[] = []
    if (statuses.length) {
      conditions.push({ or: statuses.map((s) => ({ property: '狀態', select: { equals: s } })) })
    }
    if (activeOnly) {
      conditions.push({ property: '成交日期', date: { is_empty: true } })
    }
    const filter = conditions.length === 0
      ? undefined
      : conditions.length === 1 ? conditions[0] : { and: conditions }

    const pages = await queryDatabaseAll(dbId, filter)
    const data = pages
      .filter((p: any) => p.object === 'page')
      .map(mapPage)
    return NextResponse.json(data)
  } catch (err: any) {
    console.error('GET /api/dev failed:', err?.message || err)
    return NextResponse.json({ error: '無法獲取開發資料', detail: err?.message }, { status: 500 })
  }
}

/**
 * PATCH /api/dev  body={ id, status?, devLetter?, closingDate?, expiry?, important?, devProgress? }
 */
type DevMutation = Partial<{
  status: DevStatus | null
  devLetter: boolean
  closingDate: string | null
  expiry: string | null
  important: string
  devProgress: string[]
  ownerPhone: string | null
  owner: string
  address: string
  price: string
  ownerGrade: string | null
  visitTodo: VisitTodo | null
  nextVisitAt: string | null
  calendarEventId: string | null
}>

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as DevMutation & { id?: string }
    if (!body.id) {
      return NextResponse.json({ error: 'id 必填' }, { status: 400 })
    }
    const props: any = {}
    if (body.status !== undefined) {
      props['狀態'] = body.status ? { select: { name: body.status } } : { select: null }
    }
    if (body.devLetter !== undefined) {
      props['開發信'] = { checkbox: !!body.devLetter }
    }
    if (body.closingDate !== undefined) {
      props['成交日期'] = body.closingDate ? { date: { start: body.closingDate } } : { date: null }
    }
    if (body.expiry !== undefined) {
      props['委託到期日'] = body.expiry ? { date: { start: body.expiry } } : { date: null }
    }
    if (body.important !== undefined) {
      props['重要事項'] = { rich_text: body.important ? [{ text: { content: body.important } }] : [] }
    }
    if (body.devProgress !== undefined) {
      props['開發進度'] = { multi_select: (body.devProgress || []).map((n) => ({ name: n })) }
    }
    if (body.ownerPhone !== undefined) {
      props['手機'] = { phone_number: body.ownerPhone || null }
    }
    if (body.owner !== undefined) {
      props['屋主'] = { rich_text: body.owner ? [{ text: { content: body.owner } }] : [] }
    }
    if (body.address !== undefined) {
      props['物件地址'] = { rich_text: body.address ? [{ text: { content: body.address } }] : [] }
    }
    if (body.price !== undefined) {
      props['開價'] = { rich_text: body.price ? [{ text: { content: body.price } }] : [] }
    }
    if (body.ownerGrade !== undefined) {
      props['客戶等級'] = body.ownerGrade ? { select: { name: body.ownerGrade } } : { select: null }
    }
    if (body.visitTodo !== undefined) {
      props['待辦'] = body.visitTodo ? { select: { name: body.visitTodo } } : { select: null }
    }
    if (body.nextVisitAt !== undefined) {
      props['下次拜訪時間'] = body.nextVisitAt ? { date: { start: body.nextVisitAt } } : { date: null }
    }
    if (body.calendarEventId !== undefined) {
      props['行事曆ID'] = { rich_text: body.calendarEventId ? [{ text: { content: body.calendarEventId } }] : [] }
    }
    await notion.pages.update({ page_id: body.id, properties: props })
    return NextResponse.json({ ok: true, id: body.id })
  } catch (err: any) {
    console.error('PATCH /api/dev failed:', err?.message || err)
    return NextResponse.json({ error: '無法更新開發資料', detail: err?.message }, { status: 500 })
  }
}
