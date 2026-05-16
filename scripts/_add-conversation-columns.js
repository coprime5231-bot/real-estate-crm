/**
 * 洽談卡重構：conversations 表加兩欄
 *   - notion_block_id TEXT                       → 該洽談 append 到客戶內文那行的 block id（編輯時據此同步 Notion）
 *   - is_important    BOOLEAN NOT NULL DEFAULT FALSE → 「重要」置頂旗標
 *
 * 加性、IF NOT EXISTS、可重跑。用法（repo 根目錄）：
 *   node --env-file=.env.local scripts/_add-conversation-columns.js
 */
const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log('Connected to PG');

  const before = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='conversations' ORDER BY ordinal_position`
  );
  console.log('before:', before.rows.map(r => r.column_name).join(', '));

  await client.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS notion_block_id TEXT`);
  await client.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_important BOOLEAN NOT NULL DEFAULT FALSE`);
  console.log('ALTER TABLE OK (notion_block_id, is_important)');

  const after = await client.query(
    `SELECT column_name, data_type, is_nullable, column_default
     FROM information_schema.columns WHERE table_name='conversations' ORDER BY ordinal_position`
  );
  console.log('\n--- conversations schema after ---');
  for (const r of after.rows) {
    console.log(`  ${r.column_name}  ${r.data_type}  ${r.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}  default=${r.column_default || '-'}`);
  }
  const n = await client.query(`SELECT COUNT(*)::int c FROM conversations`);
  console.log(`\nrows = ${n.rows[0].c}`);

  await client.end();
  console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
