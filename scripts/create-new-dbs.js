/**
 * Phase 1a: 在 Notion 主頁底下建立 3 個新 DB（人物 / 物件 / 買方需求）。
 *
 * Usage:
 *   $env:NOTION_API_KEY = "ntn_..."
 *   node scripts/create-new-dbs.js
 *
 * 產出：outputs/new-dbs.json（含三個 DB 的 id + url、後續 migration 要用）
 *
 * 設計脈絡：2026-05-12 schema 重構、把現有
 *   - 買方 (28e56ff9-a859-80bd-bf1e-c0041c39e10a)
 *   - 追蹤與委託 (28d56ff9-a859-8093-8483-d68f63e1565a)
 *   - 新募極限 (30156ff9-a859-8087-a9f8-fb20ab3d7c06)
 * 重組為人物 + 物件 + 買方需求 三層結構。
 */

const { Client } = require('@notionhq/client')
const fs = require('fs')
const path = require('path')

const TOKEN = process.env.NOTION_API_KEY
if (!TOKEN) {
  console.error('Set NOTION_API_KEY env var first.')
  process.exit(1)
}

const notion = new Client({ auth: TOKEN })

const MAIN_PAGE_ID = '32156ff9-a859-8091-916e-d853c177fa0f' // 千萬經紀人之路！
const TODO_DB_ID = '32056ff9-a859-809e-b5cc-ebc2933d9213' // 待辦事項
const IMPORTANT_DB_ID = '32156ff9-a859-80d6-aab6-d46ab52937fa' // 本周重要大事

const ZONE_OPTIONS = ['苓雅', '仁武', '楠梓', '左營', '三民', '鼓山', '鳳山', '新興'].map(n => ({ name: n }))

const VISIT_TODO_OPTIONS = ['物件地拜訪', '戶藉地拜訪', '物件地覆訪', '戶藉地覆訪'].map(n => ({ name: n }))

async function createPeopleDb() {
  console.log('Creating 人物 DB...')
  const res = await notion.databases.create({
    parent: { type: 'page_id', page_id: MAIN_PAGE_ID },
    icon: { type: 'emoji', emoji: '👤' },
    title: [{ type: 'text', text: { content: '人物' } }],
    description: [{ type: 'text', text: { content: '所有聯絡人單一來源（買方 / 屋主 / 潛在屋主 / 成交客戶可同時掛）' } }],
    properties: {
      名稱: { title: {} },
      手機: { phone_number: {} },
      身份證字號: { rich_text: {} },
      生日: { date: {} },
      角色: {
        multi_select: {
          options: [
            { name: '買方', color: 'blue' },
            { name: '屋主', color: 'green' },
            { name: '潛在屋主', color: 'orange' },
            { name: '成交客戶', color: 'purple' },
          ],
        },
      },
      客戶等級: {
        select: {
          options: [
            { name: 'A級', color: 'red' },
            { name: 'B級', color: 'yellow' },
            { name: 'C級', color: 'gray' },
            { name: 'D級', color: 'default' },
            { name: '未接', color: 'default' },
          ],
        },
      },
      區域偏好: { multi_select: { options: ZONE_OPTIONS } },
      來源: { select: { options: [] } }, // 留空待搬遷時自動填
      NOTE: { rich_text: {} },
      最近進展: { rich_text: {} },
      下次跟進: { date: {} },
      負責人: { people: {} },
      重要大事: { relation: { database_id: IMPORTANT_DB_ID, type: 'single_property', single_property: {} } },
      待辦事項: { relation: { database_id: TODO_DB_ID, type: 'single_property', single_property: {} } },
    },
  })
  console.log('  ✓ 人物 DB created:', res.id)
  console.log('    URL:', res.url)
  return res
}

async function createPropertyDb(peopleDbId) {
  console.log('Creating 物件 DB...')
  const res = await notion.databases.create({
    parent: { type: 'page_id', page_id: MAIN_PAGE_ID },
    icon: { type: 'emoji', emoji: '🏠' },
    title: [{ type: 'text', text: { content: '物件' } }],
    description: [{ type: 'text', text: { content: '所有物件（開發信 / 追蹤 / 委託 / 過期 / 成交 五 stage）— 合併原追蹤與委託 + 新募極限' } }],
    properties: {
      名稱: { title: {} },
      物件地址: { rich_text: {} },
      戶藉地址: { rich_text: {} },
      屋主: { relation: { database_id: peopleDbId, type: 'single_property', single_property: {} } },
      狀態: {
        select: {
          options: [
            { name: '開發信', color: 'gray' },
            { name: '追蹤', color: 'orange' },
            { name: '委託', color: 'green' },
            { name: '過期', color: 'red' },
            { name: '成交', color: 'purple' },
          ],
        },
      },
      開發信: { checkbox: {} },
      開發進度: {
        multi_select: {
          options: [
            { name: '未訪' },
            { name: '不在物件地' },
            { name: '不住物件地' },
            { name: '不在戶藉地' },
            { name: '不住戶藉地' },
            { name: '專約' },
          ],
        },
      },
      待辦: { select: { options: VISIT_TODO_OPTIONS } }, // MBA + n8n 用
      已同步: { select: { options: VISIT_TODO_OPTIONS } }, // n8n 自動同步
      坪數: { rich_text: {} },
      主建物: { rich_text: {} },
      格局: { rich_text: {} },
      車位: {
        multi_select: {
          options: [
            { name: '平面車位' },
            { name: '機上' },
            { name: '機下' },
            { name: '平移' },
            { name: '無車位' },
          ],
        },
      },
      開價: { rich_text: {} },
      物信: { rich_text: {} },
      戶信: { rich_text: {} },
      謄本: { files: {} },
      委託書: { files: {} },
      委託到期日: { date: {} },
      重要事項: { rich_text: {} },
      網頁: { url: {} },
      待辦事項: { relation: { database_id: TODO_DB_ID, type: 'single_property', single_property: {} } },
      本周重要大事: { relation: { database_id: IMPORTANT_DB_ID, type: 'single_property', single_property: {} } },
    },
  })
  console.log('  ✓ 物件 DB created:', res.id)
  console.log('    URL:', res.url)
  return res
}

async function createBuyerNeedDb(peopleDbId, propertyDbId) {
  console.log('Creating 買方需求 DB...')
  const res = await notion.databases.create({
    parent: { type: 'page_id', page_id: MAIN_PAGE_ID },
    icon: { type: 'emoji', emoji: '🎯' },
    title: [{ type: 'text', text: { content: '買方需求' } }],
    description: [{ type: 'text', text: { content: '買方需求單（一個客戶可能多筆需求）— 從原買方 DB 改造、人物部分抽出去 [[人物]]' } }],
    properties: {
      名稱: { title: {} }, // 例：陳先生-農16三房
      客戶: { relation: { database_id: peopleDbId, type: 'single_property', single_property: {} } },
      狀態: {
        select: {
          options: [
            { name: '配案中', color: 'green' },
            { name: '已成交', color: 'purple' },
            { name: '暫停', color: 'gray' },
            { name: '放棄', color: 'default' },
          ],
        },
      },
      預算: {
        select: {
          options: [
            { name: '4000+', color: 'red' },
            { name: '3000~4000', color: 'orange' },
            { name: '2001~3000', color: 'yellow' },
            { name: '2000以下', color: 'blue' },
            { name: '3000', color: 'gray' }, // 保留現有「3000」option 兼容
          ],
        },
      },
      區域: { multi_select: { options: ZONE_OPTIONS } },
      格局: {
        multi_select: {
          options: [
            { name: '四房以上' },
            { name: '四房' },
            { name: '三房' },
            { name: '二房' },
          ],
        },
      },
      需求標籤: { multi_select: { options: [] } }, // 搬遷時從舊 DB 動態繼承
      需求: { rich_text: {} },
      NOTE: { rich_text: {} },
      最近進展: { rich_text: {} },
      配上的物件: { relation: { database_id: propertyDbId, type: 'single_property', single_property: {} } },
      帶看過的物件: { relation: { database_id: propertyDbId, type: 'single_property', single_property: {} } },
      檔案: { files: {} },
      重要大事: { relation: { database_id: IMPORTANT_DB_ID, type: 'single_property', single_property: {} } },
      待辦事項: { relation: { database_id: TODO_DB_ID, type: 'single_property', single_property: {} } },
    },
  })
  console.log('  ✓ 買方需求 DB created:', res.id)
  console.log('    URL:', res.url)
  return res
}

async function main() {
  const outputs = {
    created_at: new Date().toISOString(),
    main_page_id: MAIN_PAGE_ID,
    dbs: {},
  }

  try {
    const peopleRes = await createPeopleDb()
    outputs.dbs.people = { id: peopleRes.id, url: peopleRes.url, title: '人物' }

    const propertyRes = await createPropertyDb(peopleRes.id)
    outputs.dbs.property = { id: propertyRes.id, url: propertyRes.url, title: '物件' }

    const needRes = await createBuyerNeedDb(peopleRes.id, propertyRes.id)
    outputs.dbs.buyer_need = { id: needRes.id, url: needRes.url, title: '買方需求' }

    const outDir = path.join(__dirname, '..', 'outputs')
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
    const outPath = path.join(outDir, 'new-dbs.json')
    fs.writeFileSync(outPath, JSON.stringify(outputs, null, 2), 'utf8')
    console.log('\nSaved:', outPath)

    console.log('\n=== Summary ===')
    for (const [k, v] of Object.entries(outputs.dbs)) {
      console.log(`  ${k}:  ${v.id}  ${v.title}`)
    }
  } catch (err) {
    console.error('\nERROR:', err.message)
    if (err.body) console.error('  body:', JSON.stringify(err.body))
    process.exit(1)
  }
}

main()
