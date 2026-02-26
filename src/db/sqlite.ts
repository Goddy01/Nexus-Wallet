import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { mkdirSync } from 'fs';

const dbPath = process.env.DATABASE_URL || './data/nexus.db';
const dir = dirname(dbPath);

// Ensure directory exists
try {
  mkdirSync(dir, { recursive: true });
} catch (e) {
  // Directory might already exist
}

export const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Initialize tables
export function initDatabase() {
  console.log('🗄️  Initializing database...');

  // Wallets table
  db.exec(`
    CREATE TABLE IF NOT EXISTS wallets (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      turnkey_wallet_id TEXT NOT NULL,
      public_key TEXT NOT NULL,
      policy TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // Transactions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      wallet_id TEXT NOT NULL,
      signature TEXT,
      type TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      payload TEXT,
      result TEXT,
      error TEXT,
      created_at INTEGER NOT NULL,
      completed_at INTEGER,
      FOREIGN KEY (wallet_id) REFERENCES wallets(id)
    )
  `);

  // Audit logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet_id TEXT,
      agent_id TEXT,
      action TEXT NOT NULL,
      details TEXT,
      timestamp INTEGER NOT NULL
    )
  `);

  // Rate limits table
  db.exec(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT NOT NULL,
      action TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    )
  `);

  // Agents table
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      strategy TEXT,
      wallet_id TEXT,
      status TEXT DEFAULT 'stopped',
      config TEXT,
      created_at INTEGER NOT NULL,
      last_active INTEGER,
      FOREIGN KEY (wallet_id) REFERENCES wallets(id)
    )
  `);

  // Escrows table (for agent mesh)
  db.exec(`
    CREATE TABLE IF NOT EXISTS escrows (
      id TEXT PRIMARY KEY,
      employer_agent_id TEXT NOT NULL,
      employee_agent_id TEXT NOT NULL,
      amount REAL NOT NULL,
      token_mint TEXT,
      milestones TEXT,
      status TEXT DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      completed_at INTEGER
    )
  `);

  // Tasks table
db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      employer_id TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      budget REAL NOT NULL,
      requirements TEXT,
      status TEXT DEFAULT 'open',
      assigned_to TEXT,
      created_at INTEGER NOT NULL,
      completed_at INTEGER
    )
  `);

  console.log('✅ Database initialized');
}

export default db;