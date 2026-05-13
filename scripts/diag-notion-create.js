const k = process.env.NOTION_API_KEY;
const dbId = process.env.NOTION_TODO_DB_ID;
const buyerId = '34556ff9-a859-815a-b663-dd89964963de';
(async () => {
  const r1 = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + k, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      parent: { database_id: dbId },
      properties: {
        Name: { title: [{ text: { content: 'DIAG_CREATE_2' } }] },
        '待辦': { checkbox: true },
        '\uD83E\uDD11 買方': { relation: [{ id: buyerId }] },
      },
    }),
  });
  const d1 = await r1.json();
  const newId = d1.id;
  console.log('CREATE_STATUS:', r1.status, 'NEW_ID:', newId);
  console.log('CREATE_RESP_BUYER:', JSON.stringify(d1.properties?.['\uD83E\uDD11 買方']?.relation));
  if (d1.code) console.log('ERR:', d1.code, d1.message);
  await new Promise(r => setTimeout(r, 2000));
  const r2 = await fetch('https://api.notion.com/v1/pages/' + newId, {
    headers: { Authorization: 'Bearer ' + k, 'Notion-Version': '2022-06-28' },
  });
  const d2 = await r2.json();
  console.log('REFETCH_BUYER:', JSON.stringify(d2.properties['\uD83E\uDD11 買方']));
  console.log('REFETCH_TRACKING:', JSON.stringify(d2.properties['\uD83E\uDD29 追蹤與委託']));
})();
