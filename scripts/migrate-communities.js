const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log('Connected to PG');

  await client.query(`
    CREATE TABLE IF NOT EXISTS communities (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL UNIQUE,
      leju_url   TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log('CREATE TABLE communities OK');

  // B-tree 對 autocomplete 規模（<幾百筆）已夠，不依賴 pg_trgm extension。
  await client.query(`CREATE INDEX IF NOT EXISTS idx_communities_name ON communities (name);`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_communities_updated_at ON communities (updated_at DESC);`);
  console.log('Indexes OK');

  const schema = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'communities'
    ORDER BY ordinal_position;
  `);
  console.log('\n--- communities schema ---');
  for (const r of schema.rows) {
    console.log(`  ${r.column_name}  ${r.data_type}  ${r.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
  }

  await client.end();
  console.log('\nDone.');
}

main().catch(err => { console.error(err); process.exit(1); });
