/**
 * Phase 3.2b/3.2c jump-box helper
 * 跑在本地 Windows、透過 `zeabur service exec` 把 mapping + backfill 邏輯送進 Next.js container
 * PG service exec 524 中、無法直接 psql、改走 Next.js container 內網連 PG
 *
 * 用法：
 *   node scripts/_upload-and-backfill.js                # dry-run（預設）
 *   node scripts/_upload-and-backfill.js --apply        # 真寫
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const APPLY = process.argv.includes('--apply');
const SERVICE_ID = '69dca7f8ca2b525706491c18'; // real-estate-crm Next.js
const CHUNK_SIZE = 3000; // base64 encoded length per chunk、留餘量給 cmd line

// 把 sh -c 的內容包成一個 double-quoted 字串、給 Windows cmd 一層 wrap
// shCmd 內部用單引號包 payload（base64 內無單引號、JSON 也已轉 base64）
function execInContainer(shCmd) {
  // escape double quotes for cmd /c wrapping
  const escaped = shCmd.replace(/"/g, '\\"');
  const cmd = `npx zeabur@latest service exec --id ${SERVICE_ID} -i=false -- sh -c "${escaped}"`;
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

async function main() {
  // 1) compact mapping
  const result = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'outputs', 'migration-result.json'), 'utf8')
  );
  const compact = {
    p: result.mappings.old_to_new_person,
    n: result.mappings.old_buyer_to_new_need,
  };
  const json = JSON.stringify(compact);
  const b64 = Buffer.from(json, 'utf8').toString('base64');
  console.log(`mapping JSON ${json.length}B、base64 ${b64.length}B`);

  // 2) split into chunks
  const chunks = [];
  for (let i = 0; i < b64.length; i += CHUNK_SIZE) {
    chunks.push(b64.slice(i, i + CHUNK_SIZE));
  }
  console.log(`分 ${chunks.length} 塊上傳到 /tmp/m.b64`);

  // 3) clear + append each chunk
  execInContainer('rm -f /tmp/m.b64 /tmp/m.json');
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    // base64 字元集只有 A-Za-z0-9+/=，單引號內絕對安全
    execInContainer(`printf '%s' '${c}' >> /tmp/m.b64`);
    process.stdout.write(`\rchunk ${i + 1}/${chunks.length}`);
  }
  process.stdout.write('\n');

  // 4) decode
  execInContainer('base64 -d /tmp/m.b64 > /tmp/m.json && wc -c /tmp/m.json');
  const sizeOut = execInContainer('wc -c /tmp/m.json');
  console.log('container side size:', sizeOut.trim());

  // 5) run backfill node script inside container
  const backfillScript = `
const fs = require('fs');
const { Client } = require('pg');
const APPLY = ${APPLY ? 'true' : 'false'};
const map = JSON.parse(fs.readFileSync('/tmp/m.json', 'utf8'));
const personMap = map.p, needMap = map.n;
const resolvePerson = (id) => personMap['buyer:' + id] || null;
const resolveNeed = (id) => needMap[id] || null;
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  console.log('Mode =', APPLY ? 'APPLY (write)' : 'DRY-RUN');

  const v = await c.query("SELECT id, notion_buyer_id FROM viewings WHERE notion_buyer_id IS NOT NULL AND (notion_person_id IS NULL OR notion_buyer_need_id IS NULL)");
  console.log('viewings 待 backfill:', v.rows.length);
  let vOk = 0, vMissPerson = 0, vMissNeed = 0;
  for (const r of v.rows) {
    const pid = resolvePerson(r.notion_buyer_id);
    const nid = resolveNeed(r.notion_buyer_id);
    if (!pid) vMissPerson++;
    if (!nid) vMissNeed++;
    if (!pid && !nid) continue;
    if (APPLY) {
      await c.query("UPDATE viewings SET notion_person_id = COALESCE($1, notion_person_id), notion_buyer_need_id = COALESCE($2, notion_buyer_need_id) WHERE id = $3", [pid, nid, r.id]);
    }
    vOk++;
  }
  console.log('  寫', vOk, '缺 person', vMissPerson, '缺 need', vMissNeed);

  const cv = await c.query("SELECT id, notion_buyer_id FROM conversations WHERE notion_buyer_id IS NOT NULL AND notion_person_id IS NULL");
  console.log('conversations 待 backfill:', cv.rows.length);
  let cOk = 0, cMiss = 0;
  for (const r of cv.rows) {
    const pid = resolvePerson(r.notion_buyer_id);
    if (!pid) { cMiss++; continue; }
    if (APPLY) {
      await c.query("UPDATE conversations SET notion_person_id = $1::uuid WHERE id = $2", [pid, r.id]);
    }
    cOk++;
  }
  console.log('  寫', cOk, '缺 person', cMiss);

  await c.end();
  console.log(APPLY ? '已寫入' : 'DRY-RUN 完');
})().catch(e => { console.error(e); process.exit(1); });
`.trim();

  // write script via chunks too (small enough as one if base64'd? 3500 chars roughly)
  const scriptB64 = Buffer.from(backfillScript, 'utf8').toString('base64');
  console.log(`script base64 ${scriptB64.length}B`);
  if (scriptB64.length > 6000) {
    execInContainer('rm -f /app/_b.b64 /app/_b.js');
    for (let i = 0; i < scriptB64.length; i += CHUNK_SIZE) {
      const c = scriptB64.slice(i, i + CHUNK_SIZE);
      execInContainer(`printf '%s' '${c}' >> /app/_b.b64`);
    }
    execInContainer('base64 -d /app/_b.b64 > /app/_b.js');
  } else {
    execInContainer(`printf '%s' '${scriptB64}' | base64 -d > /app/_b.js`);
  }

  // 6) execute (script in /app so node resolves pg from /app/node_modules)
  const out = execInContainer('cd /app && node /app/_b.js 2>&1');
  console.log('\n=== backfill output ===');
  console.log(out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
