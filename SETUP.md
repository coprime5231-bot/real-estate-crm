# 初始設置指南 (Initial Setup Guide)

## 概述

本指南將幫您逐步配置房仲CRM應用程式，使其能夠連接到您的Notion工作區。

## 第一步：準備Notion工作區

### 1.1 創建Notion集成

1. 訪問 [Notion Integrations Page](https://www.notion.so/my-integrations)
2. 點擊頁面頂部的 "Create new integration" 按鈕
3. 為您的集成起一個名稱，例如：`房仲CRM`
4. 確保選擇了正確的 Workspace
5. 點擊 "Create integration"
6. 在下一個頁面上，找到 "Secrets" 部分
7. **複製** "Internal Integration Token"（這很重要！）
8. 將其保存到文本編輯器中，暫時使用

![備註：實際應用中會看到令牌]

### 1.2 驗證集成權限

1. 在集成頁面上，向下滾動到 "Capabilities" 部分
2. 確保已啟用以下權限：
   - Read content
   - Update content
   - Create pages in a database
3. 點擊 "Save changes"

## 第二步：創建Notion數據庫

### 2.1 創建買家資料庫

1. 在Notion中創建一個新的數據庫頁面
2. 命名為 `買家` 或 `Buyers`
3. 添加以下列（按此順序）：

| 列名 | 類型 | 說明 |
|------|------|------|
| 名稱 | Title | 客戶名稱 |
| 手機 | Rich Text | 聯繫電話 |
| NOTE | Rich Text | 備註和備忘錄 |
| 最近進展 | Rich Text | 最新跟進信息 |
| 等級 | Select | 選項: A級, B級, C級 |
| 來源 | Select | 來源渠道 |
| 預算 | Rich Text | 購買預算 |
| 需求 | Rich Text | 客戶需求 |
| 區域 | Rich Text | 目標區域 |
| 下次跟進 | Date | 下次跟進日期 |

**保存此數據庫的ID**（見 2.7）

### 2.2 創建任務資料庫

1. 創建新數據庫，命名為 `任務` 或 `Tasks`
2. 添加以下列：

| 列名 | 類型 |
|------|------|
| 名稱 | Title |
| 完成 | Checkbox |
| 客戶 | Relation to 買家 |

### 2.3 創建追蹤與委託資料庫

1. 創建新數據庫，命名為 `追蹤與委託` 或 `Tracking`
2. 添加以下列：

| 列名 | 類型 |
|------|------|
| 名稱 | Title |
| 地址 | Rich Text |
| 價格 | Rich Text |
| 狀態 | Select |

### 2.4 創建週報資料庫

1. 創建新數據庫，命名為 `週報` 或 `Weekly`
2. 添加以下列：

| 列名 | 類型 |
|------|------|
| 日期 | Date |
| 看房次數 | Number |
| 進展摘要 | Rich Text |

### 2.5 創建策略資料庫

1. 創建新數據庫，命名為 `策略` 或 `Strategy`
2. 添加以下列：

| 列名 | 類型 |
|------|------|
| 名稱 | Title |
| 狀態 | Select（選項: planning, filming, published） |
| 瀏覽次數 | Number |

### 2.6 創建AI想法資料庫

1. 創建新數據庫，命名為 `AI想法` 或 `AI Ideas`
2. 添加以下列：

| 列名 | 類型 |
|------|------|
| 名稱 | Title |
| 狀態 | Select（選項: idea, building, done） |
| 平台 | Multi-select（選項: N8N, Claude, GPT, API） |

### 2.7 獲取數據庫ID

對於每個數據庫：

1. 在Notion中打開數據庫
2. 查看瀏覽器URL欄
3. URL格式應為：`https://notion.so/workspace/YOUR_DATABASE_ID?v=xyz`
4. 複製 `YOUR_DATABASE_ID`（32個字符的字符串）
5. 將其保存到安全位置

**所需的數據庫ID：**
- `NOTION_BUYER_DB_ID` - 買家資料庫
- `NOTION_TODO_DB_ID` - 任務資料庫
- `NOTION_TRACKING_DB_ID` - 追蹤資料庫
- `NOTION_WEEKLY_DB_ID` - 週報資料庫
- `NOTION_STRATEGY_DB_ID` - 策略資料庫
- `NOTION_AI_IDEAS_DB_ID` - AI想法資料庫

### 2.8 與集成共享數據庫

對於每個數據庫：

1. 打開數據庫
2. 點擊右上角的 "Share" 按鈕
3. 點擊 "Invite"
4. 在搜索框中輸入您的集成名稱（`房仲CRM`）
5. 選擇集成並點擊
6. 確保已授予 "Can edit" 權限
7. 點擊 "Invite"

**重複此步驟，直到所有數據庫都與集成共享。**

## 第三步：配置本地環境

### 3.1 克隆項目

```bash
git clone <your-repo-url>
cd crm-project
```

### 3.2 安裝依賴

```bash
npm install
```

### 3.3 創建環境文件

```bash
cp .env.example .env.local
```

### 3.4 填寫環境變數

編輯 `.env.local` 並填寫您之前收集的值：

```
NOTION_API_KEY=ntn_your_internal_integration_token_here
NOTION_BUYER_DB_ID=your_buyer_database_id
NOTION_TODO_DB_ID=your_todo_database_id
NOTION_TRACKING_DB_ID=your_tracking_database_id
NOTION_WEEKLY_DB_ID=your_weekly_database_id
NOTION_STRATEGY_DB_ID=your_strategy_database_id
NOTION_AI_IDEAS_DB_ID=your_ai_ideas_database_id
NOTION_MAIN_PAGE_ID=32156ff9a8598091916ed853c177fa0f
```

**重要：** 確保沒有空格，值正確無誤。

## 第四步：測試本地開發

### 4.1 啟動開發服務器

```bash
npm run dev
```

服務器將在 `http://localhost:3000` 上運行。

### 4.2 訪問設置頁面

1. 打開瀏覽器，訪問 `http://localhost:3000/setup`
2. 頁面應該顯示 "設置完成" 消息
3. 如果顯示缺少配置，檢查：
   - 環境變數是否正確複製
   - 數據庫ID是否有效
   - 集成是否與所有數據庫共享

### 4.3 測試功能

1. **開發頁面** (`http://localhost:3000`)
   - 應該顯示收入目標進度條
   - 應該顯示週報數據
   - 應該顯示追蹤的物件

2. **行銷頁面** (`http://localhost:3000/marketing`)
   - 應該加載並顯示所有客戶
   - 應該能點擊客戶卡片打開詳情
   - 應該能編輯並保存客戶信息

3. **短影音頁面** (`http://localhost:3000/videos`)
   - 應該顯示所有影片想法
   - 應該能按狀態過濾

4. **AI頁面** (`http://localhost:3000/ai`)
   - 應該顯示所有AI項目
   - 應該能按狀態過濾

## 第五步：添加測試數據

### 5.1 在Notion中添加測試數據

1. 打開買家資料庫
2. 創建一個新記錄：
   - 名稱：張三
   - 手機：0912345678
   - 等級：A級
   - 區域：台北信義
   - 預算：800-1000萬
   - 下次跟進：明天的日期

3. 在應用中驗證數據是否加載

### 5.2 測試編輯功能

1. 在應用的行銷頁面上打開客戶詳情
2. 點擊 "編輯" 按鈕
3. 修改一個字段（例如，備註）
4. 點擊 "保存"
5. 返回Notion驗證更改是否同步

## 故障排除

### 問題：無法連接到Notion

**可能的原因：**
1. API Key 無效
2. 集成令牌已過期
3. 集成不具有所需的權限

**解決方案：**
1. 驗證您複製的是"內部集成令牌"，不是OAuth Client ID
2. 檢查集成是否仍處於活動狀態
3. 在集成設置中驗證所有必需的功能都已啟用

### 問題：無法找到數據庫

**可能的原因：**
1. 數據庫ID不正確
2. 集成不與該數據庫共享
3. 列名不匹配

**解決方案：**
1. 仔細驗證每個數據庫ID（應為32個字符）
2. 檢查集成是否與該數據庫共享
3. 確認所有列都按照指南名稱和類型設置

### 問題：應用加載但顯示為空

**可能的原因：**
1. Notion數據庫為空
2. 客戶端未連接到Notion
3. 列名大小寫不匹配

**解決方案：**
1. 在Notion中添加一些測試數據
2. 檢查瀏覽器控制台是否有錯誤
3. 訪問 `/setup` 頁面進行診斷

### 問題：編輯和保存不起作用

**可能的原因：**
1. 集成不具有編輯権限
2. 頁面ID配置不正確

**解決方案：**
1. 驗證集成在所有數據庫中都具有"可編輯"權限
2. 檢查瀏覽器控制台中的API錯誤

## 下一步

1. ✓ 本地開發已設置
2. ✓ 功能已測試
3. → 準備部署到Zeabur（見 DEPLOYMENT.md）

## 獲取幫助

如果遇到問題，請檢查：
1. 控制台中的錯誤消息（按 F12 打開開發者工具）
2. Notion Integration設置
3. 環境變數是否正確設置
4. 此指南中的故障排除部分

---

完成所有步驟後，您的房仲CRM應用程式應該完全正常運作！
