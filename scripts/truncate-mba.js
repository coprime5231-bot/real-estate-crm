const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log('Connected to PG');

  const tables = [
    'task_completions',
    'custom_tasks',
    'daily_stats',
    'chest_opens',
    'quarter_history',
  ];

  for (const t of tables) {
    await client.query(`TRUNCATE ${t} CASCADE`);
    console.log(`TRUNCATED ${t}`);
  }

  console.log('\n--- Verify counts ---');
  for (const t of tables) {
    const res = await client.query(`SELECT COUNT(*) FROM ${t}`);
    console.log(`${t}: ${res.rows[0].count}`);
  }

  await client.end();
  console.log('\nDone.');
}

main().catch(err => { console.error(err); process.exit(1); });
