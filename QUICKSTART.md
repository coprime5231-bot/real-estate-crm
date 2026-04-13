# 快速開始指南 (Quick Start)

新手用戶的30分鐘設置指南。

## 必要項目清單

- [ ] Node.js 18+ 已安裝
- [ ] Notion 帳戶（免費版就足夠）
- [ ] GitHub 帳戶（用於Zeabur部署）
- [ ] 文本編輯器（VS Code推薦）

## 5分鐘：獲取Notion API密鑰

### 步驟 1-5 分鐘

```bash
# 1. 打開瀏覽器訪問
https://www.notion.so/my-integrations

# 2. 點擊 "Create new integration"

# 3. 輸入名稱：房仲CRM

# 4. 選擇您的Workspace

# 5. 點擊 "Create integration"

# 6. 複製 "Internal Integration Token"
# 示例：ntn_xxx...xxx
```

**保存該令牌！** 您稍後需要它。

## 10分鐘：快速創建Notion數據庫

### 一鍵式數據庫創建

以下是創建最小可行設置的快速方法：

```
買家資料庫
├─ 名稱 (Title)
├─ 手機 (Rich Text)
├─ 等級 (Select: A級/B級/C級)
└─ 下次跟進 (Date)

週報資料庫
├─ 日期 (Date)
└─ 看房次數 (Number)

（其他數據庫可以為空，應用會處理）
```

### 快速獲取數據庫ID

對於每個數據庫：
1. 打開數據庫 → URL:
   ```
   notion.so/xxx/YOUR_ID?v=yyy
   ```
2. 複製 `YOUR_ID` (32個字符)
3. 保存到安全地方

## 5分鐘：本地設置

```bash
# 1. 克隆或下載項目
git clone <repo-url>
cd crm-project

# 2. 安裝
npm install

# 3. 創建配置文件
cp .env.example .env.local

# 4. 編輯 .env.local 並填寫：
# NOTION_API_KEY=ntn_您的令牌
# NOTION_BUYER_DB_ID=您的ID
# NOTION_WEEKLY_DB_ID=您的ID
# （其他字段為可選）

# 5. 運行
npm run dev
```

訪問 `http://localhost:3000`

## 快速檢查清單

- [ ] API Key已設置
- [ ] 數據庫ID已設置
- [ ] 集成已與數據庫共享
- [ ] 頁面加載無錯誤
- [ ] 可以看到 /setup 頁面顯示"設置完成"

## 常見問題快速答案

**Q: 所有數據庫都是必需的嗎？**
A: 不，只需買家和週報。其他是可選的。

**Q: 我沒有集成權限？**
A: 您需要是Notion工作區的所有者。

**Q: API Key在哪裡找到？**
A: https://www.notion.so/my-integrations → 您的集成 → Secrets

**Q: 應用無法加載？**
A: 檢查環境變數是否正確。訪問 http://localhost:3000/setup 進行診斷。

## 下一步

1. **本地測試** → 在Notion中添加一些客戶
2. **檢查功能** → 訪問所有頁面驗證數據
3. **部署** → 推送到GitHub並部署到Zeabur

## 完整設置指南

詳細說明請見 `SETUP.md`

## 部署指南

部署說明請見 `DEPLOYMENT.md`

---

**就是這樣！** 現在您有一個完整的房仲CRM應用！ 🎉
