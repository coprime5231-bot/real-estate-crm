import { NextRequest, NextResponse } from 'next/server'
import notion, { extractText, extractSelectValue, BuyerData } from '@/lib/notion'

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

    const clients: BuyerData[] = response.results
      .filter((page: any) => page.object === 'page')
      .map((page: any) => {
        const properties = page.properties

        // 兼容「客戶等級」與舊名「等級」
        const gradeProp = properties['客戶等級'] || properties['等級']

        return {
          id: page.id,
          name: properties['名稱']?.title?.[0]?.plain_text || '未命名',
          phone: extractText(properties['手機']?.phone_number || []) || extractText(properties['手機']?.rich_text || []),
          note: extractText(properties['NOTE']?.rich_text || []),
          progress: extractText(properties['最近進展']?.rich_text || []),
          grade: (extractSelectValue(gradeProp?.select) || undefined) as BuyerData['grade'],
          source: extractSelectValue(properties['來源']?.select),
          budget: extractText(properties['預算']?.rich_text || []),
          needs: extractText(properties['需求']?.rich_text || []),
          area: extractText(properties['區域']?.rich_text || []),
          nextFollowUp: properties['下次跟進']?.date?.start,
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
