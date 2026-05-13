/**
 * Phase 7.A: 盤點新募極限 + 追蹤與委託 + 買方 DB schema
 * 本地直接 fetch Notion REST API
 *
 * 用法：set NOTION_API_KEY=ntn_xxx && node scripts/_inspect-notion-dbs.js
 *   or  PowerShell: $env:NOTION_API_KEY="ntn_xxx"; node scripts/_inspect-notion-dbs.js
 *   or  bash: NOTION_API_KEY=ntn_xxx node scripts/_inspect-notion-dbs.js
 */
const NOTION_API_KEY = process.env.NOTION_API_KEY;
if (!NOTION_API_KEY) {
  console.error('NOTION_API_KEY env var required');
  process.exit(1);
}

const dbs = {
  '買方 → 行銷 (28e56ff9)': '28e56ff9-a859-80bd-bf1e-c0041c39e10a',
  '新募極限 → 開發 (30156ff9)': '30156ff9-a859-8087-a9f8-fb20ab3d7c06',
  '追蹤與委託 → 開發-archive (28d56ff9)': '28d56ff9-a859-8093-8483-d68f63e1565a',
};

const NOTION_HEADERS = {
  Authorization: `Bearer ${NOTION_API_KEY}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
};

async function retrieveDb(id) {
  const r = await fetch(`https://api.notion.com/v1/databases/${id}`, { headers: NOTION_HEADERS });
  if (!r.ok) throw new Error(`retrieve ${id} ${r.status} ${await r.text()}`);
  return r.json();
}

async function queryDb(id, pageSize = 5) {
  const r = await fetch(`https://api.notion.com/v1/databases/${id}/query`, {
    method: 'POST',
    headers: NOTION_HEADERS,
    body: JSON.stringify({ page_size: pageSize }),
  });
  if (!r.ok) throw new Error(`query ${id} ${r.status} ${await r.text()}`);
  return r.json();
}

async function countAll(id) {
  let count = 0;
  let cursor;
  while (true) {
    const r = await fetch(`https://api.notion.com/v1/databases/${id}/query`, {
      method: 'POST',
      headers: NOTION_HEADERS,
      body: JSON.stringify({ page_size: 100, start_cursor: cursor }),
    });
    if (!r.ok) throw new Error(`query ${id} ${r.status} ${await r.text()}`);
    const data = await r.json();
    count += data.results.length;
    if (!data.has_more) break;
    cursor = data.next_cursor;
  }
  return count;
}

async function main() {
  for (const [name, id] of Object.entries(dbs)) {
    console.log('\n=== ' + name + ' ===');
    const db = await retrieveDb(id);
    console.log('Title:', db.title?.[0]?.plain_text || '(no title)');
    const props = db.properties;
    const list = [];
    for (const [pname, pdef] of Object.entries(props)) {
      let extra = '';
      if (pdef.type === 'select' && pdef.select?.options) {
        extra = ' [' + pdef.select.options.map(o => o.name).join(', ') + ']';
      } else if (pdef.type === 'multi_select' && pdef.multi_select?.options) {
        extra = ' [' + pdef.multi_select.options.map(o => o.name).join(', ') + ']';
      } else if (pdef.type === 'formula') {
        extra = ' expr=' + (pdef.formula?.expression || '').slice(0, 60);
      } else if (pdef.type === 'relation') {
        extra = ' -> ' + (pdef.relation?.database_id || '?');
      }
      list.push('  - ' + pname + ' (' + pdef.type + ')' + extra);
    }
    list.sort();
    console.log(list.join('\n'));

    const total = await countAll(id);
    console.log('Total rows:', total);

    const sample = await queryDb(id, 3);
    console.log('Sample (first 3 rows):');
    for (const p of sample.results) {
      const props = p.properties;
      const titleKey = Object.keys(props).find(k => props[k].type === 'title');
      const title = titleKey ? (props[titleKey].title[0]?.plain_text || '(無標題)') : '(no title prop)';
      console.log('  - id=' + p.id.slice(0,8) + ' title=' + title);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
