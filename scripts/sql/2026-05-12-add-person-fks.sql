-- Phase 3.2 (2026-05-12)
-- 為 viewings / conversations 加上指向新 schema 的 FK column
-- 舊 notion_buyer_id 暫留、Phase 3.7 確認沒人讀才砍

ALTER TABLE viewings
  ADD COLUMN IF NOT EXISTS notion_person_id TEXT,
  ADD COLUMN IF NOT EXISTS notion_buyer_need_id TEXT;

CREATE INDEX IF NOT EXISTS idx_viewings_person ON viewings(notion_person_id);
CREATE INDEX IF NOT EXISTS idx_viewings_buyer_need ON viewings(notion_buyer_need_id);

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS notion_person_id UUID;

CREATE INDEX IF NOT EXISTS idx_conversations_person ON conversations(notion_person_id);
