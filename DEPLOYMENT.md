# 部署指南 (Deployment Guide)

## Zeabur 部署步驟

### 前置準備

1. **GitHub 倉庫**
   - 將專案代碼推送到 GitHub
   - 確保 `.env.local` 和其他敏感文件在 `.gitignore` 中

2. **Notion 設置**
   - 完成所有 Notion 數據庫配置
   - 獲取所有必要的數據庫 ID
   - 記錄您的 Notion API Key

### 部署步驟

#### 1. 在 Zeabur 創建項目

1. 訪問 [zeabur.com](https://zeabur.com)
2. 登錄或創建帳戶
3. 點擊 "New Project"
4. 選擇 "Deploy from Git"

#### 2. 連接 GitHub

1. 授權 Zeabur 訪問您的 GitHub 帳戶
2. 選擇包含該項目的倉庫
3. 選擇要部署的分支（通常是 `main` 或 `master`）

#### 3. 配置環境變數

在 Zeabur 項目設置中，添加以下環境變數：

```
NOTION_API_KEY=your_internal_integration_token
NOTION_BUYER_DB_ID=your_database_id
NOTION_TODO_DB_ID=your_database_id
NOTION_TRACKING_DB_ID=your_database_id
NOTION_WEEKLY_DB_ID=your_database_id
NOTION_STRATEGY_DB_ID=your_database_id
NOTION_AI_IDEAS_DB_ID=your_database_id
NOTION_MAIN_PAGE_ID=32156ff9a8598091916ed853c177fa0f
```

#### 4. 部署

1. 回到項目頁面
2. 點擊 "Deploy"
3. 等待構建完成（通常需要 2-5 分鐘）
4. 構建完成後，您會得到一個公開 URL

#### 5. 驗證部署

1. 訪問提供的 URL
2. 檢查 `/setup` 頁面確認配置正確
3. 測試各個功能頁面

### 故障排除

#### 構建失敗

**症狀**：部署過程中出現錯誤

**解決方案**：
- 檢查 `package.json` 中的依賴版本是否兼容
- 確認所有 TypeScript 文件都有正確的類型定義
- 檢查構建日誌中的詳細錯誤信息

#### 環境變數問題

**症狀**：應用無法連接 Notion，顯示"未配置"消息

**解決方案**：
1. 驗證所有環境變數都已在 Zeabur 中設置
2. 檢查 API Key 和數據庫 ID 是否正確複製
3. 確認 Notion 集成有訪問所有必要數據庫的權限
4. 重新部署以應用環境變數更改

#### Notion 連接失敗

**症狀**：應用啟動但無法加載數據

**解決方案**：
1. 驗證 Notion API Key 是有效的內部集成令牌
2. 確認集成已與所有相關數據庫共享
3. 檢查數據庫 ID 是否正確且格式正確
4. 驗證數據庫列名與代碼中的期望匹配

### 自定義域名

1. 在 Zeabur 項目設置中找到 "Custom Domain" 部分
2. 輸入您的域名
3. 按照 DNS 配置說明操作
4. 驗證域名指向

### 環境變數管理最佳實踐

1. **安全性**
   - 永遠不要在代碼中提交敏感信息
   - 使用 `.env.example` 作為配置範本
   - 定期輪換 API Keys

2. **版本控制**
   - 將 `.env.local` 和 `.env.production` 添加到 `.gitignore`
   - 只在 Zeabur 項目設置中管理生產環境變數
   - 在 GitHub 上使用 Secrets 進行 CI/CD

3. **備份**
   - 記錄您的 Notion 數據庫 ID
   - 在安全位置保存您的 API Key
   - 定期備份 Notion 數據

### 監控和維護

#### 檢查應用狀態

1. 在 Zeabur 儀表板中查看實時日誌
2. 監控資源使用情況（CPU、內存）
3. 檢查任何運行時錯誤或警告

#### 更新部署

1. 推送更改到 GitHub
2. Zeabur 會自動檢測變更並重新部署
3. 查看部署歷史記錄以追蹤更新

#### 回滾

1. 如果最新部署有問題，進入 Zeabur 項目
2. 找到之前的成功部署版本
3. 點擊相應版本進行回滾

### 性能優化

1. **構建優化**
   - 使用 `npm run build` 測試本地構建
   - 確認所有依賴都是必需的
   - 定期更新依賴以獲得性能改進

2. **運行時優化**
   - Next.js 自動進行代碼分割
   - 考慮添加緩存層（如果流量很大）
   - 監控 Notion API 調用以避免速率限制

3. **數據庫性能**
   - 定期整理 Notion 數據庫
   - 為常見查詢使用篩選條件
   - 考慮對大型數據集進行分頁

### 常見問題 (FAQ)

**Q: 如何更新環境變數？**
A: 在 Zeabur 項目設置中編輯環境變數，然後重新部署應用。

**Q: 我可以使用免費的 Zeabur 計畫嗎？**
A: 是的，該應用適合免費計畫。如果流量增加，可以升級。

**Q: 如何監控應用性能？**
A: 使用 Zeabur 儀表板中的日誌和指標標籤進行監控。

**Q: 應用會自動更新嗎？**
A: 當您推送到 GitHub 時，Zeabur 會自動重新部署（如果已配置自動部署）。

**Q: 數據存儲在哪裡？**
A: 所有數據存儲在您的 Notion 工作區。應用只是作為前端接口使用。

### 聯繫支持

- Zeabur 支持：https://zeabur.com/support
- Notion API 文檔：https://developers.notion.com
