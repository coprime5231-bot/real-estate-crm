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
