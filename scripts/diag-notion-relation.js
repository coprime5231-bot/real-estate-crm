const k = process.env.NOTION_API_KEY;
const buyerId = '34556ff9-a859-815a-b663-dd89964963de';
const pageId = '34656ff9-a859-8153-8407-f2c55a0a997d';
(async () => {
  const r1 = await fetch('https://api.notion.com/v1/pages/' + pageId, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + k, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
    body: JSON.stringify({ properties: { '\uD83E\uDD11 買方': { relation: [{ id: buyerId }] } } }),
  });
  const d1 = await r1.json();
  console.log('PATCH_STATUS:', r1.status, 'RESP_BUYER:', JSON.stringify(d1.properties?.['\uD83E\uDD11 買方']?.relation), 'ERR:', d1.code || 'none', d1.message || '');
  await new Promise(r => setTimeout(r, 1500));
  const r2 = await fetch('https://api.notion.com/v1/pages/' + pageId, {
    headers: { Authorization: 'Bearer ' + k, 'Notion-Version': '2022-06-28' },
  });
  const d2 = await r2.json();
  console.log('REFETCH_BUYER:', JSON.stringify(d2.properties['\uD83E\uDD11 買方']));
})();
