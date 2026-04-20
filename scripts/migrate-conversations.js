const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log('Connected to PG');

  await client.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id SERIAL PRIMARY KEY,
      notion_buyer_id UUID NOT NULL,
      date DATE NOT NULL DEFAULT CURRENT_DATE,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log('CREATE TABLE conversations OK');

  await client.query(`CREATE INDEX IF NOT EXISTS idx_conversations_buyer ON conversations(notion_buyer_id);`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_conversations_date ON conversations(date DESC);`);
  console.log('Indexes OK');

  const schema = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'conversations'
    ORDER BY ordinal_position;
  `);
  console.log('\n--- conversations schema ---');
  for (const r of schema.rows) {
    console.log(`  ${r.column_name}  ${r.data_type}  ${r.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}  default=${r.column_default || '-'}`);
  }

  const indexes = await client.query(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'conversations'
    ORDER BY indexname;
  `);
  console.log('\n--- conversations indexes ---');
  for (const r of indexes.rows) {
    console.log(`  ${r.indexname}`);
    console.log(`    ${r.indexdef}`);
  }

  const countRes = await client.query(`SELECT COUNT(*)::int AS count FROM conversations;`);
  console.log(`\n--- conversations row count ---`);
  console.log(`  count = ${countRes.rows[0].count}`);

  // Sanity check: viewings 表完全沒動
  const viewingsSchema = await client.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'viewings'
    ORDER BY ordinal_position;
  `);
  console.log('\n--- viewings schema (sanity check, not modified) ---');
  for (const r of viewingsSchema.rows) {
    console.log(`  ${r.column_name}  ${r.data_type}`);
  }

  await client.end();
  console.log('\nDone.');
}

main().catch(err => { console.error(err); process.exit(1); });
