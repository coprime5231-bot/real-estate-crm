/**
 * Phase 7.D 後: 把 30156ff9 (開發) 所有 未設 狀態的 row 預設成「募集」
 *
 * 用法：NOTION_API_KEY=ntn_xxx node scripts/_phase7-set-default-status.js [--apply]
 */
const NOTION_API_KEY = process.env.NOTION_API_KEY;
if (!NOTION_API_KEY) { console.error('NOTION_API_KEY required'); process.exit(1); }
const APPLY = process.argv.includes('--apply');

const DB = '30156ff9-a859-8087-a9f8-fb20ab3d7c06';

const NOTION_HEADERS = {
  Authorization: `Bearer ${NOTION_API_KEY}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
};

async function notionFetch(url, opts = {}) {
  const r = await fetch(`https://api.notion.com/v1${url}`, { headers: NOTION_HEADERS, ...opts });
  if (!r.ok) throw new Error(`${opts.method || 'GET'} ${url} ${r.status} ${await r.text()}`);
  return r.json();
}

async function queryAll() {
  let all = []; let cursor;
  while (true) {
    const data = await notionFetch(`/databases/${DB}/query`, {
      method: 'POST',
      body: JSON.stringify({
        page_size: 100, start_cursor: cursor,
        filter: { property: '狀態', select: { is_empty: true } },
      }),
    });
    all = all.concat(data.results);
    if (!data.has_more) break;
    cursor = data.next_cursor;
  }
  return all;
}

async function main() {
  console.log(`Mode = ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  const pages = await queryAll();
  console.log(`未設 狀態 的 row: ${pages.length}`);
  for (const p of pages) {
    const title = p.properties['名稱']?.title?.[0]?.plain_text || '(無標題)';
    console.log(`  - id=${p.id.slice(0,8)} | ${title}`);
    if (APPLY) {
      await notionFetch(`/pages/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ properties: { '狀態': { select: { name: '募集' } } } }),
      });
    }
  }
  console.log(`${APPLY ? '已寫入' : 'DRY-RUN'}: ${pages.length} pages set to 募集`);
}

main().catch(e => { console.error(e); process.exit(1); });
