/**
 * @fileoverview Database operations for Rundee Bot using SQLite
 * @copyright Rundee 2024
 * @license MIT
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use persistent storage path if available (Railway volume or /tmp for persistence)
// Railway volumes are mounted at /app/data or we can use /tmp which persists across restarts
const persistentDir = process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.DATA_DIR || '/tmp';
const dbPath = join(persistentDir, 'rundee-bot.db');
console.log('Initializing database at:', dbPath);
console.log('Persistent directory:', persistentDir);

let db;
try {
  db = new Database(dbPath);
  console.log('Database initialized successfully');
} catch (error) {
  console.error('Failed to initialize database:', error);
  throw error;
}

// Initialize database tables
try {
  db.exec(`
  CREATE TABLE IF NOT EXISTS meetings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    participants TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    reminder_minutes TEXT NOT NULL,
    reminded TEXT NOT NULL DEFAULT '[]',
    repeat_type TEXT,
    repeat_interval INTEGER,
    repeat_end_date TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id TEXT PRIMARY KEY,
    meeting_channel_id TEXT,
    github_channel_id TEXT,
    github_repository TEXT,
    language TEXT DEFAULT 'en',
    timezone TEXT DEFAULT 'Asia/Seoul',
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_meetings_guild_date ON meetings(guild_id, date);
  CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(date);
`);
  console.log('Database tables initialized successfully');
} catch (error) {
  console.error('Failed to initialize database tables:', error);
  throw error;
}

export const dbGet = db.prepare.bind(db);
export const dbRun = db.prepare.bind(db);

// Meeting operations
export const meetingQueries = {
  insert: db.prepare(`
    INSERT INTO meetings (guild_id, title, date, participants, channel_id, reminder_minutes, repeat_type, repeat_interval, repeat_end_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),

  getAll: db.prepare('SELECT * FROM meetings ORDER BY date ASC'),
  
  getByGuild: db.prepare('SELECT * FROM meetings WHERE guild_id = ? ORDER BY date ASC'),
  
  getById: db.prepare('SELECT * FROM meetings WHERE id = ?'),
  
  getUpcoming: db.prepare(`
    SELECT * FROM meetings 
    WHERE date > datetime('now') 
    ORDER BY date ASC
  `),
  
  getUpcomingByGuild: db.prepare(`
    SELECT * FROM meetings 
    WHERE guild_id = ? AND date > datetime('now')
    ORDER BY date ASC
  `),
  
  update: db.prepare(`
    UPDATE meetings 
    SET title = ?, date = ?, participants = ?, reminder_minutes = ?, repeat_type = ?, repeat_interval = ?, repeat_end_date = ?
    WHERE id = ?
  `),
  
  delete: db.prepare('DELETE FROM meetings WHERE id = ?'),
  
  updateReminded: db.prepare(`
    UPDATE meetings 
    SET reminded = ?
    WHERE id = ?
  `),
};

// Guild settings operations
export const guildSettingsQueries = {
  get: db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?'),
  
  getAll: db.prepare('SELECT * FROM guild_settings'),
  
  insertOrUpdate: db.prepare(`
    INSERT INTO guild_settings (guild_id, meeting_channel_id, github_channel_id, github_repository)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET
      meeting_channel_id = COALESCE(excluded.meeting_channel_id, meeting_channel_id),
      github_channel_id = COALESCE(excluded.github_channel_id, github_channel_id),
      github_repository = COALESCE(excluded.github_repository, github_repository),
      updated_at = CURRENT_TIMESTAMP
  `),
  
  setMeetingChannel: db.prepare(`
    INSERT INTO guild_settings (guild_id, meeting_channel_id)
    VALUES (?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET meeting_channel_id = excluded.meeting_channel_id, updated_at = CURRENT_TIMESTAMP
  `),
  
  setGithubChannel: db.prepare(`
    INSERT INTO guild_settings (guild_id, github_channel_id)
    VALUES (?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET github_channel_id = excluded.github_channel_id, updated_at = CURRENT_TIMESTAMP
  `),
  
  setGithubRepository: db.prepare(`
    INSERT INTO guild_settings (guild_id, github_repository)
    VALUES (?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET github_repository = excluded.github_repository, updated_at = CURRENT_TIMESTAMP
  `),
  
  setLanguage: db.prepare(`
    INSERT INTO guild_settings (guild_id, language)
    VALUES (?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET language = excluded.language, updated_at = CURRENT_TIMESTAMP
  `),
  
  setTimezone: db.prepare(`
    INSERT INTO guild_settings (guild_id, timezone)
    VALUES (?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET timezone = excluded.timezone, updated_at = CURRENT_TIMESTAMP
  `),
};

export default db;

