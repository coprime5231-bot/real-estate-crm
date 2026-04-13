import { NextRequest, NextResponse } from 'next/server'
import notion, { extractText, WeeklyData } from '@/lib/notion'

export async function GET(request: NextRequest) {
  try {
    const weeklyDbId = process.env.NOTION_WEEKLY_DB_ID

    if (!weeklyDbId) {
      return NextResponse.json(
        { error: '未配置週報資料庫ID' },
        { status: 400 }
      )
    }

    const response = await notion.databases.query({
      database_id: weeklyDbId,
      sorts: [
        {
          property: '日期',
          direction: 'descending',
        },
      ],
    })

    const weekly: WeeklyData[] = response.results
      .filter((page: any) => page.object === 'page')
      .map((page: any) => {
        const properties = page.properties

        return {
          id: page.id,
          week: properties['日期']?.date?.start || '',
          showing: parseInt(properties['看房次數']?.number || '0'),
          progress: extractText(properties['進展摘要']?.rich_text || []),
        }
      })

    return NextResponse.json(weekly)
  } catch (error) {
    console.error('Failed to fetch weekly data:', error)
    return NextResponse.json(
      { error: '無法獲取週報資料' },
      { status: 500 }
    )
  }
}
