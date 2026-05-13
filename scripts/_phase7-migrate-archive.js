/**
 * Phase 7.C/D: 搬 28d56ff9 (追蹤與委託) → 30156ff9 (開發)
 *
 * 用法：NOTION_API_KEY=ntn_xxx node scripts/_phase7-migrate-archive.js [--apply]
 * 預設 dry-run：印每筆會建什麼、缺什麼、files 是否能搬
 * --apply：真正建立、產出 outputs/phase7-migration-result.json (old_id → new_id)
 */
const fs = require('fs');
const path = require('path');

const NOTION_API_KEY = process.env.NOTION_API_KEY;
if (!NOTION_API_KEY) { console.error('NOTION_API_KEY required'); process.exit(1); }
const APPLY = process.argv.includes('--apply');

const SRC_DB = '28d56ff9-a859-8093-8483-d68f63e1565a'; // 開發-archive (舊 追蹤與委託)
const DST_DB = '30156ff9-a859-8087-a9f8-fb20ab3d7c06'; // 開發 (舊 新募極限)

const NOTION_HEADERS = {
  Authorization: `Bearer ${NOTION_API_KEY}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
};

async function notionFetch(url, opts = {}) {
  const r = await fetch(`https://api.notion.com/v1${url}`, {
    headers: NOTION_HEADERS,
    ...opts,
  });
  if (!r.ok) throw new Error(`${opts.method || 'GET'} ${url} ${r.status} ${await r.text()}`);
  return r.json();
}

async function queryAll(dbId) {
  let all = [];
  let cursor;
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

function pickTitle(p, key='名稱') {
  return p[key]?.title?.map(t => t.plain_text).join('') || '';
}
function pickRichText(p, key) {
  return p[key]?.rich_text?.map(t => t.plain_text).join('') || '';
}
function pickPhone(p, key) { return p[key]?.phone_number || ''; }
function pickSelect(p, key) { return p[key]?.select?.name || ''; }
function pickDate(p, key) { return p[key]?.date?.start || ''; }
function pickUrl(p, key) { return p[key]?.url || ''; }
function pickFiles(p, key) { return p[key]?.files || []; }
function pickRelation(p, key) { return (p[key]?.relation || []).map(r => r.id); }

function buildNewPageProps(oldProps) {
  const props = {};

  const title = pickTitle(oldProps, '名稱');
  if (title) props['名稱'] = { title: [{ text: { content: title } }] };

  const owner = pickRichText(oldProps, '屋主');
  if (owner) props['屋主'] = { rich_text: [{ text: { content: owner } }] };

  const addr = pickRichText(oldProps, '物件地址');
  if (addr) props['物件地址'] = { rich_text: [{ text: { content: addr } }] };

  const grade = pickSelect(oldProps, '客戶等級');
  if (grade) props['客戶等級'] = { select: { name: grade } };

  const phone = pickPhone(oldProps, '手機');
  if (phone) props['手機'] = { phone_number: phone };

  const idNum = pickRichText(oldProps, '身份證字號');
  if (idNum) props['身份證字號'] = { rich_text: [{ text: { content: idNum } }] };

  const expiry = pickDate(oldProps, '委託到期日');
  if (expiry) props['委託到期日'] = { date: { start: expiry } };

  const important = pickRichText(oldProps, '重要事項');
  if (important) props['重要事項'] = { rich_text: [{ text: { content: important } }] };

  const status = pickSelect(oldProps, '狀態');
  if (status) props['狀態'] = { select: { name: status } };

  const url = pickUrl(oldProps, '網頁');
  if (url) props['網頁'] = { url };

  // Files：只能搬 type='external'、Notion-hosted (type='file') 內部 url 是 pre-signed、再 PATCH 進新頁會失敗
  const carryFiles = (key) => {
    const files = pickFiles(oldProps, key);
    const filtered = files
      .filter(f => f.type === 'external')
      .map(f => ({ name: f.name, external: { url: f.external.url } }));
    const droppedHosted = files.filter(f => f.type !== 'external').length;
    return { filtered, droppedHosted };
  };
  const entrustFiles = carryFiles('委託');
  if (entrustFiles.filtered.length > 0) props['委託'] = { files: entrustFiles.filtered };
  const titleDeed = carryFiles('謄本');
  if (titleDeed.filtered.length > 0) props['謄本'] = { files: titleDeed.filtered };

  // Relations
  const todos = pickRelation(oldProps, '✅ 待辦事項');
  if (todos.length > 0) props['待辦事項'] = { relation: todos.map(id => ({ id })) };

  const importantRels = pickRelation(oldProps, '📢 本周重要大事');
  if (importantRels.length > 0) props['本周重要大事'] = { relation: importantRels.map(id => ({ id })) };

  return {
    props,
    droppedFiles: entrustFiles.droppedHosted + titleDeed.droppedHosted,
  };
}

async function createPage(databaseId, properties) {
  return notionFetch('/pages', {
    method: 'POST',
    body: JSON.stringify({ parent: { database_id: databaseId }, properties }),
  });
}

async function main() {
  console.log(`Mode = ${APPLY ? 'APPLY (write)' : 'DRY-RUN'}`);
  const src = await queryAll(SRC_DB);
  console.log(`Source 開發-archive: ${src.length} rows`);

  let totalDroppedFiles = 0;
  const mapping = {};
  let i = 0;
  for (const page of src) {
    i++;
    const { props, droppedFiles } = buildNewPageProps(page.properties);
    const title = pickTitle(page.properties);
    const status = pickSelect(page.properties, '狀態') || '(未設)';
    const propNames = Object.keys(props).join(', ');
    console.log(`[${i}/${src.length}] ${title} | status=${status} | props: ${propNames}`);
    if (droppedFiles > 0) {
      console.log(`    ⚠ ${droppedFiles} Notion-hosted file(s) dropped (不能 re-attach、需手動上傳)`);
      totalDroppedFiles += droppedFiles;
    }
    if (APPLY) {
      const newPage = await createPage(DST_DB, props);
      mapping[page.id] = newPage.id;
    }
  }

  console.log(`\nTotal: ${src.length} rows ${APPLY ? 'created' : 'planned'}.`);
  console.log(`Total Notion-hosted files dropped: ${totalDroppedFiles}`);

  if (APPLY) {
    const out = path.join(__dirname, '..', 'outputs', 'phase7-migration-result.json');
    fs.writeFileSync(out, JSON.stringify({ generated_at: new Date().toISOString(), mapping }, null, 2));
    console.log(`Mapping saved: ${out}`);
  } else {
    console.log('Add --apply to actually create pages.');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
