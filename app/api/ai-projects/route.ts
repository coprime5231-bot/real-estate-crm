import { NextRequest, NextResponse } from 'next/server'
import notion, { extractText, AIProjectData } from '@/lib/notion'

export async function GET(request: NextRequest) {
  try {
    const aiIdeasDbId = process.env.NOTION_AI_IDEAS_DB_ID

    if (!aiIdeasDbId) {
      return NextResponse.json(
        { error: '未配置AI想法資料庫ID' },
        { status: 400 }
      )
    }

    const response = await notion.databases.query({
      database_id: aiIdeasDbId,
    })

    const projects: AIProjectData[] = response.results
      .filter((page: any) => page.object === 'page')
      .map((page: any) => {
        const properties = page.properties
        const status = properties['狀態']?.select?.name || 'idea'
        const platforms = properties['平台']?.multi_select?.map((p: any) => p.name) || []

        return {
          id: page.id,
          title: properties['名稱']?.title?.[0]?.plain_text || '未命名',
          status: status as 'idea' | 'building' | 'done',
          platforms,
        }
      })

    return NextResponse.json(projects)
  } catch (error) {
    console.error('Failed to fetch AI projects:', error)
    return NextResponse.json(
      { error: '無法獲取AI專案資料' },
      { status: 500 }
    )
  }
}
