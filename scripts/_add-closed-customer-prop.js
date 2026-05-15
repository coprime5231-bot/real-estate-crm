/**
 * 1. 開發 DB + 行銷(買方) DB 各加「成交客」select 屬性、option = [是]
 * 2. 開發 DB「狀態」select 移除「成交」option（現況 0 筆使用、零資料遺失）
 *
 * 用法（repo 根目錄）：
 *   dry-run：node --env-file=.env.local scripts/_add-closed-customer-prop.js
 *   真改：  node --env-file=.env.local scripts/_add-closed-customer-prop.js --apply
 */
const KEY = process.env.NOTION_API_KEY
const DEV = process.env.NOTION_DEV_DB_ID
const BUYER = process.env.NOTION_BUYER_DB_ID
const APPLY = process.argv.includes('--apply')
const H = { Authorization: `Bearer ${KEY}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' }

async function getDb(id) {
  const r = await fetch(`https://api.notion.com/v1/databases/${id}`, { headers: H })
  if (!r.ok) throw new Error(`GET ${id} ${r.status} ${await r.text()}`)
  return r.json()
}
async function patchDb(id, properties) {
  const r = await fetch(`https://api.notion.com/v1/databases/${id}`, {
    method: 'PATCH', headers: H, body: JSON.stringify({ properties }),
  })
  if (!r.ok) throw new Error(`PATCH ${id} ${r.status} ${await r.text()}`)
  return r.json()
}

async function main() {
  const dev = await getDb(DEV)
  const buyer = await getDb(BUYER)

  // 開發 DB 狀態現有 options（移除「成交」後重設）
  const devStatusOpts = (dev.properties['狀態']?.select?.options || [])
    .filter((o) => o.name !== '成交')
    .map((o) => ({ name: o.name, color: o.color }))

  const devPatch = {
    '成交客': { select: { options: [{ name: '是', color: 'green' }] } },
    '狀態': { select: { options: devStatusOpts } },
  }
  const buyerPatch = {
    '成交客': { select: { options: [{ name: '是', color: 'green' }] } },
  }

  console.log('=== 開發 DB ===')
  console.log('  + 成交客 select [是]', '成交客' in dev.properties ? '(已存在、會覆寫 options)' : '')
  console.log('  狀態 options 重設為:', devStatusOpts.map((o) => o.name).join(', '), '(移除「成交」)')
  console.log('=== 行銷 DB ===')
  console.log('  + 成交客 select [是]', '成交客' in buyer.properties ? '(已存在、會覆寫 options)' : '')

  if (!APPLY) {
    console.log('\n(dry-run、加 --apply 才真打)')
    return
  }

  const r1 = await patchDb(DEV, devPatch)
  console.log('\n開發 DB OK、狀態 options 現在:',
    (r1.properties['狀態']?.select?.options || []).map((o) => o.name).join(', '))
  console.log('開發 DB「成交客」:', r1.properties['成交客'] ? 'OK' : 'FAIL')

  const r2 = await patchDb(BUYER, buyerPatch)
  console.log('行銷 DB「成交客」:', r2.properties['成交客'] ? 'OK' : 'FAIL')
}

main().catch((e) => { console.error(e); process.exit(1) })
