/**
 * Phase 5 jump-box: 在 n8n container 內查 n8n PG、找 workflows referencing 舊 Notion DB ID
 */
const fs = require('fs');
const { execSync } = require('child_process');

const SERVICE_ID = '69535bf46e555cdaecc264e5'; // n8n service
const CHUNK_SIZE = 3000;

function execInContainer(shCmd) {
  const escaped = shCmd.replace(/"/g, '\\"');
  return execSync(`npx zeabur@latest service exec --id ${SERVICE_ID} -i=false -- sh -c "${escaped}"`,
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function chunkedUpload(b64, remotePath) {
  execInContainer(`rm -f ${remotePath}.b64 ${remotePath}`);
  for (let i = 0; i < b64.length; i += CHUNK_SIZE) {
    execInContainer(`printf '%s' '${b64.slice(i, i + CHUNK_SIZE)}' >> ${remotePath}.b64`);
  }
  execInContainer(`base64 -d ${remotePath}.b64 > ${remotePath} && rm -f ${remotePath}.b64`);
}

const action = process.argv[2] || 'list';

async function main() {
  const pgPath = '/usr/local/lib/node_modules/n8n/node_modules/.pnpm/pg@8.17.0/node_modules/pg';

  const runner = `
const { Client } = require('${pgPath}');
const conn = {
  host: process.env.DB_POSTGRESDB_HOST,
  port: Number(process.env.DB_POSTGRESDB_PORT) || 5432,
  database: process.env.DB_POSTGRESDB_DATABASE,
  user: process.env.DB_POSTGRESDB_USER,
  password: process.env.DB_POSTGRESDB_PASSWORD,
};
const ACTION = '${action}';
(async () => {
  const c = new Client(conn);
  await c.connect();
  if (ACTION === 'schema') {
    const r = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'workflow_entity' ORDER BY ordinal_position");
    console.log('workflow_entity columns:', r.rows);
  } else if (ACTION === 'list') {
    const r = await c.query("SELECT id, name, active FROM workflow_entity ORDER BY id");
    console.log('Workflows:');
    for (const w of r.rows) {
      console.log(' -', w.id, '|', w.active ? 'ACTIVE' : 'inactive', '|', w.name);
    }
  } else if (ACTION === 'find') {
    const oldIds = [
      '30156ff9-a859-8087-a9f8-fb20ab3d7c06',  // 舊新募極限
      '30156ff9a8598087a9f8fb20ab3d7c06',
      '28e56ff9-a859-80bd-bf1e-c0041c39e10a',  // 舊買方
      '28e56ff9a85980bdbf1ec0041c39e10a',
      '28d56ff9-a859-8093-8483-d68f63e1565a',  // 舊追蹤與委託
      '28d56ff9a8598093 8483d68f63e1565a',
    ];
    const r = await c.query("SELECT id, name, active, nodes::text AS nodes_str FROM workflow_entity");
    for (const w of r.rows) {
      const hits = oldIds.filter(id => w.nodes_str.includes(id));
      if (hits.length > 0) {
        console.log('Workflow', w.id, '|', w.name, '|', w.active ? 'ACTIVE' : 'inactive');
        console.log('  hits:', hits);
      }
    }
  } else if (ACTION === 'connections') {
    const wid = '${process.argv[3] || ''}';
    const r = await c.query("SELECT id, name, nodes, connections FROM workflow_entity WHERE id = \\$1", [wid]);
    if (r.rows.length === 0) { console.log('not found'); }
    else {
      const w = r.rows[0];
      console.log('Workflow:', w.name);
      // 找出 SLA / 買方相關的 nodes 名
      const targetNames = (w.nodes || [])
        .filter(n => JSON.stringify(n.parameters || {}).includes('28e56ff9') || JSON.stringify(n.parameters || {}).includes('28d56ff9'))
        .map(n => n.name);
      console.log('Old buyer/tracking DB nodes:', targetNames);
      console.log('Connections involving them:');
      const conns = w.connections || {};
      for (const [src, dsts] of Object.entries(conns)) {
        if (targetNames.includes(src)) {
          const flat = Object.values(dsts).flat().flat().map(d => d.node).join(', ');
          console.log('  ', src, ' -> ', flat);
        }
        // also find who connects INTO target
        for (const [type, arr] of Object.entries(dsts)) {
          for (const branch of arr) {
            for (const c of branch || []) {
              if (targetNames.includes(c.node)) {
                console.log('  ', src, ' --> ', c.node);
              }
            }
          }
        }
      }
    }
  } else if (ACTION === 'dump') {
    const wid = '${process.argv[3] || ''}';
    const r = await c.query("SELECT id, name, active, nodes FROM workflow_entity WHERE id = \\$1", [wid]);
    if (r.rows.length === 0) {
      console.log('No workflow with id', wid);
    } else {
      const w = r.rows[0];
      console.log('Workflow:', w.id, '|', w.name, '|', w.active ? 'ACTIVE' : 'inactive');
      console.log('Nodes:');
      for (const n of w.nodes) {
        const p = JSON.stringify(n.parameters || {});
        if (/30156ff9|28e56ff9|28d56ff9|35e56ff9/.test(p)) {
          console.log('  HIT', n.name, '| type:', n.type);
          console.log('    params:', p.length > 800 ? p.slice(0, 800) + '...[truncated]' : p);
        }
      }
    }
  }
  await c.end();
})().catch(e => { console.error(e); process.exit(1); });
`.trim();
  chunkedUpload(Buffer.from(runner).toString('base64'), '/tmp/_n8n.js');
  const out = execInContainer('node /tmp/_n8n.js 2>&1');
  console.log(out);
  execInContainer('rm -f /tmp/_n8n.js');
}

main().catch(e => { console.error(e); process.exit(1); });
