/**
 * 重要事項 / 待辦事項回寫客戶內文：在 IMPORTANT_DB + TODO_DB 各加一個欄位
 *   - 內文BlockID (rich_text)  → 存「append 到客戶頁面內文那一行」的 block id
 *                                完成時據此精準找回該行、加刪除線
 *
 * 用法（在 repo 根目錄）：
 *   dry-run：  node --env-file=.env.local scripts/_add-body-blockid-field.js
 *   真改：     node --env-file=.env.local scripts/_add-body-blockid-field.js --apply
 */
const NOTION_API_KEY = process.env.NOTION_API_KEY;
const IMPORTANT_DB_ID = process.env.NOTION_IMPORTANT_DB_ID;
const TODO_DB_ID = process.env.NOTION_TODO_DB_ID;
if (!NOTION_API_KEY) { console.error('NOTION_API_KEY required'); process.exit(1); }
if (!IMPORTANT_DB_ID) { console.error('NOTION_IMPORTANT_DB_ID required'); process.exit(1); }
if (!TODO_DB_ID) { console.error('NOTION_TODO_DB_ID required'); process.exit(1); }
const APPLY = process.argv.includes('--apply');

const NOTION_HEADERS = {
  Authorization: `Bearer ${NOTION_API_KEY}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
};

const NEW_PROPS = {
  '內文BlockID': { rich_text: {} },
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

async function addToDb(label, dbId) {
  console.log(`\n=== ${label} (${dbId}) ===`);
  const before = await getDb(dbId);
  const beforeKeys = Object.keys(before.properties);
  console.log(`目前 ${beforeKeys.length} 個欄位`);

  for (const [k] of Object.entries(NEW_PROPS)) {
    if (beforeKeys.includes(k)) console.log(`  ⚠️  「${k}」已存在、會略過`);
    else console.log(`  +  「${k}」=>`, JSON.stringify(NEW_PROPS[k]));
  }

  const toAdd = Object.fromEntries(
    Object.entries(NEW_PROPS).filter(([k]) => !beforeKeys.includes(k))
  );
  if (Object.keys(toAdd).length === 0) { console.log('沒有新欄位要加、跳過'); return; }
  if (!APPLY) { console.log('(dry-run、加 --apply 才真打 Notion API)'); return; }

  const res = await patchDb(dbId, toAdd);
  console.log(`OK、DB 現在共 ${Object.keys(res.properties).length} 個欄位`);
  for (const k of Object.keys(toAdd)) {
    const p = res.properties[k];
    console.log(`  ✓ ${k}: type=${p.type}, id=${p.id}`);
  }
}

async function main() {
  await addToDb('重要事項 DB', IMPORTANT_DB_ID);
  await addToDb('待辦事項 DB', TODO_DB_ID);
}

main().catch(e => { console.error(e); process.exit(1); });
