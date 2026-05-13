-- Phase 4.1c (2026-05-13)
-- 建 notion_id_map：給 backend writers 在 INSERT 時把舊 buyer ID 翻成新 person + buyer_need ID
-- 來源資料：outputs/migration-result.json（250 person + 78 buyer-need entries）

CREATE TABLE IF NOT EXISTS notion_id_map (
  old_buyer_id TEXT PRIMARY KEY,
  new_person_id TEXT NOT NULL,
  new_buyer_need_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notion_id_map_person ON notion_id_map(new_person_id);
