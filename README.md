# 房仲CRM - Real Estate Agent CRM

A modern, full-featured CRM system for real estate agents built with Next.js 14 and Notion API integration.

## Features

- **開發 Dashboard**: Revenue tracking, weekly showing metrics, property tracking, and countdown timer
- **行銷 CRM**: Client management with grades (A/B/C), detailed profiles, follow-up scheduling, and overdue alerts
- **短影音 Management**: Video content tracking with status (planning/filming/published) and view counts
- **AI Projects**: AI automation project tracking with platform tags and status management
- **Notion Integration**: Real-time sync with Notion databases, two-way data updates
- **Dark Modern UI**: Professional dark theme with Tailwind CSS and responsive design
- **Mobile Ready**: Optimized for mobile with bottom navigation and responsive layout

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **Styling**: Tailwind CSS 3.4
- **UI Components**: Lucide React icons
- **API**: Notion API (@notionhq/client)
- **Deployment**: Zeabur ready

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Notion workspace with databases set up

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd crm-project
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env.local
```

4. Configure your Notion databases (see Setup Guide below)

5. Run the development server
```bash
npm run dev
```

Visit `http://localhost:3000` to see the application.

## Setup Guide

### Step 1: Create Notion Integration

1. Go to [Notion Integrations](https://www.notion.so/my-integrations)
2. Click "Create new integration"
3. Name it "房仲CRM"
4. Copy the "Internal Integration Token"
5. Paste it as `NOTION_API_KEY` in `.env.local`

### Step 2: Create Required Databases

Create the following Notion databases with the specified columns:

#### 買家資料庫 (Buyer Database)
- 名稱 (Title)
- 手機 (Phone/Rich Text)
- NOTE (Rich Text)
- 最近進展 (Rich Text)
- 等級 (Select: A級/B級/C級)
- 來源 (Select)
- 預算 (Rich Text)
- 需求 (Rich Text)
- 區域 (Rich Text)
- 下次跟進 (Date)

#### 任務資料庫 (Todo Database)
- 名稱 (Title)
- 完成 (Checkbox)
- 客戶 (Relation to Buyer Database)

#### 追蹤與委託資料庫 (Tracking Database)
- 名稱 (Title)
- 地址 (Rich Text)
- 價格 (Rich Text)
- 狀態 (Select)

#### 週報資料庫 (Weekly Database)
- 日期 (Date)
- 看房次數 (Number)
- 進展摘要 (Rich Text)

#### 策略資料庫 (Strategy Database)
- 名稱 (Title)
- 狀態 (Select: planning/filming/published)
- 瀏覽次數 (Number)

#### AI想法資料庫 (AI Ideas Database)
- 名稱 (Title)
- 狀態 (Select: idea/building/done)
- 平台 (Multi-select: N8N/Claude/GPT/API)

### Step 3: Get Database IDs

1. Open each database in Notion
2. Copy the ID from the URL (the 32-character string)
3. Add to `.env.local`:
   - `NOTION_BUYER_DB_ID`
   - `NOTION_TODO_DB_ID`
   - `NOTION_TRACKING_DB_ID`
   - `NOTION_WEEKLY_DB_ID`
   - `NOTION_STRATEGY_DB_ID`
   - `NOTION_AI_IDEAS_DB_ID`

### Step 4: Share Databases with Integration

For each database:
1. Open Share menu
2. Click "Invite"
3. Select your integration
4. Grant necessary permissions

### Step 5: Verify Setup

Visit `http://localhost:3000/setup` to verify all configurations are correct.

## Project Structure

```
crm-project/
├── app/
│   ├── api/              # API routes for Notion integration
│   │   ├── clients/      # Client management endpoints
│   │   ├── properties/   # Property tracking endpoints
│   │   ├── weekly/       # Weekly data endpoints
│   │   ├── todos/        # Task management endpoints
│   │   ├── videos/       # Video management endpoints
│   │   ├── ai-projects/  # AI project endpoints
│   │   └── setup/        # Setup verification
│   ├── marketing/        # Client management page
│   ├── videos/          # Video management page
│   ├── ai/              # AI projects page
│   ├── setup/           # Setup page
│   ├── layout.tsx       # Root layout
│   ├── page.tsx         # Dashboard (開發)
│   └── globals.css      # Global styles
├── components/          # React components
│   ├── Navigation.tsx   # Navigation bar
│   ├── ClientDetailModal.tsx
│   └── SetupRequired.tsx
├── lib/
│   ├── notion.ts        # Notion API utilities
│   └── types.ts         # TypeScript types
├── public/              # Static assets
└── config files         # Next.js, Tailwind, etc.
```

## API Routes

### GET /api/clients
Fetch all clients from buyer database

### PATCH /api/clients/[id]
Update a specific client

### GET /api/properties
Fetch tracked properties

### GET /api/weekly
Fetch weekly review data

### GET /api/todos
Fetch tasks (optionally filtered by clientId)

### GET /api/videos
Fetch video ideas

### GET /api/ai-projects
Fetch AI projects

### GET /api/setup
Check setup status and discover databases

## Deployment to Zeabur

1. Push your code to GitHub
2. Go to [Zeabur](https://zeabur.com)
3. Create a new project and connect your GitHub repo
4. Add environment variables in project settings
5. Deploy!

### Environment Variables for Zeabur

```
NOTION_API_KEY=your_token_here
NOTION_BUYER_DB_ID=your_id_here
NOTION_TODO_DB_ID=your_id_here
NOTION_TRACKING_DB_ID=your_id_here
NOTION_WEEKLY_DB_ID=your_id_here
NOTION_STRATEGY_DB_ID=your_id_here
NOTION_AI_IDEAS_DB_ID=your_id_here
NOTION_MAIN_PAGE_ID=32156ff9a8598091916ed853c177fa0f
```

## Customization

### Theme Colors
Edit `tailwind.config.js` to customize the indigo/purple gradient theme.

### Database Fields
Modify API routes in `app/api/` to match your custom database schema.

### Language
The app uses Traditional Chinese. To change, update text throughout the components.

## Troubleshooting

### API Key Error
- Verify your integration token is correct
- Ensure you're using the "Internal Integration Token", not the "OAuth Client ID"

### Database Not Found
- Confirm database ID is correct (should be 32 characters)
- Ensure the integration has access to the database
- Check that database columns match the expected schema

### Data Not Loading
- Verify environment variables are set correctly
- Check browser console for error messages
- Visit `/setup` page to diagnose configuration issues

## Support

For issues or questions, please open an issue on GitHub.

## License

MIT
