# Phase 7 認賠回滾 — schema 統整與 DB 搬遷規劃（2026-05-13）

## 北極星

- CRM/MBA UI 是主、Notion DB / n8n 都配合（[[project_crm_is_source_of_truth]]）
- Solo realtor 不需要 industry-standard 三層拆分（[[feedback_solo_realtor_avoid_team_schema]]）
- 命名一致：買方→行銷、新募極限→開發、追蹤與委託→開發-archive

## 三個 Notion DB 現況

### 買方 (28e56ff9) → rename 行銷
- 78 列、現有 21 props、已有 `狀態 (status)`、`日期 (date 下次跟進)`、`客戶等級 select`、`預算 select`、`區域 multi_select`、`格局 multi_select`、`需求 rich_text`、`需求標籤 multi_select`、`手機 phone`、`生日 date`、`NOTE`、`最近進展`、`待辦事項 relation → 32056ff9`、`重要大事 relation → 32156ff9`、`上次編輯時間`、`文字ID formula`、`Place place`、`id unique_id`、`名稱 title`、`負責人 people`、`檔案 files`
- **缺**：`成交日期 date`

### 新募極限 (30156ff9) → rename 開發
- 24 列、現有 17 props：`名稱 title`、`屋主 rich_text`、`物件 rich_text`、`戶藉地址 rich_text`、`物信 rich_text`、`戶信 rich_text`、`坪數 rich_text`、`主建物 rich_text`、`格局 rich_text`、`車位 multi_select`、`開價 rich_text`、`待辦 select [物件地拜訪, 戶藉地拜訪, 物件地覆訪, 戶藉地覆訪]`、`已同步 select`、`開發信 checkbox`、`開發進度 multi_select`、`建立時間`、`最後編輯時間`
- **缺**（為了 lifecycle + 收容 28d56ff9 搬遷資料）：
  1. `狀態 select [募集, 追蹤, 委託, 成交, 過期]`
  2. `成交日期 date`
  3. `委託到期日 date`
  4. `重要事項 rich_text`
  5. `物件地址 rich_text`（區別於現有「物件」= 物件名）
  6. `網頁 url`
  7. `手機 phone_number`（屋主聯絡）
  8. `客戶等級 select [A級, B級, C級]`（屋主分級）
  9. `身份證字號 rich_text`
  10. `委託 files`
  11. `謄本 files`
  12. `待辦事項 relation → 32056ff9`
  13. `本周重要大事 relation → 32156ff9`

### 追蹤與委託 (28d56ff9) → rename 開發-archive（搬完冷凍）
- 23 列、現有 17 props：`名稱 title`、`屋主 rich_text`、`物件地址 rich_text`、`客戶等級 select [A,B,C級]`、`手機 phone`、`身份證字號 rich_text`、`委託到期日 date`、`重要事項 rich_text`、`狀態 select [追蹤, 委託, 過期, 成交]`、`委託 files`、`謄本 files`、`網頁 url`、`✅ 待辦事項 relation → 32056ff9`、`📢 本周重要大事 relation → 32156ff9`、`建立時間`、`文字ID formula`、`ID unique_id`

## 搬遷 mapping (28d56ff9 → 30156ff9)

| 28d56ff9 欄 | 30156ff9 欄 | 備註 |
|---|---|---|
| 名稱 (title) | 名稱 (title) | |
| 屋主 (rich_text) | 屋主 (rich_text) | 同名直 map |
| 物件地址 (rich_text) | 物件地址 (rich_text) | 新加欄 |
| 客戶等級 (select) | 客戶等級 (select) | 新加欄、選項 A/B/C 級 |
| 手機 (phone) | 手機 (phone) | 新加欄 |
| 身份證字號 (rich_text) | 身份證字號 (rich_text) | 新加欄 |
| 委託到期日 (date) | 委託到期日 (date) | 新加欄 |
| 重要事項 (rich_text) | 重要事項 (rich_text) | 新加欄 |
| 狀態 (select) | 狀態 (select) | 新加欄、選項 [募集, 追蹤, 委託, 成交, 過期]、直接 map 值 |
| 委託 (files) | 委託 (files) | 新加欄 |
| 謄本 (files) | 謄本 (files) | 新加欄 |
| 網頁 (url) | 網頁 (url) | 新加欄 |
| ✅ 待辦事項 (relation) | 待辦事項 (relation) | 新加 relation、ids 跟著搬 |
| 📢 本周重要大事 (relation) | 本周重要大事 (relation) | 新加 relation、ids 跟著搬 |
| 文字ID (formula) | ✗ | formula derived、不搬 |
| ID (unique_id) | ✗ | Notion 自動、不搬 |
| 建立時間 (created_time) | ✗ | Notion 自動、不能寫 |

新建頁時不必填的：`物信`、`戶信`、`戶藉地址`、`坪數`、`主建物`、`格局`、`車位`、`開價`、`待辦`、`已同步`、`開發信`、`開發進度` — 28d56ff9 沒有對應、留空、user 之後可以手動補。

## 30156ff9 既有 24 列的 status 預設

24 列既有 row 沒有「狀態」欄、加完欄後預設全填「募集」（這 24 筆都是潛在屋主 / 開發信階段）。

## /entrust 頁面對應

| UI tab | 篩選條件 |
|---|---|
| 開發信 | `狀態 = 募集` AND `成交日期 IS EMPTY` |
| 追蹤 | `狀態 = 追蹤` AND `成交日期 IS EMPTY` |
| 委託 | `狀態 = 委託` AND `成交日期 IS EMPTY` AND（option：委託到期日 ≥ today）|

「成交客戶」與「過期」可未來另開 tab / sidebar。

## 28d56ff9 archive 處理

- 搬完後不動 row（保留歷史）
- 把 DB title 從「追蹤與委託」改成「開發-archive」、提示 user 看不到 = OK
- 程式碼端 `NOTION_TRACKING_DB_ID` env var 留著但不再讀
