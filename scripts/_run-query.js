/**
 * Phase 4 jump-box: 把 .sql 拿來跑 SELECT、印 rows
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
  const sqlFile = process.argv[2];
  if (!sqlFile) { console.error('Usage: node scripts/_run-query.js <sql>'); process.exit(1); }
  const sql = fs.readFileSync(path.resolve(sqlFile), 'utf8');
  const runner = `
const fs = require('fs');
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const sql = fs.readFileSync('/app/_q.sql', 'utf8');
  const r = await c.query(sql);
  if (r.rows) console.log(JSON.stringify(r.rows, null, 2));
  await c.end();
})().catch(e => { console.error(e); process.exit(1); });
`.trim();
  chunkedUpload(Buffer.from(sql).toString('base64'), '/app/_q.sql');
  chunkedUpload(Buffer.from(runner).toString('base64'), '/app/_q-runner.js');
  console.log(execInContainer('cd /app && node /app/_q-runner.js 2>&1'));
  execInContainer('rm -f /app/_q.sql /app/_q-runner.js');
}
main().catch(e => { console.error(e); process.exit(1); });
