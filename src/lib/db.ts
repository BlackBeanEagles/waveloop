import { createClient, type Client, type InValue } from "@libsql/client";

// One code path for local and hosted: a file: URL locally, a Turso libsql:// URL in production.
const url = process.env.DATABASE_URL ?? "file:waveloop.db";
const authToken = process.env.DATABASE_AUTH_TOKEN;

const globalForDb = globalThis as unknown as { __db?: Client; __dbReady?: Promise<void>; __dbSchema?: string };

export const db: Client = globalForDb.__db ?? createClient({ url, authToken });
globalForDb.__db = db;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS colleges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  city TEXT NOT NULL,
  tier INTEGER NOT NULL DEFAULT 2
);
CREATE TABLE IF NOT EXISTS ambassadors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  college_id INTEGER NOT NULL REFERENCES colleges(id),
  code TEXT NOT NULL UNIQUE,
  groups_reached INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL UNIQUE,
  college_id INTEGER NOT NULL REFERENCES colleges(id),
  branch TEXT NOT NULL,
  year TEXT NOT NULL,
  ref_code TEXT NOT NULL UNIQUE,
  referred_by INTEGER REFERENCES users(id),
  ambassador_id INTEGER REFERENCES ambassadors(id),
  channel TEXT NOT NULL DEFAULT 'direct',
  variant TEXT,
  idea_json TEXT,
  verified INTEGER NOT NULL DEFAULT 0,
  otp_hash TEXT,
  otp_expires TEXT,
  ip_hash TEXT,
  device_hash TEXT,
  fraud_score INTEGER NOT NULL DEFAULT 0,
  fraud_reasons TEXT,
  attended INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  verified_at TEXT
);
CREATE INDEX IF NOT EXISTS users_referred_by ON users(referred_by);
CREATE INDEX IF NOT EXISTS users_ip ON users(ip_hash);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  visitor_id TEXT,
  user_id INTEGER,
  channel TEXT,
  variant TEXT,
  meta TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS events_type_time ON events(type, created_at);
CREATE TABLE IF NOT EXISTS outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  channel TEXT NOT NULL,
  template TEXT NOT NULL,
  body TEXT NOT NULL,
  send_at TEXT NOT NULL,
  sent_at TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  provider TEXT
);
CREATE INDEX IF NOT EXISTS outbox_due ON outbox(status, send_at);
CREATE TABLE IF NOT EXISTS wa_sessions (
  phone TEXT PRIMARY KEY,
  state TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS wa_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  direction TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS polls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question TEXT NOT NULL,
  options TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS votes (
  poll_id INTEGER NOT NULL REFERENCES polls(id),
  voter TEXT NOT NULL,
  option_index INTEGER NOT NULL,
  PRIMARY KEY (poll_id, voter)
);
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author TEXT NOT NULL,
  body TEXT NOT NULL,
  upvotes INTEGER NOT NULL DEFAULT 0,
  answered INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  repo_url TEXT,
  description TEXT NOT NULL,
  scores TEXT NOT NULL,
  total INTEGER NOT NULL,
  feedback TEXT NOT NULL,
  graded_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS variants (
  key TEXT PRIMARY KEY,
  headline TEXT NOT NULL,
  sub TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS copilot_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  output TEXT NOT NULL,
  engine TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export function ready(): Promise<void> {
  // Re-run when the schema text changes (dev hot reload keeps globalThis alive). Every statement is IF NOT EXISTS.
  if (!globalForDb.__dbReady || globalForDb.__dbSchema !== SCHEMA) {
    globalForDb.__dbSchema = SCHEMA;
    globalForDb.__dbReady = db.executeMultiple(SCHEMA);
  }
  return globalForDb.__dbReady;
}

export async function all<T = Record<string, unknown>>(sql: string, args: InValue[] = []): Promise<T[]> {
  await ready();
  const r = await db.execute({ sql, args });
  return r.rows as unknown as T[];
}

export async function one<T = Record<string, unknown>>(sql: string, args: InValue[] = []): Promise<T | undefined> {
  const rows = await all<T>(sql, args);
  return rows[0];
}

export async function run(sql: string, args: InValue[] = []) {
  await ready();
  return db.execute({ sql, args });
}

export const now = () => new Date().toISOString();
