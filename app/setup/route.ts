import { NextRequest, NextResponse } from 'next/server'
import notion from '@/lib/notion'

export async function GET(request: NextRequest) {
  try {
    const mainPageId = process.env.NOTION_MAIN_PAGE_ID

    if (!mainPageId) {
      return NextResponse.json(
        {
          error: '未設置主頁面ID',
          configured: false,
          missingIds: [
            'NOTION_MAIN_PAGE_ID',
            'NOTION_BUYER_DB_ID',
            'NOTION_TODO_DB_ID',
            'NOTION_TRACKING_DB_ID',
            'NOTION_WEEKLY_DB_ID',
            'NOTION_STRATEGY_DB_ID',
            'NOTION_AI_IDEAS_DB_ID',
          ],
        },
        { status: 400 }
      )
    }

    const databases: Record<string, string> = {}
    const missingIds: string[] = []

    try {
      const childBlocks = await notion.blocks.children.list({
        block_id: mainPageId,
        page_size: 100,
      })

      for (const block of childBlocks.results) {
        if ('type' in block) {
          const blockType = block.type as string
          if (blockType === 'child_database' || blockType === 'database') {
            const dbTitle =
              ('child_database' in block &&
                (block as any).child_database?.title) ||
              ''
            const dbName = typeof dbTitle === 'string' ? dbTitle : ''

            if (dbName.includes('買方'))
              databases['NOTION_BUYER_DB_ID'] = block.id
            if (dbName.includes('待辦') || dbName.includes('事項'))
              databases['NOTION_TODO_DB_ID'] = block.id
            if (dbName.includes('追蹤') || dbName.includes('委託'))
              databases['NOTION_TRACKING_DB_ID'] = block.id
            if (dbName.includes('目標'))
              databases['NOTION_GOAL_DB_ID'] = block.id
            if (
              dbName.includes('ai') ||
              dbName.includes('AI') ||
              dbName.includes('想法')
            )
              databases['NOTION_AI_IDEAS_DB_ID'] = block.id
          }
        }
      }

      // Also search linked databases via Notion search API
      try {
        const searchResp = await notion.search({
          filter: { property: 'object', value: 'database' },
          page_size: 20,
        })

        for (const db of searchResp.results) {
          if ('title' in db && db.title) {
            const title = (db as any).title
              .map((t: any) => t.plain_text)
              .join('')

            if (title.includes('買方') && !databases['NOTION_BUYER_DB_ID'])
              databases['NOTION_BUYER_DB_ID'] = db.id
            if (
              (title.includes('待辦') || title.includes('事項')) &&
              !databases['NOTION_TODO_DB_ID']
            )
              databases['NOTION_TODO_DB_ID'] = db.id
            if (
              (title.includes('追蹤') || title.includes('委託')) &&
              !databases['NOTION_TRACKING_DB_ID']
            )
              databases['NOTION_TRACKING_DB_ID'] = db.id
            if (title.includes('Weekly') && !databases['NOTION_WEEKLY_DB_ID'])
              databases['NOTION_WEEKLY_DB_ID'] = db.id
            if (title.includes('策略') && !databases['NOTION_STRATEGY_DB_ID'])
              databases['NOTION_STRATEGY_DB_ID'] = db.id
            if (
              (title.includes('ai') ||
                title.includes('AI') ||
                title.includes('想法')) &&
              !databases['NOTION_AI_IDEAS_DB_ID']
            )
              databases['NOTION_AI_IDEAS_DB_ID'] = db.id
            if (title.includes('目標') && !databases['NOTION_GOAL_DB_ID'])
              databases['NOTION_GOAL_DB_ID'] = db.id
          }
        }
      } catch (e) {
        console.error('Search API fallback failed:', e)
      }
    } catch (error) {
      console.error('Failed to scan child blocks:', error)
    }

    const required = [
      'NOTION_BUYER_DB_ID',
      'NOTION_TODO_DB_ID',
      'NOTION_TRACKING_DB_ID',
      'NOTION_WEEKLY_DB_ID',
      'NOTION_STRATEGY_DB_ID',
      'NOTION_AI_IDEAS_DB_ID',
    ]

    for (const id of required) {
      if (!process.env[id] && !databases[id]) {
        missingIds.push(id)
      }
    }

    const configured =
      !!process.env.NOTION_BUYER_DB_ID &&
      !!process.env.NOTION_TODO_DB_ID &&
      !!process.env.NOTION_TRACKING_DB_ID &&
      !!process.env.NOTION_WEEKLY_DB_ID &&
      !!process.env.NOTION_STRATEGY_DB_ID &&
      !!process.env.NOTION_AI_IDEAS_DB_ID

    return NextResponse.json({
      configured,
      missingIds,
      discoveredDatabases: databases,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Setup check failed:', error)
    return NextResponse.json(
      { error: '無法檢查設置狀態' },
      { status: 500 }
    )
  }
}
