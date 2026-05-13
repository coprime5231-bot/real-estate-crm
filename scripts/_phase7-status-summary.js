/**
 * Phase 7 驗收：30156ff9 開發 DB 各狀態列數、各 28e56ff9 行銷 DB 成交日期 fill rate
 */
const NOTION_API_KEY = process.env.NOTION_API_KEY;
if (!NOTION_API_KEY) { console.error('NOTION_API_KEY required'); process.exit(1); }

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

async function queryAll(dbId) {
  let all = []; let cursor;
  while (true) {
    const data = await notionFetch(`/databases/${dbId}/query`, {
      method: 'POST',
      body: JSON.stringify({ page_size: 100, start_cursor: cursor }),
    });
    all = all.concat(data.results);
    if (!data.has_more) break;
    cursor = data.next_cursor;
  }
  return all;
}

async function main() {
  console.log('=== 開發 (30156ff9) 狀態分布 ===');
  const dev = await queryAll('30156ff9-a859-8087-a9f8-fb20ab3d7c06');
  const dist = {};
  for (const p of dev) {
    const s = p.properties['狀態']?.select?.name || '(未設)';
    dist[s] = (dist[s] || 0) + 1;
  }
  console.log('Total rows:', dev.length);
  for (const [k, v] of Object.entries(dist)) console.log(' ', k, ':', v);

  console.log('\n=== 行銷 (28e56ff9) 成交日期 ===');
  const mkt = await queryAll('28e56ff9-a859-80bd-bf1e-c0041c39e10a');
  const filled = mkt.filter(p => p.properties['成交日期']?.date?.start).length;
  console.log(`Total rows: ${mkt.length}、有成交日期: ${filled}、空: ${mkt.length - filled}`);
}

main().catch(e => { console.error(e); process.exit(1); });
