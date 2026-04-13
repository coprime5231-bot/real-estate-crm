import { NextRequest, NextResponse } from 'next/server'
import notion, { extractText, VideoData } from '@/lib/notion'

export async function GET(request: NextRequest) {
  try {
    const strategyDbId = process.env.NOTION_STRATEGY_DB_ID

    if (!strategyDbId) {
      return NextResponse.json(
        { error: '未配置策略資料庫ID' },
        { status: 400 }
      )
    }

    const response = await notion.databases.query({
      database_id: strategyDbId,
    })

    const videos: VideoData[] = response.results
      .filter((page: any) => page.object === 'page')
      .map((page: any) => {
        const properties = page.properties
        const status = properties['狀態']?.select?.name || 'planning'

        return {
          id: page.id,
          title: properties['名稱']?.title?.[0]?.plain_text || '未命名',
          status: status as 'planning' | 'filming' | 'published',
          viewCount: properties['瀏覽次數']?.number || 0,
        }
      })

    return NextResponse.json(videos)
  } catch (error) {
    console.error('Failed to fetch videos:', error)
    return NextResponse.json(
      { error: '無法獲取影片資料' },
      { status: 500 }
    )
  }
}
