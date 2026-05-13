-- Phase 7.F PG rollback：
--   1. 把 notion_buyer_id 欄位加回 viewings + conversations
--   2. 從 notion_id_map 反查 person_id → old_buyer_id、UPDATE 補欄
--   3. 砍 notion_person_id + notion_buyer_need_id
--   4. 砍 notion_id_map 表
--   5. 加回原本舊 index

-- Step 1: 加回欄位
ALTER TABLE viewings ADD COLUMN IF NOT EXISTS notion_buyer_id TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS notion_buyer_id UUID;

-- Step 2: 反向 backfill
UPDATE viewings v
   SET notion_buyer_id = m.old_buyer_id
  FROM notion_id_map m
 WHERE v.notion_person_id IS NOT NULL
   AND v.notion_person_id = m.new_person_id
   AND v.notion_buyer_id IS NULL;

UPDATE conversations c
   SET notion_buyer_id = m.old_buyer_id::uuid
  FROM notion_id_map m
 WHERE c.notion_person_id IS NOT NULL
   AND c.notion_person_id::text = m.new_person_id
   AND c.notion_buyer_id IS NULL;

-- Step 3: 砍 Phase 4 加的新欄位 + 舊 index
DROP INDEX IF EXISTS idx_viewings_person;
DROP INDEX IF EXISTS idx_viewings_buyer_need;
DROP INDEX IF EXISTS idx_conversations_person;
ALTER TABLE viewings DROP COLUMN IF EXISTS notion_person_id;
ALTER TABLE viewings DROP COLUMN IF EXISTS notion_buyer_need_id;
ALTER TABLE conversations DROP COLUMN IF EXISTS notion_person_id;

-- Step 4: 砍 notion_id_map
DROP INDEX IF EXISTS idx_notion_id_map_person;
DROP TABLE IF EXISTS notion_id_map;

-- Step 5: 重建原本舊 index (跟 Phase 1 migrate-viewings.js / migrate-conversations.js 一致)
CREATE INDEX IF NOT EXISTS idx_viewings_buyer ON viewings (notion_buyer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_buyer ON conversations (notion_buyer_id);
