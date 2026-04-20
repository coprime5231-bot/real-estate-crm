# GOTCHAS

這份文件記錄踩過的坑，避免未來重蹈覆轍。每條 gotcha 用 `G<編號>` 編號。

---

## G15: Tampermonkey userscript 跟頁面 postMessage 必須走 unsafeWindow

**踩坑日期**：2026-04-19（B6 userscript 上線後整天繞）

**症狀**：userscript `@grant GM_xmlhttpRequest`、用 `window.postMessage` + `window.addEventListener('message')` 跟頁面握手，console 有 `userscript loaded` log、但頁面 postMessage 送出的 PING 永遠收不到 PONG 回應。

**根因**：Tampermonkey 把 userscript 跑在 `chrome-extension://.../userscript.html` 的沙箱 iframe context，沙箱裡的 `window` 是 proxy，`postMessage` 不會跨到頁面真實 window。

**修法**：
- `@grant unsafeWindow`
- 跨 context 的 postMessage / addEventListener('message') 一律改用：
  ```javascript
  const pageWindow = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  pageWindow.postMessage(...);
  pageWindow.addEventListener('message', ...);
  ```
- `event.source !== window` 的 filter 也要同步改成 `event.source !== pageWindow`，否則所有訊息會被濾掉
- **純 DOM 操作（querySelector、click、innerHTML 等）不受影響**，照常用 `document` / `window`

**適用範圍**：任何 B 系列、SOP 系列 userscript，只要有 `CRM ↔ userscript` 雙向握手就要套這規則。

---

## G16: i智慧 API 響應 envelope 的 `id` 不是 caseId（B6 reg 兩次）

**踩坑日期**：2026-04-19（v0.2.0）、2026-04-20（v0.4.1 重新踩一次）

**症狀**：B6 搜尋物件編號 → resolve 出一個 UUID → 打 `/api/Case/Info/Detail/<uuid>` 回 `data: null`，社區/樓層/地點全部帶不進來。

**根因**：`/api/Case/Circulating/List` 回應是 JSON-RPC-like envelope：
```json
{ "id": "6fab4a63-...", "apiVersion": "...", "method": "...", "status": "...",
  "data": { "items": [ { "caseKey": "bdb37729-...", ... } ], "total": N } }
```
最外層的 `id` 是**響應 metadata**（每次 request 不一樣），跟 case 無關。真正的 caseId 藏在 `data.items[0].caseKey`。

resolveCaseUuid 當時有 deep-scan fallback：找不到明確 key 就遞迴掃整包回應第一個 UUID，結果永遠先命中外層 `id`。Detail API 拿這個假 UUID 打 → 查無此案 → `data: null`。

**修法（v0.4.3 定案）**：
- 取值範圍嚴格限制 `data.items[0]`
- 只用 `pickShallow`，key list = `['caseKey', 'CaseKey', 'caseId', 'CaseId', 'caseUuid', 'CaseUuid', 'caseGuid', 'CaseGuid']`（**不含** bare `id/Id/uuid/Uuid/guid/Guid`）
- **禁止** deep scan（`findUuid` helper 整個砍掉，避免未來再誤用）
- **禁止** envelope fallback（`findUuid(searchResp)` 絕對不要）
- pickShallow 全 miss → 直接 `throw 'case_not_found'`，不 fall through、不塞假 UUID 給後續 API

**驗收**：編號 `0172497` → resolved UUID 應 = `bdb37729-7934-4ee1-b5eb-7c78a391b49f`（不是 `6fab4a63-...`）。

**適用範圍**：所有 B 系列 userscript 打 i智慧 API 的 UUID resolve 邏輯。寫新 endpoint 時，先確認 response shape 的 envelope 有沒有 `id` 欄位；有的話 deep scan / findUuid 一律不准用。

---

## G17: Notion「待辦」checkbox 語意是標準語意，不要被欄位名誤導

**踩坑日期**：2026-04-20（登入誤報 bug 之後、使用者發現 toggle 方向整個反了）

**症狀**：CRM dashboard 打勾完成待辦 → Notion 那邊 checkbox 變空白。使用者直覺「打勾 = 完成」但系統做反了。

**根因**：欄位名叫「待辦」，前人把它當 pending flag 設計（待辦=true → pending），整條 code path（POST 預設 true、GET filter true、PATCH 送 false 完成）都是反語意。但使用者實際用法是標準語意：
- ✅ 打勾（`待辦=true`）= done / 完成
- ⬜ 空白（`待辦=false`）= pending / 還沒做
- Notion view filter：「待辦 is not checked」只顯示 pending

**修法（commit 210b4ee 後續）**：全 repo 三處翻過來——
1. 新增待辦（POST）預設 `待辦=false`
2. Dashboard GET filter `待辦=false` 只列 pending
3. PATCH 打勾完成 → 設 `待辦=true`
4. 前端 Tab 1 UI 的 `todoFlag` 圖示/刪除線/badge 條件全翻
5. `handleToggleTodo` 的 `if (currentFlag)` → `if (!currentFlag)`（「本來是 pending 才從 dashboard 移除」）

**適用範圍**：任何新寫會動到 `NOTION_TODO_DB_ID` 的 route / component 都要用「打勾=done」的標準語意。不要看欄位名「待辦」就以為 true=pending——那是歷史 bug 殘留。
