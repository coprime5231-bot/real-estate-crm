/**
 * Phase 3.2: 把 PG viewings / conversations 的 notion_buyer_id 對應到新 schema
 *   - viewings.notion_person_id        ← old_to_new_person['buyer:' + oldBuyerId]
 *   - viewings.notion_buyer_need_id    ← old_buyer_to_new_need[oldBuyerId]
 *   - conversations.notion_person_id   ← old_to_new_person['buyer:' + oldBuyerId]
 *
 * 用法：
 *   node scripts/migrate-mba-fks.js              # dry-run（預設）
 *   node scripts/migrate-mba-fks.js --apply      # 真正寫
 *
 * 必須先跑過 scripts/sql/2026-05-12-add-person-fks.sql 把新 column 建出來。
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const APPLY = process.argv.includes('--apply');

async function main() {
  const mapPath = path.join(__dirname, '..', 'outputs', 'migration-result.json');
  if (!fs.existsSync(mapPath)) {
    throw new Error(`找不到 ${mapPath}、請先跑 Phase 1c migrate-to-new-schema.js`);
  }
  const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  const personMap = map.mappings.old_to_new_person || {};
  const needMap = map.mappings.old_buyer_to_new_need || {};

  // personMap 的 key 兩種形式: "buyer:xxx" 跟 "buyer:xxx:"、值一樣。
  // 我們只用 "buyer:xxx" 形式。
  const resolvePerson = (oldBuyerId) => personMap[`buyer:${oldBuyerId}`] || null;
  const resolveNeed = (oldBuyerId) => needMap[oldBuyerId] || null;

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL 未設、請在環境變數帶上 PG connection string');
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log(`Connected to PG. Mode = ${APPLY ? 'APPLY (write)' : 'DRY-RUN'}\n`);

  // === 檢查新 column 是否已建 ===
  const colCheck = await client.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_name IN ('viewings', 'conversations')
      AND column_name IN ('notion_person_id', 'notion_buyer_need_id')
  `);
  const haveCols = new Set(colCheck.rows.map((r) => `${r.table_name}.${r.column_name}`));
  const required = [
    'viewings.notion_person_id',
    'viewings.notion_buyer_need_id',
    'conversations.notion_person_id',
  ];
  const missing = required.filter((c) => !haveCols.has(c));
  if (missing.length) {
    throw new Error(
      `新 column 還沒建：${missing.join(', ')}、請先跑 scripts/sql/2026-05-12-add-person-fks.sql`
    );
  }

  // === viewings backfill ===
  const vRes = await client.query(
    `SELECT id, notion_buyer_id FROM viewings
     WHERE notion_buyer_id IS NOT NULL
       AND (notion_person_id IS NULL OR notion_buyer_need_id IS NULL)`
  );
  console.log(`viewings 待 backfill: ${vRes.rows.length} 列`);
  let vOk = 0, vMissPerson = 0, vMissNeed = 0;
  for (const row of vRes.rows) {
    const personId = resolvePerson(row.notion_buyer_id);
    const needId = resolveNeed(row.notion_buyer_id);
    if (!personId) vMissPerson++;
    if (!needId) vMissNeed++;
    if (!personId && !needId) continue;
    if (APPLY) {
      await client.query(
        `UPDATE viewings
           SET notion_person_id = COALESCE($1, notion_person_id),
               notion_buyer_need_id = COALESCE($2, notion_buyer_need_id)
         WHERE id = $3`,
        [personId, needId, row.id]
      );
    }
    vOk++;
  }
  console.log(`  寫 ${vOk}、缺 person mapping ${vMissPerson}、缺 need mapping ${vMissNeed}`);

  // === conversations backfill ===
  const cRes = await client.query(
    `SELECT id, notion_buyer_id FROM conversations
     WHERE notion_buyer_id IS NOT NULL
       AND notion_person_id IS NULL`
  );
  console.log(`conversations 待 backfill: ${cRes.rows.length} 列`);
  let cOk = 0, cMiss = 0;
  for (const row of cRes.rows) {
    const personId = resolvePerson(row.notion_buyer_id);
    if (!personId) { cMiss++; continue; }
    if (APPLY) {
      await client.query(
        `UPDATE conversations SET notion_person_id = $1::uuid WHERE id = $2`,
        [personId, row.id]
      );
    }
    cOk++;
  }
  console.log(`  寫 ${cOk}、缺 person mapping ${cMiss}`);

  await client.end();
  console.log(`\n${APPLY ? '已寫入' : 'DRY-RUN 完、加 --apply 才真寫'}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
