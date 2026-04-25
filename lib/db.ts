import { Pool } from 'pg';

const connStr = (process.env.DATABASE_URL ?? '').replace(/[?&]sslmode=[^&]*/g, '').replace(/\?$/, '');

const pool = new Pool({
  connectionString: connStr,
  ssl: { rejectUnauthorized: false },
  max: 5,
});

export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  const res = await pool.query(sql, params);
  return res.rows as T[];
}

let tablesReady = false;

export async function ensureTables(): Promise<void> {
  if (tablesReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      session_id  TEXT PRIMARY KEY,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id          SERIAL PRIMARY KEY,
      session_id  TEXT REFERENCES sessions(session_id) ON DELETE CASCADE,
      intent      TEXT NOT NULL,
      response    TEXT NOT NULL,
      filename    TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id          SERIAL PRIMARY KEY,
      title       TEXT NOT NULL,
      content     TEXT NOT NULL,
      search_vec  TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS documents_search_idx ON documents USING GIN(search_vec)
  `);
  // Add pin_code column if it doesn't exist yet (idempotent migration)
  await pool.query(`
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS pin_code TEXT
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS sessions_pin_idx ON sessions(pin_code)
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS playlist (
      id         SERIAL PRIMARY KEY,
      youtube_id TEXT NOT NULL,
      title      TEXT NOT NULL,
      artist     TEXT,
      position   INT DEFAULT 0,
      added_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  tablesReady = true;
}
