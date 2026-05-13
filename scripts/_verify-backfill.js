/**
 * Phase 3.2 驗收：透過 Next.js container 連 PG、查 backfill 後欄位填寫狀況
 */
const { execSync } = require('child_process');

const SERVICE_ID = '69dca7f8ca2b525706491c18';

function execInContainer(shCmd) {
  const escaped = shCmd.replace(/"/g, '\\"');
  const cmd = `npx zeabur@latest service exec --id ${SERVICE_ID} -i=false -- sh -c "${escaped}"`;
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

const script = `
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const queries = [
    ['viewings.notion_buyer_id NOT NULL', 'SELECT count(*) FROM viewings WHERE notion_buyer_id IS NOT NULL'],
    ['viewings.notion_person_id NOT NULL', 'SELECT count(*) FROM viewings WHERE notion_person_id IS NOT NULL'],
    ['viewings.notion_buyer_need_id NOT NULL', 'SELECT count(*) FROM viewings WHERE notion_buyer_need_id IS NOT NULL'],
    ['viewings.both new fks NOT NULL', 'SELECT count(*) FROM viewings WHERE notion_person_id IS NOT NULL AND notion_buyer_need_id IS NOT NULL'],
    ['conversations.notion_buyer_id NOT NULL', 'SELECT count(*) FROM conversations WHERE notion_buyer_id IS NOT NULL'],
    ['conversations.notion_person_id NOT NULL', 'SELECT count(*) FROM conversations WHERE notion_person_id IS NOT NULL'],
  ];
  for (const [label, q] of queries) {
    const r = await c.query(q);
    console.log(label, '=', r.rows[0].count);
  }
  await c.end();
})().catch(e => { console.error(e); process.exit(1); });
`.trim();

const b64 = Buffer.from(script, 'utf8').toString('base64');
console.log('Verify script base64 len:', b64.length);

execInContainer(`rm -f /app/_v.js`);
execInContainer(`printf '%s' '${b64}' | base64 -d > /app/_v.js`);
const out = execInContainer('cd /app && node /app/_v.js 2>&1');
console.log('\n=== verify output ===\n' + out);
execInContainer('rm -f /app/_v.js /app/_b.js /app/_b.b64 /tmp/m.b64 /tmp/m.json');
