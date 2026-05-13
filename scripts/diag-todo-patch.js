// 診斷：待辦 PATCH roundtrip 測試
const k = process.env.NOTION_API_KEY;
const todoDbId = process.env.NOTION_TODO_DB_ID;

async function getPage(id) {
  const r = await fetch('https://api.notion.com/v1/pages/' + id, {
    headers: { Authorization: 'Bearer ' + k, 'Notion-Version': '2022-06-28' },
  });
  return r.json();
}

async function patchPage(id, properties) {
  const r = await fetch('https://api.notion.com/v1/pages/' + id, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + k, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
    body: JSON.stringify({ properties }),
  });
  return { status: r.status, data: await r.json() };
}

(async () => {
  // 撈任一筆 page（不限 filter）
  const qRes = await fetch('https://api.notion.com/v1/databases/' + todoDbId + '/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + k, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
    body: JSON.stringify({ page_size: 1 }),
  });
  const q = await qRes.json();
  if (!q.results?.length) {
    console.log('DB 沒資料');
    return;
  }
  const pageId = q.results[0].id;
  const title = Object.values(q.results[0].properties).find((p) => p.type === 'title')?.title?.[0]?.plain_text;
  console.log(`測試 page: ${pageId}  title="${title}"`);

  // Step A: 撈當前值
  const before = await getPage(pageId);
  console.log(`\n[A] 目前 待辦=${before.properties?.['待辦']?.checkbox}`);

  // Step B: PATCH 待辦 → true
  console.log(`\n[B] PATCH 待辦 → true`);
  const r1 = await patchPage(pageId, { '待辦': { checkbox: true } });
  console.log(`    status=${r1.status}  response.待辦=${JSON.stringify(r1.data.properties?.['待辦'])}`);
  if (r1.status !== 200) {
    console.log(`    error.code=${r1.data.code}`);
    console.log(`    error.message=${r1.data.message}`);
  }

  await new Promise((r) => setTimeout(r, 1500));

  // Step C: refetch 確認
  const afterTrue = await getPage(pageId);
  console.log(`\n[C] refetch 後 待辦=${afterTrue.properties?.['待辦']?.checkbox}`);

  // Step D: PATCH 待辦 → false（還原）
  console.log(`\n[D] PATCH 待辦 → false（還原）`);
  const r2 = await patchPage(pageId, { '待辦': { checkbox: false } });
  console.log(`    status=${r2.status}  response.待辦=${JSON.stringify(r2.data.properties?.['待辦'])}`);

  await new Promise((r) => setTimeout(r, 1500));

  const afterFalse = await getPage(pageId);
  console.log(`\n[E] refetch 後 待辦=${afterFalse.properties?.['待辦']?.checkbox}`);

  // 結論
  console.log(`\n=== 結論 ===`);
  const originalVal = before.properties?.['待辦']?.checkbox;
  console.log(`  Notion API 直接 PATCH checkbox: ${afterTrue.properties?.['待辦']?.checkbox === true ? '✓ 寫得進去' : '✗ 寫不進去'}`);
  console.log(`  若寫不進去 → Notion 端問題（整合權限、schema）`);
  console.log(`  若寫得進去 → 前後端路由 / body 格式 / 錯誤處理問題`);
  if (originalVal !== afterFalse.properties?.['待辦']?.checkbox) {
    console.warn(`  ⚠️ 原值 ${originalVal} 未還原到 ${afterFalse.properties?.['待辦']?.checkbox}`);
  }
})();
