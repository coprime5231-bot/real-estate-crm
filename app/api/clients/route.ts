import { NextRequest, NextResponse } from 'next/server'
import notion, { extractText, extractSelectValue, BuyerData } from '@/lib/notion'

// 從 Notion multi_select 屬性取出 name 陣列
function extractMultiSelect(prop: any): string[] {
  if (!prop?.multi_select) return []
  return prop.multi_select.map((o: any) => o.name).filter(Boolean)
}

// SLA 計算
type SLAStatus = 'normal' | 'warning' | 'frozen'
function getSLAStatus(grade: string | undefined, daysSinceEdit: number): SLAStatus {
  const g = grade?.charAt(0)?.toUpperCase()
  const th = g === 'A' ? { warn: 3, crit: 10 }
           : g === 'C' ? { warn: 10, crit: 30 }
           : { warn: 5, crit: 15 } // B 級或未分級都當 B

  if (daysSinceEdit > th.crit) return 'frozen'
  if (daysSinceEdit > th.warn) return 'warning'
  return 'normal'
}

function getDaysSinceEdit(lastEditedTime: string | undefined, createdTime: string | undefined): number {
  const ref = lastEditedTime || createdTime
  if (!ref) return 0
  const d = new Date(ref)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  const diff = Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
  return diff < 0 ? 0 : diff
}

// 從 Notion relation 屬性取出 id 陣列
function extractRelation(prop: any): string[] {
  if (!prop?.relation) return []
  return prop.relation.map((r: any) => r.id).filter(Boolean)
}

export async function POST(request: NextRequest) {
  try {
    const buyerDbId = process.env.NOTION_BUYER_DB_ID
    if (!buyerDbId) {
      return NextResponse.json({ error: '未配置買家資料庫ID' }, { status: 400 })
    }

    const body = await request.json()
    const name = (body.name || '').trim()
    if (!name) {
      return NextResponse.json({ error: '名稱不可為空' }, { status: 400 })
    }

    const page: any = await notion.pages.create({
      parent: { database_id: buyerDbId },
      properties: {
        '名稱': { title: [{ text: { content: name } }] },
      },
    })

    return NextResponse.json({
      id: page.id,
      name,
      notionUrl: page.url || `https://www.notion.so/${page.id.replace(/-/g, '')}`,
    })
  } catch (error: any) {
    console.error('Failed to create client:', error)
    return NextResponse.json({ error: '無法新增客戶', detail: error?.message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const buyerDbId = process.env.NOTION_BUYER_DB_ID

    if (!buyerDbId) {
      return NextResponse.json(
        { error: '未配置買家資料庫ID' },
        { status: 400 }
      )
    }

    const response = await notion.databases.query({
      database_id: buyerDbId,
    })

    const clients = response.results
      .filter((page: any) => page.object === 'page')
      .map((page: any) => {
        const p = page.properties

        // 兼容「客戶等級」與舊名「等級」
        const gradeProp = p['客戶等級'] || p['等級']
        const grade = (extractSelectValue(gradeProp?.select) || undefined) as BuyerData['grade']

        // 手機同時兼容 phone_number 與 rich_text
        const phoneRaw =
          p['手機']?.phone_number ||
          extractText(p['手機']?.rich_text || [])

        // 區域為 multi_select，join 成字串顯示
        const areaArr = extractMultiSelect(p['區域'])

        const nextFollowUp = p['日期']?.date?.start as string | undefined

        // SLA 計算
        const lastEditedTime = p['上次編輯時間']?.last_edited_time || (page as any).last_edited_time
        const createdTime = (page as any).created_time
        const daysSinceEdit = getDaysSinceEdit(lastEditedTime, createdTime)
        const slaStatus = getSLAStatus(grade, daysSinceEdit)

        return {
          id: page.id,
          name: p['名稱']?.title?.[0]?.plain_text || '未命名',
          phone: phoneRaw || undefined,
          note: extractText(p['NOTE']?.rich_text || []),
          progress: extractText(p['最近進展']?.rich_text || []),
          grade,
          budget: extractSelectValue(p['預算']?.select) || undefined,
          needs: extractText(p['需求']?.rich_text || []),
          area: areaArr.length ? areaArr.join('、') : undefined,
          nextFollowUp,
          needTags: extractMultiSelect(p['需求標籤']),
          todoIds: extractRelation(p['待辦事項']),
          // SLA 欄位
          slaStatus,
          daysSinceEdit,
          hasNextStep: !!nextFollowUp,
        }
      })

    return NextResponse.json(clients)
  } catch (error) {
    console.error('Failed to fetch clients:', error)
    return NextResponse.json(
      { error: '無法獲取客戶資料' },
      { status: 500 }
    )
  }
}
