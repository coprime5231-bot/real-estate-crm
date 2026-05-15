/**
 * 勘查：開發 DB + 行銷(買方) DB 的 schema、開發 DB 狀態=成交 筆數
 * 用法：node --env-file=.env.local scripts/_inspect-closed.js
 */
const KEY = process.env.NOTION_API_KEY
const DEV = process.env.NOTION_DEV_DB_ID
const BUYER = process.env.NOTION_BUYER_DB_ID
const H = { Authorization: `Bearer ${KEY}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' }

async function getDb(id) {
  const r = await fetch(`https://api.notion.com/v1/databases/${id}`, { headers: H })
  if (!r.ok) throw new Error(`GET db ${id} ${r.status} ${await r.text()}`)
  return r.json()
}

async function countByStatus(id, statusName) {
  let count = 0, cursor
  do {
    const r = await fetch(`https://api.notion.com/v1/databases/${id}/query`, {
      method: 'POST', headers: H,
      body: JSON.stringify({
        page_size: 100, start_cursor: cursor,
        filter: { property: '狀態', select: { equals: statusName } },
      }),
    })
    if (!r.ok) throw new Error(`query ${id} ${r.status} ${await r.text()}`)
    const j = await r.json()
    count += j.results.length
    cursor = j.has_more ? j.next_cursor : undefined
  } while (cursor)
  return count
}

async function main() {
  for (const [label, id] of [['開發', DEV], ['行銷(買方)', BUYER]]) {
    const db = await getDb(id)
    const title = db.title?.[0]?.plain_text || '(無標題)'
    console.log(`\n=== ${label} DB「${title}」(${id}) ===`)
    const props = db.properties
    console.log('屬性清單:')
    for (const [name, p] of Object.entries(props)) {
      let extra = ''
      if (p.type === 'select') extra = ' options=[' + (p.select.options || []).map(o => o.name).join(', ') + ']'
      console.log(`  - ${name} (${p.type})${extra}`)
    }
    console.log('  「成交客」存在?', '成交客' in props ? 'YES' : 'NO')
  }

  // 開發 DB 狀態=成交 筆數
  const n = await countByStatus(DEV, '成交')
  console.log(`\n開發 DB 目前「狀態=成交」筆數: ${n}`)
}

main().catch(e => { console.error(e); process.exit(1) })
