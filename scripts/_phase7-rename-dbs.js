/**
 * Phase 7: Notion DB rename
 *   28e56ff9 「買方」 → 「行銷」
 *   30156ff9 「新募極限」 → 「開發」
 *   28d56ff9 「追蹤與委託」 → 「開發-archive」（搬完後才 rename）
 *
 * 用法：NOTION_API_KEY=ntn_xxx node scripts/_phase7-rename-dbs.js [name1|name2|name3|all] [--apply]
 *   name1 = 行銷
 *   name2 = 開發
 *   name3 = 開發-archive
 */
const NOTION_API_KEY = process.env.NOTION_API_KEY;
if (!NOTION_API_KEY) { console.error('NOTION_API_KEY required'); process.exit(1); }
const APPLY = process.argv.includes('--apply');
const FILTER = process.argv.find(a => ['name1','name2','name3','all'].includes(a)) || 'all';

const NOTION_HEADERS = {
  Authorization: `Bearer ${NOTION_API_KEY}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
};

const RENAMES = {
  name1: { id: '28e56ff9-a859-80bd-bf1e-c0041c39e10a', from: '買方', to: '行銷' },
  name2: { id: '30156ff9-a859-8087-a9f8-fb20ab3d7c06', from: '新募極限', to: '開發' },
  name3: { id: '28d56ff9-a859-8093-8483-d68f63e1565a', from: '追蹤與委託', to: '開發-archive' },
};

async function rename(id, newTitle) {
  const r = await fetch(`https://api.notion.com/v1/databases/${id}`, {
    method: 'PATCH',
    headers: NOTION_HEADERS,
    body: JSON.stringify({ title: [{ type: 'text', text: { content: newTitle } }] }),
  });
  if (!r.ok) throw new Error(`PATCH ${id} ${r.status} ${await r.text()}`);
  return r.json();
}

async function main() {
  const targets = FILTER === 'all'
    ? Object.values(RENAMES)
    : [RENAMES[FILTER]];
  for (const t of targets) {
    console.log(`${t.id} : ${t.from} -> ${t.to}`);
    if (APPLY) {
      const res = await rename(t.id, t.to);
      console.log('  OK, new title:', res.title[0]?.plain_text);
    }
  }
  if (!APPLY) console.log('(dry-run、加 --apply 才真改)');
}

main().catch(e => { console.error(e); process.exit(1); });
