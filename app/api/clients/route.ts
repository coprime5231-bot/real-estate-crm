import { NextRequest, NextResponse } from 'next/server'
import notion, { extractText, extractSelectValue, BuyerData } from '@/lib/notion'

// 從 Notion multi_select 屬性取出 name 陣列
function extractMultiSelect(prop: any): string[] {
  if (!prop?.multi_select) return []
  return prop.multi_select.map((o: any) => o.name).filter(Boolean)
}

// 從 Notion relation 屬性取出 id 陣列
function extractRelation(prop: any): string[] {
  if (!prop?.relation) return []
  return prop.relation.map((r: any) => r.id).filter(Boolean)
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

        // 手機同時兼容 phone_number 與 rich_text
        const phoneRaw =
          p['手機']?.phone_number ||
          extractText(p['手機']?.rich_text || [])

        // 區域為 multi_select，join 成字串顯示
        const areaArr = extractMultiSelect(p['區域'])

        return {
          id: page.id,
          name: p['名稱']?.title?.[0]?.plain_text || '未命名',
          phone: phoneRaw || undefined,
          note: extractText(p['NOTE']?.rich_text || []),
          progress: extractText(p['最近進展']?.rich_text || []),
          grade: (extractSelectValue(gradeProp?.select) || undefined) as BuyerData['grade'],
          budget: extractSelectValue(p['預算']?.select) || undefined,
          needs: extractText(p['需求']?.rich_text || []),
          area: areaArr.length ? areaArr.join('、') : undefined,
          // 「下次跟進」= Notion「日期」欄位
          nextFollowUp: p['日期']?.date?.start,
          // 需求標籤（multi_select）→ 篩選按鈕用
          needTags: extractMultiSelect(p['需求標籤']),
          // 待辦事項 relation → 顯示關聯 id（後續抓標題用）
          todoIds: extractRelation(p['待辦事項']),
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
