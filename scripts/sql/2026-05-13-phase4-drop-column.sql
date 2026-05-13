-- Phase 4.5b (2026-05-13)
-- 終結 notion_buyer_id 欄位、整套 Phase 4 readers refactor 完工

-- 先砍依賴 column 的舊 index（idx_viewings_buyer / idx_conversations_buyer）
DROP INDEX IF EXISTS idx_viewings_buyer;
DROP INDEX IF EXISTS idx_conversations_buyer;

ALTER TABLE viewings DROP COLUMN IF EXISTS notion_buyer_id;
ALTER TABLE conversations DROP COLUMN IF EXISTS notion_buyer_id;
