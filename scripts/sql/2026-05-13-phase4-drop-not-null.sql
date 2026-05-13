-- Phase 4.1a (2026-05-13)
-- 把舊欄位的 NOT NULL 拿掉、讓 Phase 4.3 之後 INSERT 不寫 notion_buyer_id 也能過

ALTER TABLE viewings ALTER COLUMN notion_buyer_id DROP NOT NULL;
ALTER TABLE conversations ALTER COLUMN notion_buyer_id DROP NOT NULL;
