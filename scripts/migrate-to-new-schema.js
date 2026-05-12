/**
 * Phase 1b: 舊三 DB → 新三 DB 搬遷腳本（支援 dry-run）
 *
 * Usage:
 *   $env:NOTION_API_KEY = "ntn_..."
 *   node scripts/migrate-to-new-schema.js              # dry-run (default)
 *   node scripts/migrate-to-new-schema.js --execute    # 正式寫入
 *
 * dry-run 模式：
 *   - 讀舊三 DB 全部 page
 *   - 計算 dedupe / 人物 / 物件 / 買方需求 各幾筆
 *   - 偵測異常（同手機不同姓名、共有人、缺欄位）
 *   - 不寫 Notion、輸出 outputs/migration-preview.json
 *
 * --execute 模式：
 *   - 走相同流程、但實際寫進三個新 DB
 *   - 輸出 outputs/migration-result.json（含舊→新 page id 對照表、後續 PG migration 要用）
 *
 * Dedupe 規則：
 *   1. 同手機 = 同一個人物（合併、角色 multi_select 累積）
 *   2. 同身份證 = 同一個人物
 *   3. 同姓名但無其他資訊 = 建多筆、不 dedupe（避免錯誤合併）
 */

const { Client } = require('@notionhq/client')
const fs = require('fs')
const path = require('path')

const TOKEN = process.env.NOTION_API_KEY
if (!TOKEN) {
  console.error('Set NOTION_API_KEY env var first.')
  process.exit(1)
}

const notion = new Client({ auth: TOKEN })

const EXECUTE = process.argv.includes('--execute')

// 舊 DB
const OLD = {
  buyer: '28e56ff9-a859-80bd-bf1e-c0041c39e10a', // 買方
  entrust: '28d56ff9-a859-8093-8483-d68f63e1565a', // 追蹤與委託
  prospect: '30156ff9-a859-8087-a9f8-fb20ab3d7c06', // 新募極限
}

// 新 DB（從 Phase 1a outputs 讀）
const NEW_DBS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'outputs', 'new-dbs.json'), 'utf8'))
const NEW = {
  people: NEW_DBS.dbs.people.id,
  property: NEW_DBS.dbs.property.id,
  buyer_need: NEW_DBS.dbs.buyer_need.id,
}

// ============================================================
// Helpers
// ============================================================

const extractText = (rt) =>
  Array.isArray(rt) ? rt.map((b) => b.plain_text || '').join('').trim() : ''

const extractSelect = (s) => s?.name || null

const extractMulti = (m) => (Array.isArray(m) ? m.map((o) => o.name).filter(Boolean) : [])

function normalizePhone(p) {
  if (!p) return null
  const digits = String(p).replace(/\D/g, '')
  return digits.length >= 8 ? digits : null
}

function normalizeName(n) {
  return (n || '').trim().replace(/\s+/g, '')
}

// 共有人解析（屋主欄位可能塞「老王、王太太」/「老王/王太太」/「老王 王太太」）
function splitOwners(s) {
  if (!s) return []
  return s
    .split(/[、,，/／\s]+/)
    .map((x) => x.trim())
    .filter(Boolean)
}

async function fetchAllPages(dbId) {
  const pages = []
  let cursor = undefined
  do {
    const res = await notion.databases.query({
      database_id: dbId,
      page_size: 100,
      start_cursor: cursor,
    })
    pages.push(...res.results)
    cursor = res.has_more ? res.next_cursor : undefined
  } while (cursor)
  return pages
}

// ============================================================
// 從舊 DB 抽出 raw 紀錄
// ============================================================

function fromBuyerPage(p) {
  const props = p.properties
  const name = props['名稱']?.title?.[0]?.plain_text || ''
  const phone = props['手機']?.phone_number || extractText(props['手機']?.rich_text)
  return {
    source: 'buyer',
    oldId: p.id,
    person: {
      name,
      phone: normalizePhone(phone),
      birthday: props['生日']?.date?.start || null,
      grade: extractSelect(props['客戶等級']?.select) || extractSelect(props['等級']?.select),
      zones: extractMulti(props['區域']?.multi_select),
      roleHint: '買方',
    },
    need: {
      name,
      budget: extractSelect(props['預算']?.select),
      needText: extractText(props['需求']?.rich_text),
      needTags: extractMulti(props['需求標籤']?.multi_select),
      layouts: extractMulti(props['格局']?.multi_select),
      zones: extractMulti(props['區域']?.multi_select),
      note: extractText(props['NOTE']?.rich_text),
      progress: extractText(props['最近進展']?.rich_text),
      nextFollowUp: props['日期']?.date?.start || null,
    },
  }
}

function fromEntrustPage(p) {
  const props = p.properties
  const ownerRaw = extractText(props['屋主']?.rich_text)
  const ownerNames = splitOwners(ownerRaw)
  const phone = props['手機']?.phone_number || extractText(props['手機']?.rich_text)
  return {
    source: 'entrust',
    oldId: p.id,
    owners: ownerNames.map((n) => ({
      name: n,
      phone: normalizePhone(phone), // 多屋主共享同一電話、後續手動拆
      idNumber: extractText(props['身份證字號']?.rich_text),
      grade: extractSelect(props['客戶等級']?.select),
      roleHint: '屋主',
    })),
    property: {
      name: props['名稱']?.title?.[0]?.plain_text || '',
      address: extractText(props['物件地址']?.rich_text),
      status: extractSelect(props['狀態']?.select), // 追蹤 / 委託 / 過期 / 成交
      expiry: props['委託到期日']?.date?.start || null,
      important: extractText(props['重要事項']?.rich_text),
      web: props['網頁']?.url || null,
    },
  }
}

function fromProspectPage(p) {
  const props = p.properties
  const ownerRaw = extractText(props['屋主']?.rich_text)
  const ownerNames = splitOwners(ownerRaw)
  return {
    source: 'prospect',
    oldId: p.id,
    owners: ownerNames.map((n) => ({
      name: n,
      phone: null, // 新募極限通常還沒有電話
      roleHint: '潛在屋主',
    })),
    property: {
      name: props['名稱']?.title?.[0]?.plain_text || '',
      objectAddr: extractText(props['物件']?.rich_text),
      householdAddr: extractText(props['戶藉地址']?.rich_text),
      mainBuilding: extractText(props['主建物']?.rich_text),
      area: extractText(props['坪數']?.rich_text),
      layout: extractText(props['格局']?.rich_text),
      price: extractText(props['開價']?.rich_text),
      parking: extractMulti(props['車位']?.multi_select),
      objectLetter: extractText(props['物信']?.rich_text),
      householdLetter: extractText(props['戶信']?.rich_text),
      devLetter: props['開發信']?.checkbox === true,
      devProgress: extractMulti(props['開發進度']?.multi_select),
      todo: extractSelect(props['待辦']?.select),
      synced: extractSelect(props['已同步']?.select),
      status: '開發信', // 新募極限預設 stage
    },
  }
}

// ============================================================
// Dedupe 人物
// ============================================================

function dedupePeople(rawPersons) {
  // rawPersons: [{name, phone, idNumber, ..., roleHint, oldRefs[]}]
  const byPhone = new Map()
  const byIdNumber = new Map()
  const byNameAlone = new Map() // 只有名字、沒電話也沒身份證的、靠名字 dedup（弱）
  const merged = []

  for (const p of rawPersons) {
    let target = null

    if (p.phone && byPhone.has(p.phone)) target = byPhone.get(p.phone)
    else if (p.idNumber && byIdNumber.has(p.idNumber)) target = byIdNumber.get(p.idNumber)
    else if (!p.phone && !p.idNumber && p.name) {
      // 只有名字、保守處理：建多筆、不 dedup（同名「陳先生」很多）
      target = null
    }

    if (target) {
      // 合併
      target.roles.add(p.roleHint)
      target.oldRefs.push(...p.oldRefs)
      if (!target.name && p.name) target.name = p.name
      if (!target.birthday && p.birthday) target.birthday = p.birthday
      if (!target.grade && p.grade) target.grade = p.grade
      if (p.zones) target.zones = [...new Set([...target.zones, ...p.zones])]
      if (!target.idNumber && p.idNumber) {
        target.idNumber = p.idNumber
        byIdNumber.set(p.idNumber, target)
      }
    } else {
      const entry = {
        name: p.name || '(未命名)',
        phone: p.phone,
        idNumber: p.idNumber || null,
        birthday: p.birthday || null,
        grade: p.grade || null,
        zones: p.zones || [],
        roles: new Set([p.roleHint]),
        oldRefs: [...p.oldRefs],
      }
      merged.push(entry)
      if (p.phone) byPhone.set(p.phone, entry)
      if (p.idNumber) byIdNumber.set(p.idNumber, entry)
    }
  }
  return merged
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log(`Mode: ${EXECUTE ? 'EXECUTE (will write Notion)' : 'DRY-RUN (no writes)'}`)
  console.log('')

  console.log('Reading 買方...')
  const buyerPages = await fetchAllPages(OLD.buyer)
  console.log(`  ${buyerPages.length} rows`)

  console.log('Reading 追蹤與委託...')
  const entrustPages = await fetchAllPages(OLD.entrust)
  console.log(`  ${entrustPages.length} rows`)

  console.log('Reading 新募極限...')
  const prospectPages = await fetchAllPages(OLD.prospect)
  console.log(`  ${prospectPages.length} rows`)

  console.log('')
  console.log('Parsing...')

  const buyerRecs = buyerPages.map(fromBuyerPage)
  const entrustRecs = entrustPages.map(fromEntrustPage)
  const prospectRecs = prospectPages.map(fromProspectPage)

  // 收集所有 person 原始記錄
  const rawPersons = []

  for (const r of buyerRecs) {
    rawPersons.push({
      ...r.person,
      oldRefs: [{ source: 'buyer', oldId: r.oldId }],
    })
  }
  for (const r of entrustRecs) {
    for (const o of r.owners) {
      rawPersons.push({
        ...o,
        oldRefs: [{ source: 'entrust', oldId: r.oldId, propertyName: r.property.name }],
      })
    }
  }
  for (const r of prospectRecs) {
    for (const o of r.owners) {
      rawPersons.push({
        ...o,
        oldRefs: [{ source: 'prospect', oldId: r.oldId, propertyName: r.property.name }],
      })
    }
  }

  console.log(`  raw person records: ${rawPersons.length}`)

  const mergedPeople = dedupePeople(rawPersons)
  console.log(`  after dedupe: ${mergedPeople.length} unique people`)

  // 換屋客識別
  const swappers = mergedPeople.filter(
    (p) => p.roles.has('買方') && (p.roles.has('屋主') || p.roles.has('潛在屋主'))
  )
  console.log(`  換屋客 (買方+屋主): ${swappers.length}`)

  // 共有人物件識別
  const multiOwnerProps = [...entrustRecs, ...prospectRecs].filter((r) => r.owners.length > 1)
  console.log(`  共有人物件: ${multiOwnerProps.length}`)

  // 物件數
  const properties = [...entrustRecs, ...prospectRecs]
  console.log(`  物件 (entrust + prospect): ${properties.length}`)

  // 買方需求數
  console.log(`  買方需求: ${buyerRecs.length}`)

  // ============================================================
  // 異常偵測
  // ============================================================
  const warnings = []

  // 同手機不同姓名
  const phoneToNames = new Map()
  for (const p of rawPersons) {
    if (!p.phone || !p.name) continue
    if (!phoneToNames.has(p.phone)) phoneToNames.set(p.phone, new Set())
    phoneToNames.get(p.phone).add(p.name)
  }
  for (const [phone, names] of phoneToNames) {
    if (names.size > 1) {
      warnings.push({
        type: 'same_phone_diff_names',
        phone,
        names: [...names],
      })
    }
  }

  // 缺名字
  const namelessProspect = prospectRecs.filter((r) => !r.property.name)
  const namelessEntrust = entrustRecs.filter((r) => !r.property.name)
  if (namelessProspect.length || namelessEntrust.length) {
    warnings.push({
      type: 'nameless_property',
      entrust_count: namelessEntrust.length,
      prospect_count: namelessProspect.length,
    })
  }

  // 共有人但只有一支電話（後續可能需要人工拆）
  const ambiguousOwners = [...entrustRecs, ...prospectRecs].filter(
    (r) => r.owners.length > 1 && r.owners[0]?.phone
  )
  if (ambiguousOwners.length) {
    warnings.push({
      type: 'multi_owners_one_phone',
      count: ambiguousOwners.length,
      examples: ambiguousOwners.slice(0, 5).map((r) => ({
        property: r.property.name,
        owners: r.owners.map((o) => o.name),
      })),
    })
  }

  console.log(`  ⚠ warnings: ${warnings.length} class(es)`)

  // ============================================================
  // 輸出
  // ============================================================
  const summary = {
    mode: EXECUTE ? 'execute' : 'dry-run',
    generated_at: new Date().toISOString(),
    counts: {
      old: {
        buyer: buyerPages.length,
        entrust: entrustPages.length,
        prospect: prospectPages.length,
        total: buyerPages.length + entrustPages.length + prospectPages.length,
      },
      new: {
        people_after_dedupe: mergedPeople.length,
        property: properties.length,
        buyer_need: buyerRecs.length,
      },
      derived: {
        raw_person_records: rawPersons.length,
        dedup_savings: rawPersons.length - mergedPeople.length,
        换屋客: swappers.length,
        共有人物件: multiOwnerProps.length,
      },
    },
    warnings,
    swappers_sample: swappers.slice(0, 10).map((p) => ({
      name: p.name,
      phone: p.phone,
      roles: [...p.roles],
      old_refs: p.oldRefs,
    })),
    multi_owners_sample: multiOwnerProps.slice(0, 10).map((r) => ({
      property: r.property.name || r.property.objectAddr || '(未命名)',
      owners: r.owners.map((o) => o.name),
    })),
  }

  const outPath = path.join(__dirname, '..', 'outputs', EXECUTE ? 'migration-result.json' : 'migration-preview.json')
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2), 'utf8')
  console.log('')
  console.log('Output:', outPath)
  console.log('')
  console.log('=== Summary ===')
  console.log(JSON.stringify(summary.counts, null, 2))
  if (warnings.length) {
    console.log('\n=== Warnings (need user review) ===')
    for (const w of warnings) {
      console.log(`  - ${w.type}: ${JSON.stringify(w).slice(0, 200)}`)
    }
  }

  if (!EXECUTE) {
    console.log('\n>>> This was DRY-RUN. No data written to Notion.')
    console.log('>>> To execute, re-run with: node scripts/migrate-to-new-schema.js --execute')
  } else {
    console.log('\n>>> NOTE: --execute mode not yet implemented in this Phase 1b script.')
    console.log('>>> Run dry-run first, get user approval, then I will fill in the write-back.')
  }
}

main().catch((err) => {
  console.error('\nERROR:', err.message)
  if (err.body) console.error('  body:', JSON.stringify(err.body))
  process.exit(1)
})
