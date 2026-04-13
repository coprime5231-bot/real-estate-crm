# 項目文件結構 (File Structure)

## 完整文件樹

```
crm-project/
├── app/                          # Next.js App Router
│   ├── api/                      # API 路由 (Notion 集成)
│   │   ├── ai-projects/
│   │   │   └── route.ts         # AI 專案端點
│   │   ├── clients/
│   │   │   ├── [id]/
│   │   │   │   └── route.ts     # 更新客戶 (PATCH)
│   │   │   └── route.ts         # 獲取所有客戶
│   │   ├── properties/
│   │   │   └── route.ts         # 獲取追蹤物件
│   │   ├── setup/
│   │   │   └── route.ts         # 檢查設置狀態
│   │   ├── todos/
│   │   │   └── route.ts         # 獲取任務
│   │   ├── videos/
│   │   │   └── route.ts         # 獲取影片
│   │   └── weekly/
│   │       └── route.ts         # 獲取週報
│   │
│   ├── ai/
│   │   └── page.tsx             # AI 項目頁面
│   ├── marketing/
│   │   └── page.tsx             # 客戶管理頁面
│   ├── setup/
│   │   └── page.tsx             # 設置檢查頁面
│   ├── videos/
│   │   └── page.tsx             # 影片管理頁面
│   │
│   ├── globals.css              # 全局樣式
│   ├── layout.tsx               # 根佈局
│   └── page.tsx                 # 儀表板頁面 (開發)
│
├── components/                  # React 組件
│   ├── ClientDetailModal.tsx    # 客戶詳情模態框
│   ├── Navigation.tsx           # 導航欄 (桌面/移動)
│   └── SetupRequired.tsx        # 設置提示組件
│
├── lib/                         # 實用工具
│   ├── notion.ts               # Notion API 工具和類型
│   └── types.ts                # TypeScript 類型定義
│
├── public/                      # 靜態資源
│   └── .gitkeep
│
├── 配置文件
│   ├── .env.example            # 環境變數示例
│   ├── .gitignore              # Git 忽略規則
│   ├── next.config.js          # Next.js 配置
│   ├── package.json            # 依賴和腳本
│   ├── postcss.config.js       # PostCSS 配置
│   ├── tailwind.config.js      # Tailwind CSS 配置
│   ├── tsconfig.json           # TypeScript 配置
│   └── zeabur.json             # Zeabur 部署配置
│
└── 文檔文件
    ├── README.md               # 項目介紹和使用說明
    ├── QUICKSTART.md           # 快速開始 (5分鐘)
    ├── SETUP.md                # 詳細設置指南
    ├── DEPLOYMENT.md           # Zeabur 部署指南
    └── FILE_STRUCTURE.md       # 此文件
```

## 文件說明

### API 路由 (`app/api/`)

| 文件 | 用途 | 方法 |
|------|------|------|
| `clients/route.ts` | 獲取所有客戶 | GET |
| `clients/[id]/route.ts` | 更新特定客戶 | PATCH |
| `properties/route.ts` | 獲取追蹤物件 | GET |
| `weekly/route.ts` | 獲取週報數據 | GET |
| `todos/route.ts` | 獲取任務列表 | GET |
| `videos/route.ts` | 獲取影片 | GET |
| `ai-projects/route.ts` | 獲取AI項目 | GET |
| `setup/route.ts` | 檢查設置狀態 | GET |

### 頁面 (`app/`)

| 文件 | 路由 | 功能 |
|------|------|------|
| `page.tsx` | `/` | 儀表板 (開發) |
| `marketing/page.tsx` | `/marketing` | 行銷/CRM |
| `videos/page.tsx` | `/videos` | 短影音管理 |
| `ai/page.tsx` | `/ai` | AI 項目追蹤 |
| `setup/page.tsx` | `/setup` | 設置檢查 |

### 組件 (`components/`)

| 文件 | 描述 |
|------|------|
| `Navigation.tsx` | 頂部和底部導航欄 |
| `ClientDetailModal.tsx` | 客戶詳情彈窗 |
| `SetupRequired.tsx` | 設置提示UI |

### 工具库 (`lib/`)

| 文件 | 內容 |
|------|------|
| `notion.ts` | Notion API 客戶端、類型和工具函數 |
| `types.ts` | TypeScript 接口定義 |

### 配置文件

| 文件 | 用途 |
|------|------|
| `package.json` | 項目元數據、依賴和腳本 |
| `.env.example` | 環境變數模板 |
| `tsconfig.json` | TypeScript 編譯器選項 |
| `next.config.js` | Next.js 配置 |
| `tailwind.config.js` | Tailwind CSS 主題 |
| `postcss.config.js` | PostCSS 處理器配置 |
| `zeabur.json` | Zeabur 部署設置 |
| `.gitignore` | Git 忽略規則 |

## 代碼統計

```
總行數: ~3,100 行
TypeScript/TSX: 65%
CSS: 10%
JSON: 10%
Markdown: 15%
```

## 快速導航

### 修改客戶 UI
- `components/ClientDetailModal.tsx` - 客戶詳情表單
- `app/marketing/page.tsx` - 客戶列表和過濾

### 添加新數據庫字段
1. 編輯 `lib/notion.ts` 中的類型接口
2. 更新對應的 API 路由
3. 修改相關組件的 UI

### 修改樣式
- `app/globals.css` - 全局樣式
- `tailwind.config.js` - 主題顏色和配置
- 各組件文件中的 className

### 修改導航
- `components/Navigation.tsx` - 標籤和路由定義

## 項目依賴

### 運行時依賴
```json
{
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "next": "^14.2.0",
  "tailwindcss": "^3.4.1",
  "postcss": "^8.4.38",
  "autoprefixer": "^10.4.17",
  "@notionhq/client": "^2.2.13",
  "lucide-react": "^0.408.0"
}
```

### 開發依賴
```json
{
  "typescript": "^5.4.2",
  "@types/node": "^20.12.7",
  "@types/react": "^18.3.1",
  "@types/react-dom": "^18.3.0"
}
```

## 環境變數

必需的環境變數（在 `.env.local` 中設置）：

```
NOTION_API_KEY                # Notion 內部集成令牌
NOTION_BUYER_DB_ID            # 買家資料庫 ID
NOTION_TODO_DB_ID             # 任務資料庫 ID
NOTION_TRACKING_DB_ID         # 追蹤資料庫 ID
NOTION_WEEKLY_DB_ID           # 週報資料庫 ID
NOTION_STRATEGY_DB_ID         # 策略資料庫 ID
NOTION_AI_IDEAS_DB_ID         # AI想法資料庫 ID
NOTION_MAIN_PAGE_ID           # 主頁面 ID (可選)
```

## 建議的編輯順序

如果要修改應用：

1. **修改數據結構** → `lib/types.ts`
2. **更新 API** → `app/api/*/route.ts`
3. **修改 UI** → `app/*/page.tsx` 或 `components/*.tsx`
4. **調整樣式** → `app/globals.css`

## 常見修改

### 添加新的選擇字段
```typescript
// 1. 在 lib/notion.ts 中添加類型
// 2. 在 API 路由中映射字段
// 3. 在組件中添加選擇菜單
```

### 修改導航標籤
編輯 `components/Navigation.tsx` 中的 `tabs` 數組

### 修改顏色主題
編輯 `tailwind.config.js` 的 `theme.extend.colors`

---

更多信息請參考 README.md 或特定的設置指南。
