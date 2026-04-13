import { NextRequest, NextResponse } from 'next/server'
import notion, { extractText, PropertyData } from '@/lib/notion'

export async function GET(request: NextRequest) {
  try {
    const trackingDbId = process.env.NOTION_TRACKING_DB_ID

    if (!trackingDbId) {
      return NextResponse.json(
        { error: '未配置追蹤資料庫ID' },
        { status: 400 }
      )
    }

    const response = await notion.databases.query({
      database_id: trackingDbId,
    })

    const properties: PropertyData[] = response.results
      .filter((page: any) => page.object === 'page')
      .map((page: any) => {
        const properties = page.properties

        return {
          id: page.id,
          title: properties['名稱']?.title?.[0]?.plain_text || '未命名',
          address: extractText(properties['地址']?.rich_text || []),
          price: extractText(properties['價格']?.rich_text || []),
          status: properties['狀態']?.select?.name || '',
        }
      })

    return NextResponse.json(properties)
  } catch (error) {
    console.error('Failed to fetch properties:', error)
    return NextResponse.json(
      { error: '無法獲取物件資料' },
      { status: 500 }
    )
  }
}
