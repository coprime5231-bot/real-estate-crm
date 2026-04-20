import { NextRequest, NextResponse } from 'next/server'
import notion, { extractText, TodoData } from '@/lib/notion'

export async function GET(request: NextRequest) {
  try {
    const todoDbId = process.env.NOTION_TODO_DB_ID

    if (!todoDbId) {
      return NextResponse.json(
        { error: '未配置任務資料庫ID' },
        { status: 400 }
      )
    }

    const params = request.nextUrl.searchParams
    const clientId = params.get('clientId')

    const query: any = {
      database_id: todoDbId,
    }

    if (clientId) {
      query.filter = {
        property: '客戶',
        relation: {
          contains: clientId,
        },
      }
    }

    const response = await notion.databases.query(query)

    const todos: TodoData[] = response.results
      .filter((page: any) => page.object === 'page')
      .map((page: any) => {
        const properties = page.properties

        return {
          id: page.id,
          title: properties['名稱']?.title?.[0]?.plain_text || '未命名',
          completed: !(properties['待辦']?.checkbox ?? true),
          buyerId: properties['客戶']?.relation?.[0]?.id,
        }
      })

    return NextResponse.json(todos)
  } catch (error) {
    console.error('Failed to fetch todos:', error)
    return NextResponse.json(
      { error: '無法獲取任務資料' },
      { status: 500 }
    )
  }
}
