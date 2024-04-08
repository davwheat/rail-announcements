-- Migration number: 0001 	 2023-12-20T17:20:42.694Z

-- Add new load count column
ALTER TABLE saved_announcements ADD COLUMN load_count INTEGER NOT NULL DEFAULT 0;

-- Add index for load count
CREATE INDEX idx_saved_announcements_load_count ON saved_announcements (load_count);
