/**
 * 盤點「開發」DB (NOTION_DEV_DB_ID = 30156ff9...) 屬性欄位去留用
 * 純讀取：schema + 每欄位填寫率 + select option 使用分佈
 * 用法 (bash): NOTION_API_KEY=ntn_xxx NOTION_DEV_DB_ID=30156ff9-... node scripts/_inspect-dev-db.js
 */
const NOTION_API_KEY = process.env.NOTION_API_KEY;
const DB_ID = process.env.NOTION_DEV_DB_ID;
if (!NOTION_API_KEY || !DB_ID) {
  console.error('NOTION_API_KEY and NOTION_DEV_DB_ID env vars required');
  process.exit(1);
}

const H = {
  Authorization: `Bearer ${NOTION_API_KEY}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
};

async function retrieveDb(id) {
  const r = await fetch(`https://api.notion.com/v1/databases/${id}`, { headers: H });
  if (!r.ok) throw new Error(`retrieve ${r.status} ${await r.text()}`);
  return r.json();
}

async function allRows(id) {
  const out = [];
  let cursor;
  while (true) {
    const r = await fetch(`https://api.notion.com/v1/databases/${id}/query`, {
      method: 'POST', headers: H,
      body: JSON.stringify({ page_size: 100, start_cursor: cursor }),
    });
    if (!r.ok) throw new Error(`query ${r.status} ${await r.text()}`);
    const d = await r.json();
    out.push(...d.results);
    if (!d.has_more) break;
    cursor = d.next_cursor;
  }
  return out;
}

function isFilled(p) {
  if (!p) return false;
  switch (p.type) {
    case 'title': return (p.title || []).length > 0 && p.title.some(t => t.plain_text.trim());
    case 'rich_text': return (p.rich_text || []).length > 0 && p.rich_text.some(t => t.plain_text.trim());
    case 'select': return !!p.select;
    case 'multi_select': return (p.multi_select || []).length > 0;
    case 'date': return !!p.date;
    case 'checkbox': return p.checkbox === true;
    case 'number': return p.number !== null && p.number !== undefined;
    case 'phone_number': return !!p.phone_number;
    case 'email': return !!p.email;
    case 'url': return !!p.url;
    case 'people': return (p.people || []).length > 0;
    case 'files': return (p.files || []).length > 0;
    case 'relation': return (p.relation || []).length > 0;
    case 'formula': {
      const f = p.formula || {};
      return f.string ? !!f.string.trim() : (f.number !== null && f.number !== undefined) || f.boolean === true || !!f.date;
    }
    case 'rollup': return true; // computed, always "present"
    default: return false;
  }
}

function valKey(p) {
  if (p.type === 'select') return p.select ? p.select.name : '(空)';
  if (p.type === 'multi_select') return (p.multi_select || []).map(o => o.name).sort().join('|') || '(空)';
  if (p.type === 'checkbox') return p.checkbox ? '☑' : '☐';
  return null;
}

(async () => {
  const db = await retrieveDb(DB_ID);
  console.log('=== DB:', db.title?.[0]?.plain_text || '(no title)', '(' + DB_ID.slice(0, 8) + ') ===\n');
  const props = db.properties;
  const rows = await allRows(DB_ID);
  const N = rows.length;
  console.log('Total rows:', N, '\n');

  const names = Object.keys(props);
  const rep = [];
  for (const name of names) {
    const def = props[name];
    let filled = 0;
    const dist = {};
    for (const row of rows) {
      const p = row.properties[name];
      if (isFilled(p)) filled++;
      const vk = p ? valKey(p) : null;
      if (vk !== null) dist[vk] = (dist[vk] || 0) + 1;
    }
    const pct = N ? Math.round((filled / N) * 100) : 0;
    let extra = '';
    if (def.type === 'select' && def.select?.options) extra = ' opts=[' + def.select.options.map(o => o.name).join(', ') + ']';
    else if (def.type === 'multi_select' && def.multi_select?.options) extra = ' opts=[' + def.multi_select.options.map(o => o.name).join(', ') + ']';
    else if (def.type === 'formula') extra = ' expr=' + (def.formula?.expression || '').slice(0, 80);
    else if (def.type === 'relation') extra = ' -> ' + (def.relation?.database_id || '?').slice(0, 8);
    rep.push({ name, type: def.type, filled, pct, extra, dist });
  }
  rep.sort((a, b) => a.pct - b.pct);
  for (const r of rep) {
    console.log(`[${String(r.pct).padStart(3)}%  ${String(r.filled).padStart(3)}/${N}]  ${r.name}  (${r.type})${r.extra}`);
    const dk = Object.entries(r.dist).sort((a, b) => b[1] - a[1]);
    if (dk.length && (r.type === 'select' || r.type === 'multi_select' || r.type === 'checkbox')) {
      console.log('        dist: ' + dk.map(([k, v]) => `${k}×${v}`).join('  '));
    }
  }
})().catch(e => { console.error(e); process.exit(1); });
