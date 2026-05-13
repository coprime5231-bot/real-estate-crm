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

export async function lookupNewIds(inputBuyerId: string): Promise<IdMapResult> {
  if (!inputBuyerId) {
    return { personId: '', buyerNeedId: null, fromMap: false }
  }
  const r = await pool.query<{ new_person_id: string; new_buyer_need_id: string | null }>(
    'SELECT new_person_id, new_buyer_need_id FROM notion_id_map WHERE old_buyer_id = $1',
    [inputBuyerId]
  )
  if (r.rows.length > 0) {
    return {
      personId: r.rows[0].new_person_id,
      buyerNeedId: r.rows[0].new_buyer_need_id,
      fromMap: true,
    }
  }
  return { personId: inputBuyerId, buyerNeedId: null, fromMap: false }
}
