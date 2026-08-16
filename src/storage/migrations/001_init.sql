CREATE TABLE IF NOT EXISTS commands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trigger TEXT NOT NULL,
  reply_text TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  global_last_used_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_commands_trigger_lower
  ON commands (LOWER(trigger));

CREATE TABLE IF NOT EXISTS command_user_cooldowns (
  command_id INTEGER NOT NULL REFERENCES commands (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  last_used_at TEXT NOT NULL,
  PRIMARY KEY (command_id, user_id)
);
