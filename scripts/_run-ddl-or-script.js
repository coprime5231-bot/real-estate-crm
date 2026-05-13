/**
 * Phase 4 jump-box: 把 .sql 檔內容打到 PG via Next.js container
 * 用法：node scripts/_run-ddl-or-script.js <sql-file>
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SERVICE_ID = '69dca7f8ca2b525706491c18';
const CHUNK_SIZE = 3000;

function execInContainer(shCmd) {
  const escaped = shCmd.replace(/"/g, '\\"');
  const cmd = `npx zeabur@latest service exec --id ${SERVICE_ID} -i=false -- sh -c "${escaped}"`;
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function chunkedUploadBase64(b64, remotePath) {
  execInContainer(`rm -f ${remotePath}.b64 ${remotePath}`);
  for (let i = 0; i < b64.length; i += CHUNK_SIZE) {
    const c = b64.slice(i, i + CHUNK_SIZE);
    execInContainer(`printf '%s' '${c}' >> ${remotePath}.b64`);
  }
  execInContainer(`base64 -d ${remotePath}.b64 > ${remotePath} && rm -f ${remotePath}.b64`);
}

async function main() {
  const sqlFile = process.argv[2];
  if (!sqlFile) {
    console.error('Usage: node scripts/_run-ddl-or-script.js <sql-file>');
    process.exit(1);
  }
  const sql = fs.readFileSync(path.resolve(sqlFile), 'utf8');
  console.log(`SQL length: ${sql.length}`);

  // wrap in a node script that runs the SQL via pg
  const runner = `
const fs = require('fs');
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const sql = fs.readFileSync('/app/_ddl.sql', 'utf8');
  console.log('Executing SQL:');
  console.log(sql);
  console.log('---');
  await c.query(sql);
  console.log('Done.');
  await c.end();
})().catch(e => { console.error(e); process.exit(1); });
`.trim();

  const runnerB64 = Buffer.from(runner, 'utf8').toString('base64');
  const sqlB64 = Buffer.from(sql, 'utf8').toString('base64');

  console.log('Uploading SQL...');
  chunkedUploadBase64(sqlB64, '/app/_ddl.sql');
  console.log('Uploading runner...');
  chunkedUploadBase64(runnerB64, '/app/_ddl-runner.js');

  console.log('Executing...');
  const out = execInContainer('cd /app && node /app/_ddl-runner.js 2>&1');
  console.log('=== output ===');
  console.log(out);

  console.log('Cleanup...');
  execInContainer('rm -f /app/_ddl.sql /app/_ddl-runner.js');
  console.log('Done.');
}

main().catch((e) => { console.error(e); process.exit(1); });
