/**
 * 帶看卡列印鈕：viewings 表加一欄
 *   - ycut_case_idx TEXT  → 新增帶看時查到的 i智慧 內部 caseIdx，存起來給帶看卡列印鈕用
 *
 * 加性、IF NOT EXISTS、可重跑。用法（repo 根目錄）：
 *   node --env-file=.env.local scripts/_add-viewing-ycut-idx.js
 */
const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log('Connected to PG');

  const before = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='viewings' ORDER BY ordinal_position`
  );
  console.log('before:', before.rows.map(r => r.column_name).join(', '));

  await client.query(`ALTER TABLE viewings ADD COLUMN IF NOT EXISTS ycut_case_idx TEXT`);
  console.log('ALTER TABLE viewings ADD COLUMN ycut_case_idx OK');

  const after = await client.query(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns WHERE table_name='viewings' ORDER BY ordinal_position`
  );
  console.log('\n--- viewings schema after ---');
  for (const r of after.rows) {
    console.log(`  ${r.column_name}  ${r.data_type}  ${r.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
  }
  const n = await client.query(`SELECT COUNT(*)::int c FROM viewings`);
  console.log(`\nrows = ${n.rows[0].c}`);

  await client.end();
  console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
