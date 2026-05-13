# Phase 3 完工狀態與 3.7 deferred 紀錄（2026-05-13）

## 已完成
- 3.1 三條新 schema 寫回 API（people / buyer-needs / properties-v2 POST + PATCH）
- 3.2a DDL 套用（viewings.notion_person_id / notion_buyer_need_id、conversations.notion_person_id + index）
- 3.2b/c backfill：viewings 24 列、conversations 5 列、缺 mapping 0、新欄位 1:1 完美對應
- /entrust 委託管理頁從 placeholder 升級到實作版

## 3.7 暫不執行：舊 `notion_buyer_id` 仍有讀者
原 SQL 規劃寫「Phase 3.7 確認沒人讀才砍」，盤點後讀者清單：

| 檔案 | 讀寫類型 |
|------|---------|
| `lib/types.ts` (Viewing/Conversation interface) | type schema |
| `app/api/viewings/route.ts` | INSERT/READ |
| `app/api/viewings/[id]/route.ts` | UPDATE |
| `app/api/conversations/route.ts` | INSERT |
| `app/api/conversations/[id]/route.ts` | UPDATE |
| `app/api/clients/[id]/conversations/route.ts` | filter |
| `app/api/clients/[id]/viewings/route.ts` | filter |
| `app/api/clients/[id]/quick-log/route.ts` | INSERT |
| `app/api/m/tasks/viewing/route.ts` | filter |

連 frontend `components/ClientViewingsTab.tsx`、`ConversationCard.tsx`、`marketing/page.tsx` 等 27 個檔都還在傳/讀舊 buyer ID。

## 3.7 真正執行條件 = 一輪 readers refactor
- backend：把 `WHERE notion_buyer_id = $1` 全部改成 `WHERE notion_person_id = $1`（input 改傳新 person ID）
- frontend：所有原本傳舊 buyer DB ID 的 hook / param 改成傳新 Person DB ID
- types：`Viewing.notion_buyer_id` / `Conversation.notion_buyer_id` 改名為 `notion_person_id`
- 跑過上線、觀察一週確認沒人 fallback 舊欄位
- 最後 `ALTER TABLE viewings DROP COLUMN notion_buyer_id; ALTER TABLE conversations DROP COLUMN notion_buyer_id;`

這條 readers refactor 範圍跨 9+ API + 多個 frontend 元件、應視為獨立 Phase 4，不在「完成 Phase 3」的當下範圍內。

## 目前可安全併存的狀態
- 舊欄位 `notion_buyer_id` 保留、舊 API 繼續用、不擋現有功能
- 新欄位已 backfill、新 API + /entrust 已切換到新 Person/Property/BuyerNeed DB
- 兩條軌平行運行、彼此不會誤寫對方的欄位（POST 路徑分開）

## 3.2 一次性 helper script
`scripts/_upload-and-backfill.js` + `scripts/_verify-backfill.js` 是透過 Next.js container 跳 PG 的 jump-box（PG service exec 524 中），執行完任務即可，commit 留檔備查。
