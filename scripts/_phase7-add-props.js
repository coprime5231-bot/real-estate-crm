/**
 * Phase 7.B: 把 lifecycle 欄位加到 30156ff9 (新募極限)、加成交日期到 28e56ff9 (買方)
 *
 * 用法：NOTION_API_KEY=ntn_xxx node scripts/_phase7-add-props.js [--apply]
 * 預設 dry-run、印 PATCH 內容；--apply 才真打 Notion API
 */
const NOTION_API_KEY = process.env.NOTION_API_KEY;
if (!NOTION_API_KEY) { console.error('NOTION_API_KEY required'); process.exit(1); }
const APPLY = process.argv.includes('--apply');

const NOTION_HEADERS = {
  Authorization: `Bearer ${NOTION_API_KEY}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
};

const NEW_PROPS_30156 = {
  '狀態': {
    select: {
      options: [
        { name: '募集', color: 'gray' },
        { name: '追蹤', color: 'yellow' },
        { name: '委託', color: 'green' },
        { name: '成交', color: 'blue' },
        { name: '過期', color: 'red' },
      ],
    },
  },
  '成交日期': { date: {} },
  '委託到期日': { date: {} },
  '重要事項': { rich_text: {} },
  '物件地址': { rich_text: {} },
  '網頁': { url: {} },
  '手機': { phone_number: {} },
  '客戶等級': {
    select: {
      options: [
        { name: 'A級', color: 'red' },
        { name: 'B級', color: 'yellow' },
        { name: 'C級', color: 'gray' },
      ],
    },
  },
  '身份證字號': { rich_text: {} },
  '委託': { files: {} },
  '謄本': { files: {} },
  '待辦事項': {
    relation: {
      database_id: '32056ff9-a859-809e-b5cc-ebc2933d9213',
      type: 'single_property',
      single_property: {},
    },
  },
  '本周重要大事': {
    relation: {
      database_id: '32156ff9-a859-80d6-aab6-d46ab52937fa',
      type: 'single_property',
      single_property: {},
    },
  },
};

const NEW_PROPS_28e56 = {
  '成交日期': { date: {} },
};

const TASKS = [
  { id: '30156ff9-a859-8087-a9f8-fb20ab3d7c06', name: '新募極限 (將改名「開發」)', props: NEW_PROPS_30156 },
  { id: '28e56ff9-a859-80bd-bf1e-c0041c39e10a', name: '買方 (將改名「行銷」)', props: NEW_PROPS_28e56 },
];

async function patchDb(id, properties) {
  const r = await fetch(`https://api.notion.com/v1/databases/${id}`, {
    method: 'PATCH',
    headers: NOTION_HEADERS,
    body: JSON.stringify({ properties }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`PATCH ${id} ${r.status} ${t}`);
  }
  return r.json();
}

async function main() {
  for (const t of TASKS) {
    console.log(`\n=== ${t.name} (${t.id}) ===`);
    console.log('Adding props:');
    for (const [k, v] of Object.entries(t.props)) {
      console.log('  +', k, '=>', JSON.stringify(v).slice(0, 100));
    }
    if (!APPLY) {
      console.log('(dry-run、加 --apply 才真打)');
      continue;
    }
    const res = await patchDb(t.id, t.props);
    console.log('OK、', Object.keys(res.properties).length, 'props total in DB');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
