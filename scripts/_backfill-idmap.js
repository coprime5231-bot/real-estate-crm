/**
 * Phase 4.1c：把 outputs/migration-result.json 的 mapping 灌進 notion_id_map 表
 * 走 Next.js container jump-box (PG service exec 524 中)
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SERVICE_ID = '69dca7f8ca2b525706491c18';
const CHUNK_SIZE = 3000;

function execInContainer(shCmd) {
  const escaped = shCmd.replace(/"/g, '\\"');
  return execSync(`npx zeabur@latest service exec --id ${SERVICE_ID} -i=false -- sh -c "${escaped}"`,
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function chunkedUpload(b64, remotePath) {
  execInContainer(`rm -f ${remotePath}.b64 ${remotePath}`);
  for (let i = 0; i < b64.length; i += CHUNK_SIZE) {
    execInContainer(`printf '%s' '${b64.slice(i, i + CHUNK_SIZE)}' >> ${remotePath}.b64`);
  }
  execInContainer(`base64 -d ${remotePath}.b64 > ${remotePath} && rm -f ${remotePath}.b64`);
}

async function main() {
  const map = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'outputs', 'migration-result.json'), 'utf8')
  ).mappings;
  // 整理出 unique old_buyer_id → { person_id, buyer_need_id }
  const rows = {};
  for (const [k, v] of Object.entries(map.old_to_new_person)) {
    // key 兩種：'buyer:xxx' 跟 'buyer:xxx:'、值一樣
    const trimmed = k.replace(/^buyer:/, '').replace(/:$/, '');
    rows[trimmed] = rows[trimmed] || {};
    rows[trimmed].person_id = v;
  }
  for (const [k, v] of Object.entries(map.old_buyer_to_new_need)) {
    rows[k] = rows[k] || {};
    rows[k].buyer_need_id = v;
  }
  // 只保留有 person_id 的 row（buyer_need_id 可以 null）
  const final = Object.entries(rows)
    .filter(([, val]) => val.person_id)
    .map(([oldId, val]) => [oldId, val.person_id, val.buyer_need_id || null]);
  console.log(`mapping rows: ${final.length}`);

  const compact = JSON.stringify(final);
  const b64 = Buffer.from(compact).toString('base64');
  console.log(`compact JSON ${compact.length}B、base64 ${b64.length}B`);

  chunkedUpload(b64, '/app/_idmap.json');

  const runner = `
const fs = require('fs');
const { Client } = require('pg');
(async () => {
  const rows = JSON.parse(fs.readFileSync('/app/_idmap.json', 'utf8'));
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  let inserted = 0, updated = 0;
  for (const [oldId, personId, needId] of rows) {
    const r = await c.query(
      \`INSERT INTO notion_id_map (old_buyer_id, new_person_id, new_buyer_need_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (old_buyer_id) DO UPDATE
         SET new_person_id = EXCLUDED.new_person_id,
             new_buyer_need_id = EXCLUDED.new_buyer_need_id
       RETURNING (xmax = 0) AS inserted\`,
      [oldId, personId, needId]
    );
    if (r.rows[0].inserted) inserted++; else updated++;
  }
  console.log('inserted:', inserted, 'updated:', updated);
  const total = await c.query('SELECT count(*) FROM notion_id_map');
  console.log('total rows in notion_id_map:', total.rows[0].count);
  await c.end();
})().catch(e => { console.error(e); process.exit(1); });
`.trim();
  chunkedUpload(Buffer.from(runner).toString('base64'), '/app/_idmap-runner.js');

  console.log('Executing backfill...');
  console.log(execInContainer('cd /app && node /app/_idmap-runner.js 2>&1'));

  execInContainer('rm -f /app/_idmap.json /app/_idmap-runner.js');
}

main().catch(e => { console.error(e); process.exit(1); });
