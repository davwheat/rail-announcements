-- Migration number: 0000 	 2023-12-20T01:05:07.712Z

CREATE TABLE IF NOT EXISTS saved_announcements (
    id TEXT PRIMARY KEY,
    system_id TEXT NOT NULL,
    tab_id TEXT NOT NULL,
    state TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- Add indexes
CREATE INDEX idx_saved_announcements_system_id ON saved_announcements (system_id);
CREATE INDEX idx_saved_announcements_created_at ON saved_announcements (created_at);
