const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log('Connected to PG');

  await client.query(`
    CREATE TABLE IF NOT EXISTS viewings (
      id SERIAL PRIMARY KEY,
      calendar_event_id TEXT NOT NULL UNIQUE,
      notion_buyer_id TEXT NOT NULL,
      datetime TIMESTAMPTZ NOT NULL,
      location TEXT NOT NULL,
      community_url TEXT,
      colleague_name TEXT NOT NULL,
      colleague_phone TEXT NOT NULL,
      note TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log('CREATE TABLE viewings OK');

  await client.query(`CREATE INDEX IF NOT EXISTS idx_viewings_buyer ON viewings (notion_buyer_id);`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_viewings_datetime ON viewings (datetime);`);
  console.log('Indexes OK');

  const schema = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'viewings'
    ORDER BY ordinal_position;
  `);
  console.log('\n--- viewings schema ---');
  for (const r of schema.rows) {
    console.log(`  ${r.column_name}  ${r.data_type}  ${r.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
  }

  await client.end();
  console.log('\nDone.');
}

main().catch(err => { console.error(err); process.exit(1); });
