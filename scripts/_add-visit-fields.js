/**
 * 開發信頁面拜訪功能：在「開發」DB (NOTION_DEV_DB_ID) 加兩個欄位
 *   - 下次拜訪時間 (date)         → TS: nextVisitAt
 *   - 行事曆ID    (rich_text)     → TS: calendarEventId
 *
 * 用法（在 repo 根目錄）：
 *   dry-run：  node --env-file=.env.local scripts/_add-visit-fields.js
 *   真改：     node --env-file=.env.local scripts/_add-visit-fields.js --apply
 */
const NOTION_API_KEY = process.env.NOTION_API_KEY;
const DEV_DB_ID = process.env.NOTION_DEV_DB_ID;
if (!NOTION_API_KEY) { console.error('NOTION_API_KEY required'); process.exit(1); }
if (!DEV_DB_ID) { console.error('NOTION_DEV_DB_ID required'); process.exit(1); }
const APPLY = process.argv.includes('--apply');

const NOTION_HEADERS = {
  Authorization: `Bearer ${NOTION_API_KEY}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
};

const NEW_PROPS = {
  '下次拜訪時間': { date: {} },
  '行事曆ID': { rich_text: {} },
};

async function getDb(id) {
  const r = await fetch(`https://api.notion.com/v1/databases/${id}`, {
    method: 'GET',
    headers: NOTION_HEADERS,
  });
  if (!r.ok) throw new Error(`GET ${id} ${r.status} ${await r.text()}`);
  return r.json();
}

async function patchDb(id, properties) {
  const r = await fetch(`https://api.notion.com/v1/databases/${id}`, {
    method: 'PATCH',
    headers: NOTION_HEADERS,
    body: JSON.stringify({ properties }),
  });
  if (!r.ok) throw new Error(`PATCH ${id} ${r.status} ${await r.text()}`);
  return r.json();
}

async function main() {
  console.log(`\n=== 開發 DB (${DEV_DB_ID}) ===`);

  const before = await getDb(DEV_DB_ID);
  const beforeKeys = Object.keys(before.properties);
  console.log(`目前 ${beforeKeys.length} 個欄位`);

  for (const [k] of Object.entries(NEW_PROPS)) {
    if (beforeKeys.includes(k)) {
      console.log(`  ⚠️  「${k}」已存在、會略過`);
    } else {
      console.log(`  +  「${k}」=>`, JSON.stringify(NEW_PROPS[k]));
    }
  }

  const toAdd = Object.fromEntries(
    Object.entries(NEW_PROPS).filter(([k]) => !beforeKeys.includes(k))
  );

  if (Object.keys(toAdd).length === 0) {
    console.log('\n沒有新欄位要加、結束');
    return;
  }

  if (!APPLY) {
    console.log('\n(dry-run、加 --apply 才真打 Notion API)');
    return;
  }

  const res = await patchDb(DEV_DB_ID, toAdd);
  console.log(`\nOK、DB 現在共 ${Object.keys(res.properties).length} 個欄位`);
  for (const k of Object.keys(toAdd)) {
    const p = res.properties[k];
    console.log(`  ✓ ${k}: type=${p.type}, id=${p.id}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
