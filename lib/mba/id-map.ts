import { pool } from './db'

/**
 * Phase 4.1c — backend writer 用：把舊買方 Notion DB 的 page id 翻成
 * 新 Person DB + 新 BuyerNeed DB 的 page id、給 INSERT viewings / conversations
 * 同時填新欄位、保持 dual-write。
 *
 * mapping 從 `notion_id_map` 表查（Phase 1c 搬遷時的 outputs/migration-result.json
 * 灌進來、153 列、見 scripts/_backfill-idmap.js）
 *
 * 行為：
 * - 輸入 id 在 map 命中 → 回 { personId, buyerNeedId }
 * - 沒命中（已經是新 person ID、或是未來新加的買方）→ 回 { personId: id, buyerNeedId: null }
 *   假設沒命中的 id 已經是 Person ID（Phase 4.2 frontend 切換後傳的就是新 ID）。
 *   萬一是錯的 id、INSERT 寫進去也不影響舊欄位、reader 雙端 fallback 也能讀
 */
export type IdMapResult = {
  personId: string
  buyerNeedId: string | null
  fromMap: boolean // true = 從 map 命中、false = 假設輸入已是 person ID
}

export async function lookupNewIds(inputId: string): Promise<IdMapResult> {
  if (!inputId) {
    return { personId: '', buyerNeedId: null, fromMap: false }
  }
  // forward (input 是舊 buyer ID)
  const fwd = await pool.query<{ new_person_id: string; new_buyer_need_id: string | null }>(
    'SELECT new_person_id, new_buyer_need_id FROM notion_id_map WHERE old_buyer_id = $1',
    [inputId]
  )
  if (fwd.rows.length > 0) {
    return {
      personId: fwd.rows[0].new_person_id,
      buyerNeedId: fwd.rows[0].new_buyer_need_id,
      fromMap: true,
    }
  }
  // reverse (input 已是新 person ID)、仍要找對應 buyer_need_id 寫進新欄位
  const rev = await pool.query<{ new_buyer_need_id: string | null }>(
    'SELECT new_buyer_need_id FROM notion_id_map WHERE new_person_id = $1',
    [inputId]
  )
  if (rev.rows.length > 0) {
    return {
      personId: inputId,
      buyerNeedId: rev.rows[0].new_buyer_need_id,
      fromMap: false,
    }
  }
  return { personId: inputId, buyerNeedId: null, fromMap: false }
}

/**
 * Phase 4.2 — 雙向 resolve：input 可能是 person ID 或 buyer ID、回傳兩種形式
 * 給 /api/clients/[id]/* 那種「PG 走 person、Notion 走 buyer」的 path 用
 */
export type ResolvedIds = {
  personId: string  // 給 PG 查 notion_person_id 用
  buyerNotionId: string  // 給 Notion API（blocks.children.append、pages.update）用
  buyerNeedId: string | null
  knownAsBuyer: boolean // input 是已知 buyer ID（在 map 的 old_buyer_id）
  knownAsPerson: boolean // input 是已知 person ID（在 map 的 new_person_id）
}

export async function resolveBothIds(inputId: string): Promise<ResolvedIds> {
  if (!inputId) {
    return {
      personId: '',
      buyerNotionId: '',
      buyerNeedId: null,
      knownAsBuyer: false,
      knownAsPerson: false,
    }
  }
  // forward map: input 當 buyer 查
  const fwd = await pool.query<{ new_person_id: string; new_buyer_need_id: string | null }>(
    'SELECT new_person_id, new_buyer_need_id FROM notion_id_map WHERE old_buyer_id = $1',
    [inputId]
  )
  if (fwd.rows.length > 0) {
    return {
      personId: fwd.rows[0].new_person_id,
      buyerNotionId: inputId,
      buyerNeedId: fwd.rows[0].new_buyer_need_id,
      knownAsBuyer: true,
      knownAsPerson: false,
    }
  }
  // reverse map: input 當 person 查
  const rev = await pool.query<{ old_buyer_id: string; new_buyer_need_id: string | null }>(
    'SELECT old_buyer_id, new_buyer_need_id FROM notion_id_map WHERE new_person_id = $1',
    [inputId]
  )
  if (rev.rows.length > 0) {
    return {
      personId: inputId,
      buyerNotionId: rev.rows[0].old_buyer_id,
      buyerNeedId: rev.rows[0].new_buyer_need_id,
      knownAsBuyer: false,
      knownAsPerson: true,
    }
  }
  // 兩邊都沒命中 = 未知 ID、可能是新加的買方還沒進 map、或者是直接從新 Person DB 開的
  // 兩者都回傳同 id、由 caller 決定走 PG（dual-read 仍能 fallback）還是 Notion
  return {
    personId: inputId,
    buyerNotionId: inputId,
    buyerNeedId: null,
    knownAsBuyer: false,
    knownAsPerson: false,
  }
}
