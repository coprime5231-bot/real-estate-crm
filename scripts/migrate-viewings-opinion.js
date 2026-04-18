const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log('Connected to PG');

  // 'liked' / 'disliked' / NULL — 不加 CHECK constraint 保持彈性
  await client.query(`ALTER TABLE viewings ADD COLUMN IF NOT EXISTS opinion TEXT;`);
  console.log('ALTER TABLE viewings ADD COLUMN opinion OK');

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
